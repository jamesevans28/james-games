// Firebase Authentication Service
// Handles token verification, custom token creation for username+PIN, and user management

import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getAuth, Auth, type DecodedIdToken } from "firebase-admin/auth";
import bcrypt from "bcryptjs";
import { errorInfo } from "../lib/errors.js";

// Initialize Firebase Admin SDK
let firebaseApp: App;
let firebaseAuth: Auth;

function getFirebaseApp(): App {
  if (firebaseApp) return firebaseApp;

  const existing = getApps()[0];
  if (existing) {
    firebaseApp = existing;
    return firebaseApp;
  }

  // Local stack (npm run local): the Auth emulator needs only a project id, and the
  // Admin SDK then mints unsigned custom tokens the emulator accepts.
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    firebaseApp = initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || "demo-games4james",
    });
    return firebaseApp;
  }

  // Initialize with service account credentials from environment
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase configuration missing. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY",
    );
  }

  firebaseApp = initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });

  return firebaseApp;
}

function getFirebaseAuth(): Auth {
  if (firebaseAuth) return firebaseAuth;
  firebaseAuth = getAuth(getFirebaseApp());
  return firebaseAuth;
}

// ============================================================================
// Token Verification
// ============================================================================

export type FirebaseUser = {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  displayName?: string;
  photoURL?: string;
  providerId?: string;
  isAnonymous?: boolean;
};

/**
 * Verify a Firebase ID token and return the decoded payload.
 * Use this in middleware to authenticate all API requests.
 */
export async function verifyIdToken(token: string): Promise<DecodedIdToken> {
  const auth = getFirebaseAuth();
  return await auth.verifyIdToken(token);
}

/**
 * Get full Firebase user record by UID.
 */
export async function getFirebaseUser(uid: string): Promise<FirebaseUser | null> {
  try {
    const auth = getFirebaseAuth();
    const userRecord = await auth.getUser(uid);
    return {
      uid: userRecord.uid,
      email: userRecord.email,
      emailVerified: userRecord.emailVerified,
      displayName: userRecord.displayName,
      photoURL: userRecord.photoURL,
      providerId: userRecord.providerData?.[0]?.providerId,
      isAnonymous: userRecord.providerData?.length === 0,
    };
  } catch (e) {
    if (errorInfo(e).code === "auth/user-not-found") return null;
    throw e;
  }
}

// ============================================================================
// Custom Token (for Username + PIN login)
// ============================================================================

/**
 * Create a custom Firebase token for a user.
 * Used when user logs in with username + PIN.
 * Frontend signs in with: signInWithCustomToken(auth, token)
 */
export async function createCustomToken(
  uid: string,
  claims?: Record<string, unknown>,
): Promise<string> {
  const auth = getFirebaseAuth();
  return await auth.createCustomToken(uid, claims);
}

// ============================================================================
// PIN Hashing
// ============================================================================

const PIN_SALT_ROUNDS = 10;

/**
 * Hash a PIN for secure storage.
 */
export async function hashPin(pin: string): Promise<string> {
  return await bcrypt.hash(pin, PIN_SALT_ROUNDS);
}

/**
 * Verify a PIN against its hash.
 */
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(pin, hash);
}

// ============================================================================
// Account Linking Helpers
// ============================================================================

/**
 * Set custom claims on a Firebase user.
 * Useful for marking account type, linked status, etc.
 */
export async function setUserClaims(uid: string, claims: Record<string, unknown>): Promise<void> {
  const auth = getFirebaseAuth();
  await auth.setCustomUserClaims(uid, claims);
}

/**
 * Delete a Firebase user (account deletion, T7.8). A user that is already gone
 * counts as deleted, so a retried deletion still finishes.
 */
export async function deleteFirebaseUser(uid: string): Promise<void> {
  const auth = getFirebaseAuth();
  try {
    await auth.deleteUser(uid);
  } catch (e) {
    if (errorInfo(e).code !== "auth/user-not-found") throw e;
  }
}

/**
 * Update email on a Firebase user account.
 * The user will need to verify this email via Firebase's client-side flow.
 */
export async function updateFirebaseUserEmail(uid: string, email: string): Promise<void> {
  const auth = getFirebaseAuth();
  await auth.updateUser(uid, { email, emailVerified: false });
}

/**
 * Check if a Firebase user's email is verified.
 */
export async function checkEmailVerified(uid: string): Promise<boolean> {
  const auth = getFirebaseAuth();
  const userRecord = await auth.getUser(uid);
  return userRecord.emailVerified ?? false;
}
