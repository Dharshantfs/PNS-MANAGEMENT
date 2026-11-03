// Runs the daily KYC housekeeping once, right now (the same job the daily
// /api/cron/monthly-rent cron runs - see kycHousekeeping in api/_lib/app.ts):
// - moves full Aadhaar numbers still on tenant records into the server-only
//   kycDocuments collection, leaving only the last 4 digits on the tenant;
// - deletes Aadhaar photos and numbers of residents who checked out more
//   than 90 days ago.
//
// Usage: npm run kyc-housekeeping
// Needs FIREBASE_ADMIN_* in the environment (see .env.example).
import "dotenv/config";
import admin from "firebase-admin";
import { kycHousekeeping } from "../api/_lib/app";

async function main() {
  if (!admin.apps.length) {
    console.error("FIREBASE_ADMIN_* env vars are not set - nothing done.");
    process.exit(1);
  }
  const result = await kycHousekeeping(admin.firestore());
  console.log(`Moved ${result.moved} Aadhaar number(s) off tenant records; cleaned ${result.purged} exited resident(s).`);
}

main().catch((err) => {
  console.error("KYC housekeeping failed:", err?.message || err);
  process.exit(1);
});
