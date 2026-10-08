// Real authentication via Firebase Auth. Replaces the old hardcoded owner
// password check and the Twilio-backed mock-OTP tenant login.
import {
  ConfirmationResult,
  createUserWithEmailAndPassword,
  RecaptchaVerifier,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signOut as fbSignOut,
  updatePassword,
} from 'firebase/auth';
import { auth } from '../lib/firebase';

let recaptchaVerifier: RecaptchaVerifier | null = null;

// Must be called once with the id of an (invisible) container element present
// in the DOM before requesting a phone OTP.
export function getRecaptchaVerifier(containerId: string): RecaptchaVerifier {
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(auth, containerId, { size: 'invisible' });
  }
  return recaptchaVerifier;
}

// --- Owner / staff: email + password ---------------------------------------

export async function ownerSignIn(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

// Used only to bootstrap the very first owner account. There is no public
// sign-up flow in the app - see LoginScreen.tsx and README for how the first
// admin gets created (Firebase Console) and how further admins/staff get
// invited (Settings > Team Access, calling createTeamMember below).
export async function ownerSignUp(email: string, password: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export interface TeamInviteResult {
  email: string;
  // true = the email already had a team account; its access was refreshed
  // and no new password was created.
  existing: boolean;
  tempPassword: string | null;
  propertyCount: number;
  // Whether Firebase sent the "set your password" email to a new account.
  setupEmailSent: boolean;
}

// Invite a new admin/staff account. Only callable while signed in as an
// existing owner - the backend re-checks this, this isn't just a UI gate.
// A new account gets every property the inviter can access, plus an email
// from Firebase with a link to set their own password (no SMTP setup needed -
// it's Firebase Auth's built-in password-reset mail). The one-time temporary
// password is still returned as a fallback in case that email doesn't arrive.
// Adding an email that already has a team account just refreshes its access.
export async function createTeamMember(
  name: string,
  email: string,
  role: 'owner' | 'staff'
): Promise<TeamInviteResult> {
  if (!auth.currentUser) throw new Error('You must be signed in to add a team member.');
  const idToken = await auth.currentUser.getIdToken();
  const res = await fetch('/api/team/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ name, email, role }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to create team member.');

  let setupEmailSent = false;
  if (!data.existing) {
    try {
      await sendPasswordResetEmail(auth, data.email, { url: window.location.origin });
      setupEmailSent = true;
    } catch (e) {
      console.warn('Set-password email failed', e);
    }
  }
  return {
    email: data.email,
    existing: !!data.existing,
    tempPassword: data.tempPassword || null,
    propertyCount: data.propertyCount || 0,
    setupEmailSent,
  };
}

// Firebase's built-in "reset your password" email - free, no SMTP setup.
// Used for "Forgot password?" and for a tenant's first login after KYC.
export async function sendPasswordSetupEmail(email: string) {
  await sendPasswordResetEmail(auth, email, { url: window.location.origin });
}

export async function changeOwnPassword(newPassword: string) {
  if (!auth.currentUser) throw new Error('Not signed in.');
  await updatePassword(auth.currentUser, newPassword);
}

// --- Tenant: phone OTP -------------------------------------------------------

export async function sendTenantOtp(phoneE164: string, containerId: string): Promise<ConfirmationResult> {
  const verifier = getRecaptchaVerifier(containerId);
  return signInWithPhoneNumber(auth, phoneE164, verifier);
}

export async function confirmTenantOtp(confirmation: ConfirmationResult, code: string) {
  const cred = await confirmation.confirm(code);
  return cred.user;
}

export async function signOutCurrentUser() {
  await fbSignOut(auth);
}
