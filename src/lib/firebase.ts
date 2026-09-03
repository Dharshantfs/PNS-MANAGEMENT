import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

// Single shared Firebase app instance for the whole frontend (auth, Firestore,
// storage). googleAuthService.ts's Google OAuth (Drive/Forms) flow reuses this
// same `auth` instance rather than initializing its own.
export const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
