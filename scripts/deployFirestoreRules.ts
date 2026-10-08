// Publishes firestore.rules to Firebase on every Vercel deploy, so the file
// in this repo is the only copy anyone maintains - no pasting into the
// Firebase Console. Runs before `vite build` (see vercel.json buildCommand)
// using the same FIREBASE_ADMIN_* service account the API already uses.
//
// - Rules unchanged from what's live: nothing is published.
// - Rules don't compile, or publishing fails: the build fails, so the site
//   never goes live with code that doesn't match its rules.
// - FIREBASE_ADMIN_* not set (e.g. a local build): skipped with a warning.
// - SKIP_RULES_DEPLOY=1 in Vercel env: skipped (emergency escape hatch).
//
// Every published version stays in Firebase Console > Firestore > Rules
// history, where an earlier version can be restored.
//
// Usage: npm run deploy-rules
import "dotenv/config";
import { readFileSync } from "node:fs";
import admin from "firebase-admin";

async function main() {
  if (process.env.SKIP_RULES_DEPLOY === "1") {
    console.log("[rules] SKIP_RULES_DEPLOY=1 - not publishing firestore.rules.");
    return;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    console.warn("[rules] FIREBASE_ADMIN_* not set - skipping firestore.rules deploy.");
    return;
  }

  admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
  const rules = admin.securityRules();
  const source = readFileSync("firestore.rules", "utf8");
  const normalize = (text: string) => text.replace(/\r\n/g, "\n").trim();

  try {
    const live = await rules.getFirestoreRuleset();
    if (normalize(live.source.map((f) => f.content).join("\n")) === normalize(source)) {
      console.log(`[rules] Live Firestore rules already match firestore.rules - nothing to publish.`);
      return;
    }
  } catch (err: any) {
    console.warn("[rules] Could not read the live rules, publishing anyway:", err?.message || err);
  }

  const released = await rules.releaseFirestoreRulesetFromSource(source);
  console.log(`[rules] Published firestore.rules to ${projectId} (${released.name}).`);
}

main().catch((err) => {
  console.error("[rules] Failed to publish firestore.rules:", err?.message || err);
  process.exit(1);
});
