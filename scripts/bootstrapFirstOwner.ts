// One-time setup script: creates the very first owner login directly in
// Firebase (Auth + Firestore profile), the way this app expects - there is
// no public sign-up in the app itself (see LoginScreen.tsx / firestore.rules).
// Every account after this one is created by an existing owner from
// Settings > Team Access instead of running this script again.
//
// Usage:
//   npm run bootstrap-owner -- --email you@yourpg.com --password "TempPass123" --name "Your Name"
//
// Requires FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL /
// FIREBASE_ADMIN_PRIVATE_KEY in your environment (see .env.example) - the
// same service account credentials the server's Google Forms endpoints use.
import "dotenv/config";
import admin from "firebase-admin";

function arg(name: string): string | undefined {
  const flag = `--${name}`;
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email");
  const password = arg("password");
  const name = arg("name") || "Owner";

  if (!email || !password) {
    console.error('Usage: npm run bootstrap-owner -- --email you@yourpg.com --password "TempPass123" --name "Your Name"');
    process.exit(1);
  }
  if (password.length < 6) {
    console.error("Password must be at least 6 characters.");
    process.exit(1);
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      "Missing FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY.\n" +
        "Get these from Firebase Console > Project Settings > Service Accounts > Generate new private key,\n" +
        "and put them in a .env file (see .env.example)."
    );
    process.exit(1);
  }

  admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
  const db = admin.firestore();

  let uid: string;
  try {
    const existing = await admin.auth().getUserByEmail(email);
    uid = existing.uid;
    console.log(`Auth user for ${email} already exists (uid ${uid}) - updating password.`);
    await admin.auth().updateUser(uid, { password, displayName: name });
  } catch {
    const created = await admin.auth().createUser({ email, password, displayName: name });
    uid = created.uid;
    console.log(`Created Auth user ${email} (uid ${uid}).`);
  }

  await db.collection("users").doc(uid).set(
    {
      name,
      email,
      role: "owner",
      propertyIds: [],
      mustChangePassword: true,
      createdAt: new Date().toISOString(),
    },
    { merge: true }
  );

  console.log("\nDone. Sign in at your app's Owner/Admin tab with:");
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log("\nYou'll be asked to set your own password on first login.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
