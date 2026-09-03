// Real authentication via Firebase Auth. Replaces the old hardcoded owner
// password check and the Twilio-backed mock-OTP tenant login.
import {
  ConfirmationResult,
  createUserWithEmailAndPassword,
  RecaptchaVerifier,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signOut as fbSignOut,
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

export async function ownerSignUp(email: string, password: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  return cred.user;
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
