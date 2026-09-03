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
      "FIREBASE_ADMIN_* env vars not set - Google Forms bulk-admission endpoints will be disabled."
    );
    return null;
  }

  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
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

  return app;
}
