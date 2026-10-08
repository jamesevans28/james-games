import { initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type Auth,
  type User,
} from "firebase/auth";

const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ??
    (import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL ? "demo-key" : undefined),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Set by `npm run local`: the Firebase Auth emulator instead of the real project.
const emulatorUrl: string | undefined = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL;
if (emulatorUrl) connectAuthEmulator(auth, emulatorUrl, { disableWarnings: true });

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export { onAuthStateChanged };
export type { Auth, User };
