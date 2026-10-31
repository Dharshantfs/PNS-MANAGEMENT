import crypto from "node:crypto";
import express from "express";
import twilio from "twilio";
import admin from "firebase-admin";

// ---------------------------------------------------------------------------
// Server-side API (Express). Reused by server.ts (local / long-running Node)
// and api/index.ts (Vercel serverless function).
//
// Security model:
// - Owner/staff calls carry a Firebase ID token (Authorization: Bearer ...)
//   and must have access to the property they act on (staffForProperty).
// - Tenants opening a KYC invite link are not signed in. They prove they
//   were sent the link with the tenant's secret `inviteToken` (generated
//   when the tenant is created, only readable by owner/staff and the tenant
//   themself). A tenant id + phone number is NOT enough any more.
// - Public self-registration (no token, no login) may create an applicant
//   record but never takes a bed - owner/staff assign beds.
// - Google Form webhooks use a per-property secret key kept in
//   propertySecrets/{propertyId} (server-only, no Firestore rule).
// ---------------------------------------------------------------------------

function initFirebaseAdmin() {
  if (admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    console.warn("FIREBASE_ADMIN_* env vars not set - server endpoints that need the database are disabled.");
    return null;
  }

  // Never let a malformed env var crash the whole function at cold start.
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

type Db = FirebaseFirestore.Firestore;

const nowIso = () => new Date().toISOString();

// Calendar dates are always India time - toISOString() is UTC, which gives
// the previous day for anything done between 00:00 and 05:30 IST.
export const todayIST = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date()
  );
const monthLabelIST = () =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", month: "long", year: "numeric" }).format(new Date());

const newToken = () => crypto.randomBytes(24).toString("base64url");

function safeEqual(a: unknown, b: unknown): boolean {
  const A = Buffer.from(String(a ?? ""));
  const B = Buffer.from(String(b ?? ""));
  return A.length > 0 && A.length === B.length && crypto.timingSafeEqual(A, B);
}

const last10 = (p: unknown) => String(p ?? "").replace(/\D/g, "").slice(-10);

function normalizePhone(phone: string): string {
  return `+91${last10(phone)}`;
}

// One-time password for a newly invited admin/staff account (they must
// change it on first login - see ChangePasswordScreen.tsx).
function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 12; i++) out += chars[crypto.randomInt(chars.length)];
  return out;
}

// Best-effort per-instance limiter for the public (signed-out) endpoints.
// Serverless instances don't share memory, so this only slows down bursts
// from one client - the real protection is the invite token / no-bed rule.
const hits = new Map<string, { count: number; resetAt: number }>();
function rateLimited(req: express.Request, key: string, max: number, windowMs: number): boolean {
  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  const id = `${key}:${ip}`;
  const now = Date.now();
  const entry = hits.get(id);
  if (!entry || entry.resetAt < now) {
    hits.set(id, { count: 1, resetAt: now + windowMs });
    if (hits.size > 5000) hits.clear();
    return false;
  }
  entry.count++;
  return entry.count > max;
}

