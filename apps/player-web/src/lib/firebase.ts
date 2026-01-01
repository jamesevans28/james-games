// Firebase configuration for the player-web frontend
import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  signInWithPopup,
  linkWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendEmailVerification,
  updateEmail,
  type Auth,
  type User,
  type UserCredential,
} from "firebase/auth";

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function initializeFirebase(): { app: FirebaseApp; auth: Auth } {
  if (!app) {
    console.log("Firebase: initializing with config", {
      apiKey: firebaseConfig.apiKey ? "***set***" : "MISSING",
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId,
    });
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    console.log("Firebase: initialized successfully");
  }
  return { app, auth: auth! };
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    initializeFirebase();
  }
  return auth!;
}

// Auth providers
const googleProvider = new GoogleAuthProvider();
const appleProvider = new OAuthProvider("apple.com");

// Anonymous sign-in
export async function signInAsAnonymous(): Promise<UserCredential> {
  const auth = getFirebaseAuth();
  return signInAnonymously(auth);
}

// Sign in with custom token (for username+PIN flow)
export async function signInWithToken(customToken: string): Promise<UserCredential> {
  const auth = getFirebaseAuth();
  return signInWithCustomToken(auth, customToken);
}

// Google sign-in
export async function signInWithGoogle(): Promise<UserCredential> {
  const auth = getFirebaseAuth();
  return signInWithPopup(auth, googleProvider);
}

// Apple sign-in
export async function signInWithApple(): Promise<UserCredential> {
  const auth = getFirebaseAuth();
  return signInWithPopup(auth, appleProvider);
}

// Link Google account
export async function linkWithGoogle(user: User): Promise<UserCredential> {
  return linkWithPopup(user, googleProvider);
}

// Link Apple account
export async function linkWithApple(user: User): Promise<UserCredential> {
  return linkWithPopup(user, appleProvider);
}

// Sign out
export async function signOut(): Promise<void> {
  const auth = getFirebaseAuth();
  return firebaseSignOut(auth);
}

// Get current user
export function getCurrentUser(): User | null {
  const auth = getFirebaseAuth();
  return auth.currentUser;
}

// Get ID token for API calls
export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const user = getCurrentUser();
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

// Subscribe to auth state changes
export function onAuthChange(callback: (user: User | null) => void): () => void {
  const auth = getFirebaseAuth();
  console.log(
    "Firebase: subscribing to auth state changes, auth object:",
    !!auth,
    "currentUser:",
    auth?.currentUser?.uid
  );

  // Firebase's onAuthStateChanged should fire immediately with current state
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    console.log("Firebase: onAuthStateChanged fired, user:", user?.uid);
    callback(user);
  });

  return unsubscribe;
}

/**
 * Wait for Firebase Auth to finish initializing and resolve its initial auth state.
 * This is more reliable than waiting for onAuthStateChanged to fire.
 */
export async function waitForAuthReady(): Promise<User | null> {
  const auth = getFirebaseAuth();
  // authStateReady() returns a promise that resolves when Firebase has determined
  // the initial auth state (either signed in or not)
  await auth.authStateReady();
  return auth.currentUser;
}

// Check if user is anonymous
export function isAnonymousUser(user: User | null): boolean {
  return user?.isAnonymous ?? false;
}

// Get linked providers
export function getLinkedProviders(user: User | null): string[] {
  if (!user) return [];
  return user.providerData.map((p: { providerId: string }) => p.providerId);
}

// Send email verification
export async function sendVerificationEmail(user: User): Promise<void> {
  return sendEmailVerification(user);
}

// Update user email (client-side)
export async function updateUserEmail(user: User, newEmail: string): Promise<void> {
  return updateEmail(user, newEmail);
}

export { type User, type UserCredential, type Auth };
