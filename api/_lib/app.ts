import express from "express";
import twilio from "twilio";
import admin from "firebase-admin";

// ---------------------------------------------------------------------------
// Firebase Admin (Firestore) - used only by the handful of server-side
// endpoints below (WhatsApp sending, Google Forms bulk-admission) that either
// hold a secret (Twilio) or need to write many tenant docs in one request.
// Everything else in the app (auth, CRUD, payments, KYC review) talks to
// Firestore directly from the browser via the client SDK - see
// src/services/firestoreService.ts.
//
// This file only builds the API routes (no Vite dev middleware, no static
// file serving) so it can be reused both by server.ts (traditional Node
// hosting - Render/Railway/a VM) and by api/index.ts (Vercel serverless
// function) without duplicating route logic.
// ---------------------------------------------------------------------------

function initFirebaseAdmin() {
  if (admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    console.warn(
      "FIREBASE_ADMIN_* env vars not set - Google Forms bulk-admission / Team Access endpoints will be disabled."
    );
    return null;
  }

  // Never let a malformed env var (extra quotes, truncated key, mangled
  // newlines from copy-paste into a hosting dashboard) crash the whole
  // serverless function at cold start - that takes down every /api/* route
  // with the platform's generic error page instead of a useful JSON error.
  try {
    return admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  } catch (err) {
    console.error("Failed to initialize Firebase Admin - check FIREBASE_ADMIN_PRIVATE_KEY formatting:", err);
    return null;
  }
}

const adminApp = initFirebaseAdmin();
const getDb = () => (adminApp ? admin.firestore() : null);

const nowIso = () => new Date().toISOString();

// Finds the first vacant bed for a property (optionally within a preferred
// room) and marks it occupied. Mirrors the allocation logic in PGContext's
// client-side `addTenant`.
async function allocateVacantBed(
  db: FirebaseFirestore.Firestore,
  propertyId: string,
  preferredRoomId: string | undefined,
  tenantId: string,
  tenantName: string,
  tenantPhone: string
) {
  const roomsSnap = await db.collection("rooms").where("propertyId", "==", propertyId).get();
  const rooms = roomsSnap.docs.map((d) => ({ ref: d.ref, ...(d.data() as any) }));
  const ordered = preferredRoomId
    ? [...rooms.filter((r) => r.id === preferredRoomId), ...rooms.filter((r) => r.id !== preferredRoomId)]
    : rooms;

  for (const room of ordered) {
    const vacantIndex = room.beds.findIndex((b: any) => b.status === "vacant");
    if (vacantIndex === -1) continue;
    const updatedBeds = room.beds.map((b: any, i: number) =>
      i === vacantIndex
        ? { ...b, status: "occupied", tenantId, tenantName, tenantPhone, lastUpdated: nowIso() }
        : b
    );
    await room.ref.update({ beds: updatedBeds });
    return { room, bed: updatedBeds[vacantIndex] };
  }
  return { room: null, bed: null };
}

function normalizePhone(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  return `+91${digits.slice(-10)}`;
}

// A one-time password shared out-of-band (WhatsApp/SMS/in person) with a
// newly invited admin/staff account - not meant to be memorable, just to get
// them logged in once before they're forced to set their own (see
// mustChangePassword in types.ts / ChangePasswordScreen.tsx).
function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function emptyKyc(overrides: Record<string, any>) {
  return {
    status: "pending", // Always owner-reviewed, even for a fully self-reported bulk import - see types.ts KYCVerificationMethod
    submittedAt: nowIso().split("T")[0],
    verifiedByOwner: false,
    aadhaar: {
      aadhaarNumber: overrides.aadhaarNumber || "",
      aadhaarLast4: (overrides.aadhaarNumber || "").replace(/\D/g, "").slice(-4),
      nameOnAadhaar: (overrides.name || "").toUpperCase(),
      dob: overrides.dob || "",
      gender: overrides.gender || "Male",
      address: overrides.address || "",
      verificationMethod: "manual",
    },
    fatherName: overrides.fatherName || "",
    emergencyContactName: overrides.emergencyContactName || "",
    emergencyContactPhone: overrides.emergencyContactPhone || "",
    emergencyContactRelation: overrides.emergencyContactRelation || "Parent",
    permanentAddress: overrides.address || "",
    city: overrides.city || "",
    state: overrides.state || "",
    pincode: overrides.pincode || "",
    occupation: overrides.occupation || "Working Professional",
    companyOrCollege: overrides.companyOrCollege || "",
    foodPreference: overrides.foodPreference || "Veg",
  };
}