function emptyKyc(overrides: Record<string, any>) {
  const aadhaarNumber = String(overrides.aadhaarNumber || "").replace(/\D/g, "");
  return {
    status: "pending", // Always owner-reviewed - see types.ts KYCVerificationMethod
    submittedAt: todayIST(),
    verifiedByOwner: false,
    aadhaar: {
      aadhaarNumber,
      aadhaarLast4: aadhaarNumber.slice(-4),
      nameOnAadhaar: String(overrides.nameOnAadhaar || overrides.name || "").toUpperCase(),
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
    ...(overrides.bloodGroup ? { bloodGroup: String(overrides.bloodGroup) } : {}),
  };
}

// Creates a tenant. With `allocateBed`, a vacant bed (preferring the given
// bed / room, skipping rooms not available for rent) is taken in the same
// transaction, so two admissions can never get the same bed.
async function admitTenant(
  db: Db,
  propertyId: string,
  fields: {
    name: string;
    phone: string;
    email?: string;
    preferredRoomId?: string;
    preferredBedId?: string;
    hometown?: string;
    [key: string]: any;
  },
  opts: { allocateBed: boolean }
) {
  const phone = normalizePhone(fields.phone);
  const tenantRef = db.collection("tenants").doc();
  const today = todayIST();

  return db.runTransaction(async (tx) => {
    let room: any = null;
    let bed: any = null;

    if (opts.allocateBed) {
      const roomsSnap = await tx.get(db.collection("rooms").where("propertyId", "==", propertyId));
      const rooms = roomsSnap.docs
        .map((d) => ({ ref: d.ref, id: d.id, ...(d.data() as any) }))
        .filter((r) => r.availableForRent !== false && Array.isArray(r.beds));
      const ordered = [
        ...rooms.filter((r) => r.id === fields.preferredRoomId),
        ...rooms.filter((r) => r.id !== fields.preferredRoomId),
      ];
      for (const r of ordered) {
        const idx =
          fields.preferredBedId && r.beds.some((b: any) => b.id === fields.preferredBedId && b.status === "vacant")
            ? r.beds.findIndex((b: any) => b.id === fields.preferredBedId)
            : r.beds.findIndex((b: any) => b.status === "vacant");
        if (idx === -1) continue;
        const beds = r.beds.map((b: any, i: number) =>
          i === idx ? { ...b, status: "occupied", tenantId: tenantRef.id, tenantName: fields.name, lastUpdated: nowIso() } : b
        );
        tx.update(r.ref, { beds });
        room = r;
        bed = beds[idx];
        break;
      }
    }

    const rent = bed ? bed.pricePerMonth || room?.pricePerBed || 0 : 0; // 0 = owner sets it
    const tenant: Record<string, any> = {
      id: tenantRef.id,
      propertyId,
      name: fields.name,
      email: fields.email ? String(fields.email).trim().toLowerCase() : "",
      phone,
      photoUrl: "",
      floor: room?.floor || 1,
      monthlyRent: rent,
      securityDeposit: room?.securityDeposit || 0,
      depositPaid: false,
      depositReceived: 0,
      checkInDate: today,
      rentStatus: rent > 0 ? "due" : "paid",
      dueAmount: rent, // first month, billed at admission
      ...(rent > 0 ? { lastRentPeriod: today.slice(0, 7) } : {}),
      hometown: fields.hometown || fields.city || "",
      kyc: emptyKyc(fields),
      inviteToken: newToken(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    if (room && bed) {
      Object.assign(tenant, { roomId: room.id, roomNumber: room.roomNumber, bedId: bed.id, bedLabel: bed.bedLabel });
    } else if (fields.preferredRoomId) {
      tenant.preferredRoomId = String(fields.preferredRoomId);
    }
    tx.set(tenantRef, tenant);
    if (rent > 0) {
      // The first month's rent is a charge like any other, so the tenant's
      // statement (charges - payments) adds up to their dues.
      tx.set(db.collection("charges").doc(), {
        propertyId,
        tenantId: tenantRef.id,
        tenantName: fields.name,
        categoryId: "auto-rent",
        categoryName: `Rent - ${monthLabelIST()} (first month)`,
        categoryType: "rent",
        amount: rent,
        date: today,
        addedBy: "system",
      });
    }
    return tenant;
  });
}

// What a signed-out visitor holding a valid invite link may see about the
// tenant: enough to pre-fill the form, never the full Aadhaar number, dues
// or anyone else's data.
function inviteView(id: string, t: any) {
  const kyc = t.kyc || {};
  const aadhaar = kyc.aadhaar || {};
  return {
    id,
    propertyId: t.propertyId,
    name: t.name || "",
    phoneLast4: last10(t.phone).slice(-4),
    email: t.email || "",
    roomId: t.roomId || null,
    roomNumber: t.roomNumber || null,
    bedLabel: t.bedLabel || null,
    floor: t.floor || 1,
    monthlyRent: t.monthlyRent || 0,
    securityDeposit: t.securityDeposit || 0,
    checkInDate: t.checkInDate || "",
    hasLogin: !!t.authUid,
    kyc: {
      status: kyc.status || "unsubmitted",
      fatherName: kyc.fatherName || "",
      emergencyContactName: kyc.emergencyContactName || "",
      emergencyContactPhone: kyc.emergencyContactPhone || "",
      emergencyContactRelation: kyc.emergencyContactRelation || "",
      permanentAddress: kyc.permanentAddress || "",
      city: kyc.city || "",
      state: kyc.state || "",
      pincode: kyc.pincode || "",
      occupation: kyc.occupation || "Working Professional",
      companyOrCollege: kyc.companyOrCollege || "",
      foodPreference: kyc.foodPreference || "Veg",
      bloodGroup: kyc.bloodGroup || "",
      aadhaar: {
        aadhaarLast4: aadhaar.aadhaarLast4 || "",
        nameOnAadhaar: aadhaar.nameOnAadhaar || "",
        dob: aadhaar.dob || "",
        gender: aadhaar.gender || "",
        address: aadhaar.address || "",
        frontImageUrl: aadhaar.frontImageUrl ? "uploaded" : "",
        backImageUrl: aadhaar.backImageUrl ? "uploaded" : "",
        rejectionReason: aadhaar.rejectionReason || "",
      },
    },
  };
}

export function createApiApp() {
  const app = express();

  // Two compressed Aadhaar photos (~450 KB of base64 each) is the largest body.
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));

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

  // --- Auth helpers ---------------------------------------------------------

  const verifyBearer = async (req: express.Request) => {
    const h = req.headers.authorization || "";
    if (!h.startsWith("Bearer ")) return null;
    try {
      return await admin.auth().verifyIdToken(h.slice(7));
    } catch {
      return null;
    }
  };

  // Owner/staff: a users/{uid} profile, and not a tenant login.
  const staffFromRequest = async (db: Db, req: express.Request) => {
    const decoded = await verifyBearer(req);
    if (!decoded || decoded.role === "tenant") return null;
    const snap = await db.collection("users").doc(decoded.uid).get();
    if (!snap.exists) return null;
    return { uid: decoded.uid, profile: snap.data() as Record<string, any> };
  };

  const canAccessProperty = async (db: Db, uid: string, profile: Record<string, any>, propertyId: string) => {
    if (!propertyId) return false;
    if ((profile.propertyIds || []).includes(propertyId)) return true;
    const propSnap = await db.collection("properties").doc(propertyId).get();
    return propSnap.exists && propSnap.data()?.ownerId === uid;
  };

  // Returns the staff caller if they may act on `propertyId`, else null.
  const staffForProperty = async (db: Db, req: express.Request, propertyId: string) => {
    const staff = await staffFromRequest(db, req);
    if (!staff) return null;
    return (await canAccessProperty(db, staff.uid, staff.profile, propertyId)) ? staff : null;
  };

  // Loads a tenant for an onboarding call: allowed with the tenant's invite
  // token, or for owner/staff of the tenant's property.
  const tenantForInvite = async (db: Db, req: express.Request, tenantId: unknown, token: unknown) => {
    if (!tenantId) return { status: 400, error: "tenantId is required." } as const;
    const ref = db.collection("tenants").doc(String(tenantId));
    let snap = await ref.get();
    // A tenant just created from the owner's browser may take a moment to land.
    for (let i = 0; i < 3 && !snap.exists; i++) {
      await new Promise((r) => setTimeout(r, 700));
      snap = await ref.get();
    }
    const tenant = snap.data();
    if (!snap.exists || !tenant) {
      return { status: 404, error: "This KYC link is no longer valid - ask the PG office for a new link." } as const;
    }
    if (token && tenant.inviteToken && safeEqual(token, tenant.inviteToken)) {
      return { ref, snap, tenant, staff: null } as const;
    }
    const staff = await staffForProperty(db, req, tenant.propertyId);
    if (staff) return { ref, snap, tenant, staff } as const;
    return {
      status: 403,
      error: "This KYC link is not valid any more. Please ask the PG office to send you a new link.",
    } as const;
  };

  // ----------------------------------------------------
  // Admin/staff account provisioning (Settings > Team Access).
  // Named without the word "admin" in the path - Vercel's firewall blocks
  // paths containing "/admin/" before they reach the function.
  // ----------------------------------------------------
  app.post("/api/team/invite", async (req, res) => {
    const db = requireAdminDb(res);
    if (!db) return;
    try {
      const staff = await staffFromRequest(db, req);
      if (!staff) return res.status(401).json({ success: false, error: "Sign in required." });
      const callerProfile = staff.profile;
      if (callerProfile.role !== "owner") {
        return res.status(403).json({ success: false, error: "Only an existing owner can add admin/staff accounts." });
      }

      const name = String(req.body?.name || "").trim();
      const email = String(req.body?.email || "").trim().toLowerCase();
      const role = req.body?.role;
      if (!name || !email || (role !== "owner" && role !== "staff")) {
        return res.status(400).json({ success: false, error: "name, email, and role ('owner' or 'staff') are required." });
      }

      // Every property the caller can access: the ones they created plus
      // the ones they were invited to.
      const ownedSnap = await db.collection("properties").where("ownerId", "==", staff.uid).get();
      const propertyIds: string[] = Array.from(
        new Set([...ownedSnap.docs.map((d) => d.id), ...(callerProfile.propertyIds || [])])
      );

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
        const existingIds: string[] = profileSnap.data()?.propertyIds || [];
        // Only change the role of someone who already works on one of the
        // caller's properties - never re-role another owner's team member.
        const sharesProperty = existingIds.some((id) => propertyIds.includes(id));
        await profileRef.update({
          ...(sharesProperty ? { role } : {}),
          propertyIds: Array.from(new Set([...existingIds, ...propertyIds])),
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

      await Promise.all(
        propertyIds.map((propertyId) =>
          db
            .collection("activityLogs")
            .add({
              propertyId,
              actorUid: staff.uid,
              actorName: callerProfile.name || callerProfile.email || "Unknown",
              actorRole: callerProfile.role,
              action: "team.invite",
              summary: existingUser ? `Updated ${name}'s team access (${role})` : `Invited ${name} (${role}) to the team`,
              createdAt: nowIso(),
            })
            .catch((err: any) => console.warn("team.invite activity log failed:", err))
        )
      );

      res.json({ success: true, email, existing: !!existingUser, tempPassword, propertyCount: propertyIds.length });
    } catch (err: any) {
      console.error("create-team-member error:", err);
      const message = err.code === "auth/email-already-exists" ? "That email is already registered." : "Could not add the team member.";
      res.status(500).json({ success: false, error: message });
    }
  });

  // Called right after an owner creates a property so the rest of the team
  // gets it too.
  app.post("/api/team/share-property", async (req, res) => {
    const db = requireAdminDb(res);
    if (!db) return;
    try {
      const staff = await staffFromRequest(db, req);
      if (!staff) return res.status(401).json({ success: false, error: "Sign in required." });
      const propertyId = String(req.body?.propertyId || "");
      const propSnap = await db.collection("properties").doc(propertyId).get();
      if (!propSnap.exists || propSnap.data()?.ownerId !== staff.uid) {
        return res.status(403).json({ success: false, error: "Only the property's creator can share it." });
      }

      const ownedSnap = await db.collection("properties").where("ownerId", "==", staff.uid).get();
      const otherIds = Array.from(
        new Set([...ownedSnap.docs.map((d) => d.id), ...(staff.profile.propertyIds || [])])
      ).filter((id) => id !== propertyId);

      const teamUids = new Set<string>();
      for (let i = 0; i < otherIds.length; i += 30) {
        const chunk = otherIds.slice(i, i + 30);
        const members = await db.collection("users").where("propertyIds", "array-contains-any", chunk).get();
        members.docs.forEach((d) => teamUids.add(d.id));
      }
      const otherProps = await Promise.all(otherIds.map((id) => db.collection("properties").doc(id).get()));
      otherProps.forEach((p) => p.data()?.ownerId && teamUids.add(p.data()!.ownerId));
      teamUids.delete(staff.uid);

      let shared = 0;
      for (const uid of teamUids) {
        const ref = db.collection("users").doc(uid);
        const snap = await ref.get();
        if (!snap.exists) continue;
        await ref.update({ propertyIds: admin.firestore.FieldValue.arrayUnion(propertyId) });
        shared++;
      }
      res.json({ success: true, sharedWith: shared });
    } catch (err: any) {
      console.error("share-property error:", err);
      res.status(500).json({ success: false, error: "Could not share the property with the team." });
    }
  });

  // ----------------------------------------------------
  // Public onboarding (KYC invite links and self-registration)
  // ----------------------------------------------------

  // Property name + vacant-room options for the public form. No resident
  // names or numbers.
  app.get("/api/onboard/property/:propertyId", async (req, res) => {
    const db = requireAdminDb(res);
    if (!db) return;
    try {
      if (rateLimited(req, "property", 60, 60_000)) {
        return res.status(429).json({ success: false, error: "Too many requests - please wait a minute." });
      }
      // "default" = the first PG created (registration from the login screen,
      // which has no ?property= in its link).
      const propSnap =
        req.params.propertyId === "default"
          ? (await db.collection("properties").orderBy("createdAt", "asc").limit(1).get()).docs[0]
          : await db.collection("properties").doc(req.params.propertyId).get();
      const prop = propSnap?.data();
      if (!propSnap || !propSnap.exists || !prop) return res.status(404).json({ success: false, error: "PG not found." });
      const roomsSnap = await db.collection("rooms").where("propertyId", "==", propSnap.id).get();
      const sharingLabel = (id: string) => (prop.sharingOptions || []).find((s: any) => s.id === id)?.label || "";
      const rooms = roomsSnap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((r) => r.availableForRent !== false)
        .map((r) => ({
          id: r.id,
          roomNumber: r.roomNumber,
          floor: r.floor,
          sharingLabel: sharingLabel(r.sharingId),
          pricePerBed: r.pricePerBed || 0,
          vacant: (r.beds || []).filter((b: any) => b.status === "vacant").length,
        }))
        .filter((r) => r.vacant > 0)
        .sort((a, b) => a.floor - b.floor || String(a.roomNumber).localeCompare(String(b.roomNumber), undefined, { numeric: true }));
      res.json({ success: true, property: { id: propSnap.id, name: prop.name || "", city: prop.city || "" }, rooms });
    } catch (err: any) {
      console.error("onboard/property error:", err);
      res.status(500).json({ success: false, error: "Could not load the PG details." });
    }
  });

  // Invite link (?onboard=<tenantId>&t=<token>): who is this link for.
  app.post("/api/onboard/lookup", async (req, res) => {
    const db = requireAdminDb(res);
    if (!db) return;
    try {
      if (rateLimited(req, "lookup", 30, 60_000)) {
        return res.status(429).json({ success: false, error: "Too many attempts - please wait a minute." });
      }
      const found = await tenantForInvite(db, req, req.body?.tenantId, req.body?.token);
      if ("error" in found) return res.status(found.status).json({ success: false, error: found.error });
      const propSnap = await db.collection("properties").doc(found.tenant.propertyId).get();
      res.json({
        success: true,
        tenant: inviteView(found.snap.id, found.tenant),
        property: { id: propSnap.id, name: propSnap.data()?.name || "" },
      });
    } catch (err: any) {
      console.error("onboard/lookup error:", err);
      res.status(500).json({ success: false, error: "Could not open this link." });
    }
  });

  // New resident. Two callers:
  // - Owner/staff (Google Forms admission screen): bed is allocated.
  // - A signed-out visitor self-registering: creates an applicant with no
  //   bed (the owner assigns one), and returns the new record's invite token
  //   so the same visitor can upload their Aadhaar photos and set up a login.
  app.post("/api/onboard/submit", async (req, res) => {
    const db = requireAdminDb(res);
    if (!db) return;
    try {
      const data = req.body || {};
      const propertyId = String(data.propertyId || "");
      if (!propertyId) return res.status(400).json({ success: false, error: "propertyId is required." });
      const propSnap = await db.collection("properties").doc(propertyId).get();
      if (!propSnap.exists) return res.status(404).json({ success: false, error: "PG not found." });

      const staff = await staffForProperty(db, req, propertyId);
      const name = String(data.name || data.nameOnAadhaar || "").trim();
      if (!name || last10(data.phone).length !== 10) {
        return res.status(400).json({ success: false, error: "Name and a 10-digit mobile number are required." });
      }

      if (!staff) {
        if (rateLimited(req, "register", 5, 10 * 60_000)) {
          return res.status(429).json({ success: false, error: "Too many registrations from this device - please try later." });
        }
        const existing = await db
          .collection("tenants")
          .where("propertyId", "==", propertyId)
          .where("phone", "==", normalizePhone(data.phone))
          .get();
        if (existing.docs.some((d) => !d.data().checkOutDate)) {
          return res.status(409).json({
            success: false,
            error: "This mobile number is already registered here. Please use the KYC link the PG office sent you, or ask them to resend it.",
          });
        }
      }

      const tenant = await admitTenant(
        db,
        propertyId,
        {
          name,
          phone: data.phone,
          email: data.email,
          preferredRoomId: data.roomId,
          preferredBedId: staff ? data.bedId : undefined,
          hometown: data.hometown,
          aadhaarNumber: data.aadhaar?.aadhaarNumber || data.aadhaarNumber,
          nameOnAadhaar: data.aadhaar?.nameOnAadhaar || data.nameOnAadhaar,
          dob: data.aadhaar?.dob || data.dob,
          gender: data.aadhaar?.gender || data.gender,
          address: data.aadhaar?.address || data.permanentAddress,
          fatherName: data.fatherName,
          emergencyContactName: data.emergencyContactName || data.emergencyName,
          emergencyContactPhone: data.emergencyContactPhone || data.emergencyPhone,
          emergencyContactRelation: data.emergencyContactRelation,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          occupation: data.occupation,
          companyOrCollege: data.companyOrCollege,
          foodPreference: data.foodPreference || data.foodPref,
          bloodGroup: data.bloodGroup,
        },
        { allocateBed: !!staff }
      );

      await db
        .collection("activityLogs")
        .add({
          propertyId,
          actorUid: staff?.uid || "",
          actorName: staff ? staff.profile.name || staff.profile.email || "Staff" : name,
          actorRole: staff ? staff.profile.role : "tenant",
          action: "tenant.add",
          summary: staff ? `Admitted ${name} from Google Forms` : `${name} self-registered (awaiting a bed)`,
          createdAt: nowIso(),
        })
        .catch((err: any) => console.warn("onboard/submit activity log failed:", err));

      res.json({
        success: true,
        message: staff ? "Tenant admitted - pending owner KYC review." : "Registration received - the PG office will assign your bed.",
        tenant: inviteView(tenant.id, tenant),
        inviteToken: tenant.inviteToken,
      });
    } catch (err: any) {
      console.error("Onboarding error:", err);
      res.status(500).json({ success: false, error: "Could not save the registration - please try again." });
    }
  });

  // KYC details from an invite link (or entered by owner/staff).
  app.post("/api/onboard/kyc", async (req, res) => {
    const db = requireAdminDb(res);
    if (!db) return;
    try {
      const { tenantId, token, kyc } = req.body || {};
      if (!kyc) return res.status(400).json({ success: false, error: "kyc is required." });
      const found = await tenantForInvite(db, req, tenantId, token);
      if ("error" in found) return res.status(found.status).json({ success: false, error: found.error });
      const { ref, snap, tenant, staff } = found;
      if (!staff && tenant.kyc?.status === "verified") {
        return res.status(409).json({
          success: false,
          error: "Your KYC is already verified. Contact the PG office if something needs to change.",
        });
      }

      const str = (v: any) => (v == null ? "" : String(v));
      const aadhaarNumber = str(kyc.aadhaar?.aadhaarNumber).replace(/\D/g, "");
      if (aadhaarNumber.length !== 12) {
        return res.status(400).json({ success: false, error: "Please enter your full 12-digit Aadhaar number." });
      }
      // A resubmission clears the previous rejection reason.
      const { rejectionReason: _oldReason, ...previousAadhaar } = tenant.kyc?.aadhaar || {};
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
        // Always lands as pending - the owner reviews it.
        status: "pending",
        verifiedByOwner: false,
        submittedAt: todayIST(),
        aadhaar: {
          ...previousAadhaar,
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
      if (kyc.email) updates.email = str(kyc.email).trim().toLowerCase();
      await ref.update(updates);

      await db
        .collection("activityLogs")
        .add({
          propertyId: tenant.propertyId,
          actorUid: staff?.uid || "",
          actorName: staff ? staff.profile.name || "Staff" : tenant.name || "Tenant",
          actorRole: staff ? staff.profile.role : "tenant",
          action: "kyc.submit",
          summary: staff
            ? `Submitted KYC for ${tenant.name || "a tenant"}`
            : `${tenant.name || "Tenant"} submitted KYC from the invite link`,
          createdAt: nowIso(),
        })
        .catch((err: any) => console.warn("kyc.submit activity log failed:", err));

      const fresh = await ref.get();
      res.json({ success: true, tenant: inviteView(snap.id, fresh.data()) });
    } catch (err: any) {
      console.error("Onboarding KYC error:", err);
      res.status(500).json({ success: false, error: "Could not save your KYC - please try again." });
    }
  });

  // Aadhaar front/back copies, stored server-side only in kycDocuments/{id}.
  const MAX_DOC_CHARS = 450_000; // per image, ~330 KB JPEG
  app.post("/api/onboard/kyc-docs", async (req, res) => {
    const db = requireAdminDb(res);
    if (!db) return;
    try {
      const { tenantId, token, front, back } = req.body || {};
      if (!front && !back) {
        return res.status(400).json({ success: false, error: "At least one image is required." });
      }
      for (const img of [front, back]) {
        if (img && (typeof img !== "string" || !img.startsWith("data:image/") || img.length > MAX_DOC_CHARS)) {
          return res.status(400).json({ success: false, error: "Each Aadhaar copy must be an image under about 300 KB." });
        }
      }
      const found = await tenantForInvite(db, req, tenantId, token);
      if ("error" in found) return res.status(found.status).json({ success: false, error: found.error });
      const { ref, snap, tenant, staff } = found;
      if (!staff && tenant.kyc?.status === "verified") {
        return res.status(409).json({ success: false, error: "Your KYC is already verified." });
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
      res.status(500).json({ success: false, error: "Could not upload the photos - please try again." });
    }
  });

  // Tenant portal login (email + password), created after KYC. Needs the
  // invite token (or owner/staff). A tenant that already has a login is
  // left alone, so nobody can swap in their own email.
  app.post("/api/onboard/tenant-login", async (req, res) => {
    const db = requireAdminDb(res);
    if (!db) return;
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return res.status(400).json({ success: false, error: "A valid email is required." });
      }
      const found = await tenantForInvite(db, req, req.body?.tenantId, req.body?.token);
      if ("error" in found) return res.status(found.status).json({ success: false, error: found.error });
      const { ref, snap, tenant } = found;

      if (tenant.authUid) {
        const existing = await admin.auth().getUser(tenant.authUid).catch(() => null);
        if (existing?.email) return res.json({ success: true, email: existing.email, existing: true });
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
          password: newToken(),
          displayName: tenant.name,
        });
      } else if (byPhone) {
        return res.status(409).json({ success: false, error: "This mobile number already has a different login." });
      } else {
        // No phone number on the account: an email login never proves a
        // phone number, so the tenant is identified by the tenantId claim.
        user = await admin.auth().createUser({
          email,
          password: newToken(),
          displayName: tenant.name,
        });
      }
      await admin.auth().setCustomUserClaims(user.uid, { role: "tenant", tenantId: snap.id });
      // The invite link has done its job - a new token makes the old link
      // stop working (the tenant uses the Tenant Portal login from now on).
      await ref.update({ authUid: user.uid, email, inviteToken: newToken(), updatedAt: nowIso() });
      res.json({ success: true, email, existing: false });
    } catch (err: any) {
      console.error("Tenant login creation error:", err);
      res.status(500).json({ success: false, error: "Could not set up the login." });
    }
  });

  // Deleting a tenant record also frees their login. Only ever removes an
  // account whose claims say it is a tenant login.
  app.post("/api/tenant/remove-login", async (req, res) => {
    const db = requireAdminDb(res);
    if (!db) return;
    try {
      const staff = await staffFromRequest(db, req);
      if (!staff) return res.status(401).json({ success: false, error: "Sign in required." });
      if (staff.profile.role !== "owner") {
        return res.status(403).json({ success: false, error: "Only an admin can remove a tenant login." });
      }
      const tenant = (await db.collection("tenants").doc(String(req.body?.tenantId)).get()).data();
      if (!tenant) return res.json({ success: true, removed: false });
      if (!(await canAccessProperty(db, staff.uid, staff.profile, tenant.propertyId))) {
        return res.status(403).json({ success: false, error: "Not allowed." });
      }
      if (!tenant.authUid) return res.json({ success: true, removed: false });
      const user = await admin.auth().getUser(tenant.authUid).catch(() => null);
      if (!user) return res.json({ success: true, removed: false });
      if (user.customClaims?.role !== "tenant") {
        return res.json({ success: true, removed: false, note: "Linked account is not a tenant login - left untouched." });
      }
      await admin.auth().deleteUser(user.uid);
      res.json({ success: true, removed: true });
    } catch (err: any) {
      console.error("Tenant login removal error:", err);
      res.status(500).json({ success: false, error: "Could not remove the tenant login." });
    }
  });

  // Owner/staff viewing a tenant's Aadhaar copies (Tenant profile > KYC).
  app.get("/api/kyc/documents/:tenantId", async (req, res) => {
    const db = requireAdminDb(res);
    if (!db) return;
    try {
      const tenantSnap = await db.collection("tenants").doc(req.params.tenantId).get();
      const tenant = tenantSnap.data();
      if (!tenant || !(await staffForProperty(db, req, tenant.propertyId))) {
        return res.status(403).json({ success: false, error: "Not allowed." });
      }
      const docSnap = await db.collection("kycDocuments").doc(tenantSnap.id).get();
      const d = docSnap.data() || {};
      res.json({ success: true, front: d.front || null, back: d.back || null, uploadedAt: d.uploadedAt || null });
    } catch (err: any) {
      console.error("KYC documents read error:", err);
      res.status(500).json({ success: false, error: "Could not load the documents." });
    }
  });

  // A signed-in tenant's roommates (same room, still staying). Only the
  // fields the Roommates screen shows - never KYC numbers or dues.
  app.get("/api/tenant/roommates", async (req, res) => {
    const db = requireAdminDb(res);
    if (!db) return;
    try {
      const decoded = await verifyBearer(req);
      const tenantId = decoded?.role === "tenant" ? String(decoded.tenantId || "") : "";
      if (!tenantId) return res.status(401).json({ success: false, error: "Tenant sign-in required." });
      const me = (await db.collection("tenants").doc(tenantId).get()).data();
      if (!me?.roomId) return res.json({ success: true, roommates: [] });
      const snap = await db
        .collection("tenants")
        .where("propertyId", "==", me.propertyId)
        .where("roomId", "==", me.roomId)
        .get();
      const roommates = snap.docs
        .filter((d) => d.id !== tenantId && !d.data().checkOutDate)
        .map((d) => {
          const t = d.data();
          return {
            id: d.id,
            name: t.name || "",
            phone: t.phone || "",
            roomId: t.roomId,
            roomNumber: t.roomNumber || "",
            bedLabel: t.bedLabel || "",
            checkInDate: t.checkInDate || "",
            hometown: t.hometown || "",
            kyc: {
              status: t.kyc?.status === "verified" ? "verified" : "pending",
              occupation: t.kyc?.occupation || "",
              companyOrCollege: t.kyc?.companyOrCollege || "",
              foodPreference: t.kyc?.foodPreference || "",
              city: t.kyc?.city || "",
            },
          };
        });
      res.json({ success: true, roommates });
    } catch (err: any) {
      console.error("Roommates error:", err);
      res.status(500).json({ success: false, error: "Could not load roommates." });
    }
  });

  // ----------------------------------------------------
  // Google Forms
  // ----------------------------------------------------

  // Per-property secret for the Google Form webhook URL (owner/staff only).
  app.post("/api/property/webhook-key", async (req, res) => {
    const db = requireAdminDb(res);
    if (!db) return;
    try {
      const propertyId = String(req.body?.propertyId || "");
      const staff = await staffForProperty(db, req, propertyId);
      if (!staff) return res.status(403).json({ success: false, error: "Not allowed." });
      const ref = db.collection("propertySecrets").doc(propertyId);
      const snap = await ref.get();
      let key = snap.data()?.webhookKey as string | undefined;
      if (!key || (req.body?.rotate && staff.profile.role === "owner")) {
        key = newToken();
        await ref.set({ webhookKey: key, updatedAt: nowIso() }, { merge: true });
      }
      res.json({ success: true, key });
    } catch (err: any) {
      console.error("webhook-key error:", err);
      res.status(500).json({ success: false, error: "Could not load the webhook key." });
    }
  });

  // Google Form "on submit" Apps Script posts here. Needs the property's
  // webhook key in the URL (?property=..&key=..), or an owner/staff login.
  app.post("/api/webhook/google-form", async (req, res) => {
    const db = requireAdminDb(res);
    if (!db) return;
    try {
      const payload = req.body || {};
      const propertyId = String(req.query.property || payload.propertyId || "");
      if (!propertyId) return res.status(400).json({ success: false, error: "propertyId is required." });

      let allowed = !!(await staffForProperty(db, req, propertyId));
      if (!allowed) {
        const key = req.query.key || req.headers["x-webhook-key"];
        const secret = (await db.collection("propertySecrets").doc(propertyId).get()).data()?.webhookKey;
        allowed = !!secret && safeEqual(key, secret);
      }
      if (!allowed) return res.status(403).json({ success: false, error: "Invalid webhook key." });

      const name = String(payload.name || payload["Full Name"] || payload["Name"] || "").trim() || "New Applicant";
      const phone = payload.phone || payload["Mobile Number"] || payload["Phone"] || "";
      if (last10(phone).length !== 10) {
        return res.status(400).json({ success: false, error: "A 10-digit mobile number is required." });
      }
      const tenant = await admitTenant(
        db,
        propertyId,
        {
          name,
          phone,
          email: payload.email || payload["Email Address"],
          aadhaarNumber: payload.aadhaar || payload["Aadhaar Number"],
          dob: payload.dob || payload["Date of Birth"],
          gender: payload.gender || payload["Gender"],
          city: payload.city || payload["City / State"] || payload["City"],
          state: payload.state || payload["State"],
          pincode: payload.pincode || payload["Pincode"],
          address: payload.address || payload["Permanent Address"],
          companyOrCollege: payload.college || payload["Company / College"] || payload["Company or College"],
          occupation: payload.occupation || payload["Occupation"],
          foodPreference: payload.food || payload["Food Preference"],
          emergencyContactName: payload.emergencyName || payload["Emergency Contact Name"],
          emergencyContactPhone: payload.emergency || payload["Emergency Contact"] || payload["Emergency Contact Phone"],
        },
        { allocateBed: true }
      );
      res.json({ success: true, message: "Google Form response synchronized - pending owner KYC review.", tenant: inviteView(tenant.id, tenant) });
    } catch (err: any) {
      console.error("Google Form Webhook error:", err);
      res.status(500).json({ success: false, error: "Could not process the form response." });
    }
  });

  app.post("/api/import/google-forms", async (req, res) => {
    const db = requireAdminDb(res);
    if (!db) return;
    try {
      const { rows, propertyId } = req.body || {};
      if (!propertyId) return res.status(400).json({ success: false, message: "propertyId is required." });
      if (!(await staffForProperty(db, req, String(propertyId)))) {
        return res.status(403).json({ success: false, message: "Not allowed." });
      }
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ success: false, message: "No data rows provided." });
      }
      if (rows.length > 200) {
        return res.status(400).json({ success: false, message: "Import at most 200 rows at a time." });
      }

      let importedCount = 0;
      let skipped = 0;
      for (const row of rows) {
        const phone = row.phone || row.Phone || row["Mobile Number"] || "";
        if (last10(phone).length !== 10) {
          skipped++;
          continue;
        }
        await admitTenant(
          db,
          String(propertyId),
          {
            name: row.name || row.Name || row["Full Name"] || `Applicant ${importedCount + 1}`,
            phone,
            email: row.email || row.Email,
            aadhaarNumber: row.aadhaar || row.Aadhaar,
            dob: row.dob,
            gender: row.gender,
            address: row.address,
            city: row.city || row.City,
            companyOrCollege: row.companyOrCollege,
            occupation: row.occupation,
            foodPreference: row.food,
            emergencyContactName: row.emergencyContactName,
            emergencyContactPhone: row.emergencyContactPhone,
          },
          { allocateBed: true }
        );
        importedCount++;
      }

      res.json({
        success: true,
        count: importedCount,
        message: `Imported ${importedCount} tenants - all pending owner KYC review.${skipped ? ` Skipped ${skipped} without a valid mobile number.` : ""}`,
      });
    } catch (err: any) {
      console.error("Google Forms import error:", err);
      res.status(500).json({ success: false, message: "Import failed." });
    }
  });

  // ----------------------------------------------------
  // WhatsApp (Twilio): rent reminders & KYC invites. Owner/staff only; the
  // phone number, name, amount and link all come from the database, never
  // from the request, so the sender can't be used to message anyone else.
  // ----------------------------------------------------
  const getTwilioClient = () => {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    return sid && token ? twilio(sid, token) : null;
  };

  const sendWhatsApp = async (res: express.Response, phone: string, body: string, okMessage: string) => {
    const client = getTwilioClient();
    const from = process.env.TWILIO_WHATSAPP_NUMBER;
    if (!client || !from) {
      return res.json({
        success: false,
        simulated: true,
        error: "WhatsApp sending isn't set up yet (Twilio keys missing). Copy the message and send it from WhatsApp instead.",
        previewMessage: body,
      });
    }
    try {
      await client.messages.create({ body, from, to: `whatsapp:+91${last10(phone)}` });
      res.json({ success: true, message: okMessage });
    } catch (error: any) {
      console.error("WhatsApp send error:", error);
      res.status(502).json({ success: false, error: "WhatsApp could not deliver the message." });
    }
  };

  const loadTenantForStaff = async (db: Db, req: express.Request, res: express.Response) => {
    const tenantId = String(req.body?.tenantId || "");
    const snap = tenantId ? await db.collection("tenants").doc(tenantId).get() : null;
    const tenant = snap?.data();
    if (!snap || !tenant) {
      res.status(404).json({ success: false, error: "Tenant not found." });
      return null;
    }
    if (!(await staffForProperty(db, req, tenant.propertyId))) {
      res.status(403).json({ success: false, error: "Not allowed." });
      return null;
    }
    return { ref: snap.ref, id: snap.id, tenant };
  };

  app.post("/api/send-whatsapp-reminder", async (req, res) => {
    const db = requireAdminDb(res);
    if (!db) return;
    try {
      const found = await loadTenantForStaff(db, req, res);
      if (!found) return;
      const { tenant } = found;
      const amount = Number(tenant.dueAmount || 0);
      if (amount <= 0) return res.status(400).json({ success: false, error: "This tenant has nothing due." });
      const pgName = (await db.collection("properties").doc(tenant.propertyId).get()).data()?.name || "your PG";
      const body = `Hi ${tenant.name}, this is a reminder from ${pgName} that your rent/dues of Rs. ${amount.toLocaleString(
        "en-IN"
      )} are pending. Please pay at your earliest convenience.`;
      await sendWhatsApp(res, tenant.phone, body, "WhatsApp reminder sent.");
    } catch (err: any) {
      console.error("WhatsApp reminder error:", err);
      res.status(500).json({ success: false, error: "Could not send the reminder." });
    }
  });

  app.post("/api/send-whatsapp-invite", async (req, res) => {
    const db = requireAdminDb(res);
    if (!db) return;
    try {
      const found = await loadTenantForStaff(db, req, res);
      if (!found) return;
      const { ref, id, tenant } = found;
      let token = tenant.inviteToken as string | undefined;
      if (!token) {
        token = newToken();
        await ref.update({ inviteToken: token, updatedAt: nowIso() });
      }
      const origin = /^https?:\/\/[^/\s]+$/.test(String(req.headers.origin || ""))
        ? String(req.headers.origin)
        : `https://${req.headers.host}`;
      const inviteUrl = `${origin}/?onboard=${id}&t=${token}`;
      const body = `Hello ${tenant.name}! You have been assigned Room ${tenant.roomNumber || "TBD"}.\nPlease complete your Digital KYC via the secure link below:\n\n${inviteUrl}\n\nAfter submitting, you'll get an email to set your password for the Tenant Portal.`;
      await sendWhatsApp(res, tenant.phone, body, "WhatsApp invitation sent.");
    } catch (err: any) {
      console.error("WhatsApp invite error:", err);
      res.status(500).json({ success: false, error: "Could not send the invitation." });
    }
  });

  // ----------------------------------------------------
  // Monthly rent (Vercel Cron, daily). For every property that has turned
  // on "Automatic monthly rent" in Settings, once the rent due day arrives
  // each staying resident is billed one month's rent - at most once per
  // month (tenant.lastRentPeriod), using any advance credit first.
  // Residents seen for the first time are only baselined (no charge), so
  // switching the setting on never double-bills the current month.
  // Requires the CRON_SECRET env var (Vercel sends it as a bearer token).
  // ----------------------------------------------------
  app.get("/api/cron/monthly-rent", async (req, res) => {
    const secret = process.env.CRON_SECRET;
    if (!secret) return res.status(503).json({ success: false, error: "CRON_SECRET is not set." });
    if (!safeEqual(req.headers.authorization, `Bearer ${secret}`)) {
      return res.status(401).json({ success: false, error: "Unauthorized." });
    }
    const db = requireAdminDb(res);
    if (!db) return;
    try {
      const today = todayIST();
      const period = today.slice(0, 7);
      const day = Number(today.slice(8, 10));
      const monthLabel = monthLabelIST();
      const summary = { properties: 0, billed: 0, baselined: 0 };

      const props = await db.collection("properties").where("autoMonthlyRent", "==", true).get();
      for (const prop of props.docs) {
        const dueDay = Math.min(28, Math.max(1, Number(prop.data().rentDueDay) || 1));
        if (day < dueDay) continue;
        if (prop.data().autoRentFrom && period < prop.data().autoRentFrom) continue;
        summary.properties++;
        const tenants = await db.collection("tenants").where("propertyId", "==", prop.id).get();
        for (const tDoc of tenants.docs) {
          const t = tDoc.data();
          if (t.checkOutDate || !t.bedId || !(Number(t.monthlyRent) > 0)) continue;
          if (t.lastRentPeriod && t.lastRentPeriod >= period) continue;

          // Admitted this month: the first month was billed at admission.
          // No billing history and auto rent has no start month: baseline only.
          // (Switching auto rent on sets autoRentFrom, so from that month on
          // residents without history ARE billed - none of them are skipped.)
          if (String(t.checkInDate || "").slice(0, 7) === period || (!t.lastRentPeriod && !prop.data().autoRentFrom)) {
            await tDoc.ref.update({ lastRentPeriod: period });
            summary.baselined++;
            continue;
          }

          const billed = await db.runTransaction(async (tx) => {
            const fresh = await tx.get(tDoc.ref);
            const ft = fresh.data();
            if (!ft || ft.checkOutDate || (ft.lastRentPeriod && ft.lastRentPeriod >= period)) return false;
            const rent = Number(ft.monthlyRent) || 0;
            const previousDue = Number(ft.dueAmount) || 0;
            const advance = Number(ft.advanceBalance) || 0;
            const fromAdvance = Math.min(advance, rent);
            const newDue = previousDue + rent - fromAdvance;
            tx.update(tDoc.ref, {
              dueAmount: newDue,
              advanceBalance: advance - fromAdvance,
              rentStatus: newDue <= 0 ? "paid" : previousDue > 0 ? "overdue" : "due",
              lastRentPeriod: period,
              updatedAt: nowIso(),
            });
            tx.set(db.collection("charges").doc(), {
              propertyId: prop.id,
              tenantId: tDoc.id,
              tenantName: ft.name || "",
              categoryId: "auto-rent",
              categoryName: `Rent - ${monthLabel}`,
              categoryType: "rent",
              amount: rent,
              date: today,
              addedBy: "system",
              ...(fromAdvance > 0 ? { notes: `Rs. ${fromAdvance} adjusted from advance` } : {}),
            });
            return true;
          });
          if (billed) summary.billed++;
        }
      }
      res.json({ success: true, period, ...summary });
    } catch (err: any) {
      console.error("monthly-rent cron error:", err);
      res.status(500).json({ success: false, error: "Monthly rent run failed." });
    }
  });

  // Safety nets so a client always gets JSON back.
  app.use("/api", (req, res) => {
    res.status(404).json({ success: false, error: `No route for ${req.method} ${req.path}` });
  });
  app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Unhandled API error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  });

  return app;
}
