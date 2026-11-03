import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider, getToken, AppCheck } from 'firebase/app-check';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Single shared Firebase app instance for the whole frontend (auth, Firestore).
export const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Firebase App Check: proves requests come from this app in a real browser,
// not from a script. Turned on by setting VITE_RECAPTCHA_SITE_KEY (the
// reCAPTCHA v3 site key registered under Firebase Console > App Check) in
// the Vercel env. Without it the app works exactly as before.
const recaptchaSiteKey = (import.meta as any).env?.VITE_RECAPTCHA_SITE_KEY as string | undefined;
let appCheck: AppCheck | null = null;
if (recaptchaSiteKey && typeof window !== 'undefined') {
  try {
    appCheck = initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaV3Provider(recaptchaSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (e) {
    console.warn('App Check could not start', e);
  }
}

// Header for calls to our own /api - the server checks it on the public
// (signed-out) endpoints once APP_CHECK_ENFORCE=1 is set there.
export async function appCheckHeaders(): Promise<Record<string, string>> {
  if (!appCheck) return {};
  try {
    const { token } = await getToken(appCheck, false);
    return { 'X-Firebase-AppCheck': token };
  } catch (e) {
    console.warn('App Check token unavailable', e);
    return {};
  }
}

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