async function admitTenant(
  db: FirebaseFirestore.Firestore,
  propertyId: string,
  fields: {
    name: string;
    phone: string;
    email?: string;
    preferredRoomId?: string;
    hometown?: string;
    [key: string]: any;
  }
) {
  const phone = normalizePhone(fields.phone);
  const tenantRef = db.collection("tenants").doc();
  const { room, bed } = await allocateVacantBed(db, propertyId, fields.preferredRoomId, tenantRef.id, fields.name, phone);

  const rent = bed?.pricePerMonth || room?.pricePerBed || 8000;
  const tenant = {
    id: tenantRef.id,
    propertyId,
    name: fields.name,
    email: fields.email || `${fields.name.toLowerCase().replace(/\s+/g, "")}@gmail.com`,
    phone,
    photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
    roomId: room?.id,
    roomNumber: room?.roomNumber,
    bedId: bed?.id,
    bedLabel: bed?.bedLabel,
    floor: room?.floor || 1,
    monthlyRent: rent,
    securityDeposit: room?.securityDeposit || 15000,
    depositPaid: false,
    checkInDate: nowIso().split("T")[0],
    rentStatus: "due",
    dueAmount: rent,
    hometown: fields.hometown || fields.city || "",
    kyc: emptyKyc(fields),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  await tenantRef.set(tenant);
  return tenant;
}

export function createApiApp() {
  const app = express();

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  const requireAdminDb = (res: express.Response) => {
    const db = getDb();
    if (!db) {
      res.status(503).json({
        success: false,
        error: "Server not configured: set FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY.",
      });
      return null;
    }
    return db;
  };

  // ----------------------------------------------------
  // Admin/staff account provisioning. Owner accounts are never publicly
  // self-service (the login screen only signs in, it doesn't sign up) - an
  // existing owner invites a new admin/staff account from Settings, which
  // calls this endpoint. It creates the Firebase Auth user + Firestore
  // profile server-side (via Admin SDK, which the browser SDK can't do
  // without switching the current session to the new user) and returns a
  // one-time temporary password for the owner to share out-of-band.
  // ----------------------------------------------------

  // Named to avoid the literal word "admin" in the path - Vercel's default
  // Firewall/bot-protection appears to block requests whose path contains
  // "/admin/" before they ever reach a function (confirmed: this route
  // returned Vercel's platform 404 with zero entries in Runtime Logs, while
  // sibling routes without "admin" in the path were reaching the function
  // fine). Not a code bug - just don't use that word in a route path.
  app.post("/api/team/invite", async (req, res) => {
    const db = requireAdminDb(res);
    if (!db) return;
    try {
      const authHeader = req.headers.authorization || "";
      const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
      if (!idToken) {
        return res.status(401).json({ success: false, error: "Missing Authorization bearer token." });
      }

      const decoded = await admin.auth().verifyIdToken(idToken);
      const callerProfileSnap = await db.collection("users").doc(decoded.uid).get();
      const callerProfile = callerProfileSnap.data();
      if (!callerProfile || callerProfile.role !== "owner") {
        return res.status(403).json({ success: false, error: "Only an existing owner can add admin/staff accounts." });
      }

      const { name, email, role } = req.body;
      if (!name || !email || (role !== "owner" && role !== "staff")) {
        return res.status(400).json({ success: false, error: "name, email, and role ('owner' or 'staff') are required." });
      }

      // Every property the caller can access: the ones they created (their
      // uid is the property's `ownerId` - creating a property never adds it
      // to the creator's own propertyIds, see PGContext.createNewProperty)
      // plus the ones they were themselves invited to. Copying only
      // callerProfile.propertyIds left an invited co-owner with no
      // properties at all whenever the inviter was the property's creator.
      const ownedSnap = await db.collection("properties").where("ownerId", "==", decoded.uid).get();
      const propertyIds: string[] = Array.from(
        new Set([...ownedSnap.docs.map((d) => d.id), ...(callerProfile.propertyIds || [])])
      );

      // Adding someone who already has an account just refreshes their access
      // (e.g. to properties created after they were first invited) instead of
      // failing with "email already exists".
      let existingUser: admin.auth.UserRecord | null = null;
      try {
        existingUser = await admin.auth().getUserByEmail(email);
      } catch (err: any) {
        if (err.code !== "auth/user-not-found") throw err;
      }

      let tempPassword: string | null = null;
      if (existingUser) {
        const profileRef = db.collection("users").doc(existingUser.uid);
        const profileSnap = await profileRef.get();
        if (!profileSnap.exists) {
          return res.status(409).json({ success: false, error: "That email is already registered (not as a team member)." });
        }
        await profileRef.update({
          role,
          propertyIds: Array.from(new Set([...(profileSnap.data()?.propertyIds || []), ...propertyIds])),
        });
      } else {
        tempPassword = generateTempPassword();
        const newUser = await admin.auth().createUser({ email, password: tempPassword, displayName: name });

        await db.collection("users").doc(newUser.uid).set({
          name,
          email,
          role,
          propertyIds,
          mustChangePassword: true,
          createdAt: nowIso(),
        });
      }

      // Best-effort: one Activity Log entry per property the caller has
      // access to (see ActivityLog in src/types.ts). Never let a logging
      // failure fail the actual invite - the account is already created.
      await Promise.all(
        propertyIds.map((propertyId) =>
          db
            .collection("activityLogs")
            .add({
              propertyId,
              actorUid: decoded.uid,
              actorName: callerProfile.name || callerProfile.email || "Unknown",
              actorRole: callerProfile.role,
              action: "team.invite",
              summary: existingUser
                ? `Updated ${name}'s team access (${role})`
                : `Invited ${name} (${role}) to the team`,
              createdAt: nowIso(),
            })
            .catch((err: any) => console.warn("team.invite activity log failed:", err))
        )
      );

      res.json({ success: true, email, existing: !!existingUser, tempPassword, propertyCount: propertyIds.length });
    } catch (err: any) {
      console.error("create-team-member error:", err);
      const message = err.code === "auth/email-already-exists" ? "That email is already registered." : err.message;
      res.status(500).json({ success: false, error: message });
    }
  });

  // ----------------------------------------------------
  // Google Forms bulk-admission (single response, batch import, webhook sim)
  // These are the only flows that still need a server: they must write many
  // Firestore docs (tenant + room bed allocation) atomically-ish in one
  // request, which the public onboarding page (client-side, one tenant at a
  // time) doesn't need to do.
  // ----------------------------------------------------

  app.post("/api/onboard/submit", async (req, res) => {
    const db = requireAdminDb(res);
    if (!db) return;
    try {
      const data = req.body;
      if (!data.propertyId) {
        return res.status(400).json({ success: false, error: "propertyId is required." });
      }
      const tenant = await admitTenant(db, data.propertyId, {
        name: data.name || data.nameOnAadhaar || "Resident",
        phone: data.phone,
        email: data.email,
        preferredRoomId: data.roomId,
        hometown: data.hometown,
        aadhaarNumber: data.aadhaar?.aadhaarNumber || data.aadhaarNumber,
        dob: data.aadhaar?.dob || data.dob,
        gender: data.aadhaar?.gender || data.gender,
        address: data.aadhaar?.address || data.permanentAddress,
        fatherName: data.fatherName,
        emergencyContactName: data.emergencyContactName,
        emergencyContactPhone: data.emergencyContactPhone,
        emergencyContactRelation: data.emergencyContactRelation,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        occupation: data.occupation,
        companyOrCollege: data.companyOrCollege,
        foodPreference: data.foodPreference,
      });
      res.json({ success: true, message: "Tenant admitted - pending owner KYC review.", tenant });
    } catch (err: any) {
      console.error("Onboarding error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // KYC submitted from a tenant's invite link (?onboard=<tenantId>). The
  // tenant isn't signed in at that point, and firestore.rules only let a
  // signed-in owner or the tenant's own phone session update an existing
  // tenant doc - so the write happens here instead. The caller must know both
  // the tenant id (from the invite link) and the phone number on file.
  app.post("/api/onboard/kyc", async (req, res) => {
    const db = requireAdminDb(res);
    if (!db) return;
    try {
      const { tenantId, phone, kyc } = req.body || {};
      if (!tenantId || !phone || !kyc) {
        return res.status(400).json({ success: false, error: "tenantId, phone and kyc are required." });
      }
      const ref = db.collection("tenants").doc(String(tenantId));
      const snap = await ref.get();
      const tenant = snap.data();
      const last10 = (p: string) => String(p || "").replace(/\D/g, "").slice(-10);
      if (!snap.exists || !tenant || last10(tenant.phone) !== last10(phone)) {
        return res.status(404).json({ success: false, error: "No tenant found for this link and mobile number." });
      }

      const str = (v: any) => (v == null ? "" : String(v));
      const aadhaarNumber = str(kyc.aadhaar?.aadhaarNumber).replace(/\D/g, "");
      const updatedKyc = {
        ...(tenant.kyc || {}),
        fatherName: str(kyc.fatherName),
        emergencyContactName: str(kyc.emergencyContactName),
        emergencyContactPhone: str(kyc.emergencyContactPhone),
        emergencyContactRelation: str(kyc.emergencyContactRelation),
        permanentAddress: str(kyc.permanentAddress),
        city: str(kyc.city),
        state: str(kyc.state),
        pincode: str(kyc.pincode),
        occupation: str(kyc.occupation),
        companyOrCollege: str(kyc.companyOrCollege),
        foodPreference: str(kyc.foodPreference),
        bloodGroup: str(kyc.bloodGroup),
        // Always lands as pending - the owner reviews it (same as PGContext.submitKYC).
        status: "pending",
        submittedAt: nowIso().split("T")[0],
        aadhaar: {
          ...(tenant.kyc?.aadhaar || {}),
          aadhaarNumber,
          aadhaarLast4: aadhaarNumber.slice(-4),
          nameOnAadhaar: str(kyc.aadhaar?.nameOnAadhaar),
          dob: str(kyc.aadhaar?.dob),
          gender: str(kyc.aadhaar?.gender),
          address: str(kyc.aadhaar?.address),
          verificationMethod: "manual",
        },
      };
      const updates: Record<string, any> = { kyc: updatedKyc, updatedAt: nowIso() };
      if (kyc.email) updates.email = str(kyc.email);
      await ref.update(updates);

      await db
        .collection("activityLogs")
        .add({
          propertyId: tenant.propertyId,
          actorUid: "",
          actorName: tenant.name || "Tenant",
          actorRole: "tenant",
          action: "kyc.submit",
          summary: `${tenant.name || "Tenant"} submitted KYC from the invite link`,
          createdAt: nowIso(),
        })
        .catch((err: any) => console.warn("kyc.submit activity log failed:", err));

      res.json({ success: true, tenant: { id: snap.id, ...tenant, ...updates } });
    } catch (err: any) {
      console.error("Onboarding KYC error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ----------------------------------------------------
  // Aadhaar front/back copies. Stored server-side only, in
  // kycDocuments/{tenantId} (compressed JPEG data URLs, well under
  // Firestore's 1 MB document limit) - no Firebase Storage bucket or extra
  // firestore.rules needed: firestore.rules has no kycDocuments rule, so
  // browsers can't read or write it directly; only these two routes can.
  // ----------------------------------------------------

  // Returns the uid's access to a property: the creator (ownerId) or an
  // invited team member (users/{uid}.propertyIds).
  const canAccessProperty = async (db: FirebaseFirestore.Firestore, uid: string, propertyId: string) => {
    const [propSnap, profileSnap] = await Promise.all([
      db.collection("properties").doc(propertyId).get(),
      db.collection("users").doc(uid).get(),
    ]);
    if (!profileSnap.exists) return false;
    return propSnap.data()?.ownerId === uid || (profileSnap.data()?.propertyIds || []).includes(propertyId);
  };

  const bearerUid = async (req: express.Request) => {
    const h = req.headers.authorization || "";
    if (!h.startsWith("Bearer ")) return null;
    try {
      return (await admin.auth().verifyIdToken(h.slice(7))).uid;
    } catch {
      return null;
    }
  };

  const MAX_DOC_CHARS = 450_000; // per image, ~330 KB JPEG - both fit in one Firestore doc

  // Upload from the tenant onboarding form. Allowed for the tenant (tenant id
  // + phone on file, same check as /api/onboard/kyc) or for a signed-in
  // owner/staff account with access to the tenant's property.
  app.post("/api/onboard/kyc-docs", async (req, res) => {
    const db = requireAdminDb(res);
    if (!db) return;
    try {
      const { tenantId, phone, front, back } = req.body || {};
      if (!tenantId || (!front && !back)) {
        return res.status(400).json({ success: false, error: "tenantId and at least one image are required." });
      }
      for (const img of [front, back]) {
        if (img && (typeof img !== "string" || !img.startsWith("data:image/") || img.length > MAX_DOC_CHARS)) {
          return res.status(400).json({ success: false, error: "Each Aadhaar copy must be an image under about 300 KB." });
        }
      }

      // A tenant just created from the browser may take a moment to land.
      const ref = db.collection("tenants").doc(String(tenantId));
      let snap = await ref.get();
      for (let i = 0; i < 3 && !snap.exists; i++) {
        await new Promise((r) => setTimeout(r, 700));
        snap = await ref.get();
      }
      const tenant = snap.data();
      if (!snap.exists || !tenant) {
        return res.status(404).json({ success: false, error: "Tenant not found." });
      }

      const last10 = (p: string) => String(p || "").replace(/\D/g, "").slice(-10);
      const phoneOk = !!phone && last10(tenant.phone) === last10(phone);
      const uid = phoneOk ? null : await bearerUid(req);
      if (!phoneOk && !(uid && (await canAccessProperty(db, uid, tenant.propertyId)))) {
        return res.status(403).json({ success: false, error: "Not allowed to upload documents for this tenant." });
      }

      const docData: Record<string, any> = { tenantId: snap.id, propertyId: tenant.propertyId, uploadedAt: nowIso() };
      const tenantUpdates: Record<string, any> = { updatedAt: nowIso() };
      if (front) {
        docData.front = front;
        tenantUpdates["kyc.aadhaar.frontImageUrl"] = "uploaded";
      }
      if (back) {
        docData.back = back;
        tenantUpdates["kyc.aadhaar.backImageUrl"] = "uploaded";
      }
      await db.collection("kycDocuments").doc(snap.id).set(docData, { merge: true });
      await ref.update(tenantUpdates);
      res.json({ success: true });
    } catch (err: any) {
      console.error("KYC documents upload error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Tenant portal login, created when the tenant submits their KYC form.
  // Email + password (Phone OTP needs Firebase's paid Blaze plan for SMS).
  // The account is created with a random password the tenant never sees;
  // the browser then has Firebase email them a free "set your password"
  // link (authService.sendPasswordSetupEmail). The account also carries the
  // tenant's phone number, so the ID token's `phone_number` claim matches
  // tenants/{id}.phone and the existing firestore.rules tenant checks work
  // unchanged, plus a `role: tenant` claim so PGContext opens the tenant
  // portal instead of the owner view.
  // Allowed for the tenant (tenant id + phone on file) or an owner/staff
  // account with access to the tenant's property. A tenant that already
  // has a login is left alone - the owner can't be locked out by someone
  // re-submitting the form with a different email.
  app.post("/api/onboard/tenant-login", async (req, res) => {
    const db = requireAdminDb(res);
    if (!db) return;
    try {
      const { tenantId, phone } = req.body || {};
      const email = String(req.body?.email || "").trim().toLowerCase();
      if (!tenantId || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return res.status(400).json({ success: false, error: "tenantId and a valid email are required." });
      }
      const ref = db.collection("tenants").doc(String(tenantId));
      let snap = await ref.get();
      for (let i = 0; i < 3 && !snap.exists; i++) {
        await new Promise((r) => setTimeout(r, 700));
        snap = await ref.get();
      }
      const tenant = snap.data();
      if (!snap.exists || !tenant) return res.status(404).json({ success: false, error: "Tenant not found." });

      const last10 = (p: string) => String(p || "").replace(/\D/g, "").slice(-10);
      const phoneOk = !!phone && last10(tenant.phone) === last10(phone);
      const uid = phoneOk ? null : await bearerUid(req);
      if (!phoneOk && !(uid && (await canAccessProperty(db, uid, tenant.propertyId)))) {
        return res.status(403).json({ success: false, error: "Not allowed." });
      }

      if (tenant.authUid) {
        const existing = await admin.auth().getUser(tenant.authUid).catch(() => null);
        if (existing) return res.json({ success: true, email: existing.email, existing: true });
      }

      const byEmail = await admin.auth().getUserByEmail(email).catch(() => null);
      if (byEmail) {
        return res.status(409).json({
          success: false,
          error: "That email already has a login in this app. Please use a different email.",
        });
      }

      const phoneNumber = `+91${last10(tenant.phone)}`;
      let user: admin.auth.UserRecord;
      const byPhone = await admin.auth().getUserByPhoneNumber(phoneNumber).catch(() => null);
      if (byPhone && !byPhone.email) {
        // Left over from the old phone-OTP login - reuse it, add the email.
        user = await admin.auth().updateUser(byPhone.uid, {
          email,
          password: generateTempPassword() + generateTempPassword(),
          displayName: tenant.name,
        });
      } else if (byPhone) {
        return res.status(409).json({ success: false, error: "This mobile number already has a different login." });
      } else {
        user = await admin.auth().createUser({
          email,
          phoneNumber,
          password: generateTempPassword() + generateTempPassword(),
          displayName: tenant.name,
        });
      }
      await admin.auth().setCustomUserClaims(user.uid, { role: "tenant", tenantId: snap.id });
      await ref.update({ authUid: user.uid, email, updatedAt: nowIso() });
      res.json({ success: true, email, existing: false });
    } catch (err: any) {
      console.error("Tenant login creation error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Owner/staff viewing a tenant's Aadhaar copies (Tenant profile > KYC).
  app.get("/api/kyc/documents/:tenantId", async (req, res) => {
    const db = requireAdminDb(res);
    if (!db) return;
    try {
      const uid = await bearerUid(req);
      if (!uid) return res.status(401).json({ success: false, error: "Sign in required." });
      const tenantSnap = await db.collection("tenants").doc(req.params.tenantId).get();
      const tenant = tenantSnap.data();
      if (!tenant || !(await canAccessProperty(db, uid, tenant.propertyId))) {
        return res.status(403).json({ success: false, error: "Not allowed." });
      }
      const docSnap = await db.collection("kycDocuments").doc(tenantSnap.id).get();
      const d = docSnap.data() || {};
      res.json({ success: true, front: d.front || null, back: d.back || null, uploadedAt: d.uploadedAt || null });
    } catch (err: any) {
      console.error("KYC documents read error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/webhook/google-form", async (req, res) => {
    const db = requireAdminDb(res);
    if (!db) return;
    try {
      const payload = req.body;
      if (!payload.propertyId) {
        return res.status(400).json({ success: false, error: "propertyId is required." });
      }
      const tenant = await admitTenant(db, payload.propertyId, {
        name: payload.name || payload["Full Name"] || payload["Name"] || "New Applicant",
        phone: payload.phone || payload["Mobile Number"] || payload["Phone"] || "",
        email: payload.email || payload["Email Address"],
        aadhaarNumber: payload.aadhaar || payload["Aadhaar Number"],
        city: payload.city || payload["City / State"],
        companyOrCollege: payload.college || payload["Company / College"],
        emergencyContactPhone: payload.emergency || payload["Emergency Contact"],
      });
      res.json({ success: true, message: "Google Form response synchronized - pending owner KYC review.", tenant });
    } catch (err: any) {
      console.error("Google Form Webhook error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/import/google-forms", async (req, res) => {
    const db = requireAdminDb(res);
    if (!db) return;
    try {
      const { rows, propertyId } = req.body;
      if (!propertyId) {
        return res.status(400).json({ success: false, message: "propertyId is required." });
      }
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ success: false, message: "No data rows provided." });
      }

      let importedCount = 0;
      for (const row of rows) {
        await admitTenant(db, propertyId, {
          name: row.name || row.Name || row["Full Name"] || `Applicant ${importedCount + 1}`,
          phone: row.phone || row.Phone || row["Mobile Number"] || "",
          email: row.email || row.Email,
          aadhaarNumber: row.aadhaar || row.Aadhaar,
          city: row.city || row.City,
          companyOrCollege: row.companyOrCollege,
          foodPreference: row.food,
        });
        importedCount++;
      }

      res.json({ success: true, count: importedCount, message: `Imported ${importedCount} tenants - all pending owner KYC review.` });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ----------------------------------------------------
  // Twilio: WhatsApp dues reminders & KYC-invite messages.
  // Real feature (not auth - tenant/owner login now goes through Firebase
  // Auth). Falls back to a dry-run "preview" response if keys aren't set.
  // ----------------------------------------------------
  const getTwilioClient = () => {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    return sid && token ? twilio(sid, token) : null;
  };

  app.post("/api/send-whatsapp-reminder", async (req, res) => {
    const { phone, tenantName, amountDue } = req.body;
    const client = getTwilioClient();
    const fromWhatsApp = process.env.TWILIO_WHATSAPP_NUMBER;
    const messageBody = `Hi ${tenantName}, this is a reminder that your PG rent of Rs. ${amountDue} is due. Please pay at your earliest convenience.`;

    if (client && fromWhatsApp) {
      try {
        await client.messages.create({
          body: messageBody,
          from: fromWhatsApp,
          to: `whatsapp:${phone.startsWith("+") ? phone : "+91" + phone.replace(/\D/g, "")}`,
        });
        res.json({ success: true, message: "WhatsApp reminder sent via Twilio." });
      } catch (error: any) {
        console.error("WhatsApp reminder send error:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    } else {
      res.json({ success: true, warning: "Twilio keys missing - simulation mode.", previewMessage: messageBody });
    }
  });

  app.post("/api/send-whatsapp-invite", async (req, res) => {
    const { phone, tenantName, roomNumber, inviteUrl } = req.body;
    const client = getTwilioClient();
    const fromWhatsApp = process.env.TWILIO_WHATSAPP_NUMBER;
    const messageBody = `Hello ${tenantName}! You have been assigned Room ${roomNumber || "TBD"}.\nPlease complete your Digital KYC via the secure link below:\n\n${inviteUrl}\n\nAfter submitting, log in to the Tenant Portal with your mobile number (+91 ${phone.replace(/\D/g, "")}) using OTP.`;

    if (client && fromWhatsApp) {
      try {
        await client.messages.create({
          body: messageBody,
          from: fromWhatsApp,
          to: `whatsapp:${phone.startsWith("+") ? phone : "+91" + phone.replace(/\D/g, "")}`,
        });
        res.json({ success: true, message: "WhatsApp invitation sent via Twilio." });
      } catch (error: any) {
        console.error("WhatsApp invitation send error:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    } else {
      res.json({ success: true, warning: "Twilio WhatsApp keys missing - simulation mode.", previewMessage: messageBody });
    }
  });

  // Safety nets so a client always gets JSON back, never a hosting
  // platform's generic HTML error page. Scoped to /api so this doesn't
  // swallow the frontend's own routes when server.ts mounts this whole app
  // as global middleware for local dev (Vercel only ever routes /api/*
  // here anyway, but local dev needs every non-API path to fall through to
  // Vite/static serving instead of hitting this catch-all).
  app.use("/api", (req, res) => {
    res.status(404).json({ success: false, error: `No route for ${req.method} ${req.path}` });
  });
  app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Unhandled API error:", err);
    res.status(500).json({ success: false, error: err?.message || "Internal server error" });
  });

  return app;
}
