// Firebase Authentication Service
// Handles token verification, custom token creation for username+PIN, and user management
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;

import { initializeApp, cert, getApps, App } from "firebase-admin/app";
import { getAuth, Auth, DecodedIdToken } from "firebase-admin/auth";
import bcrypt from "bcryptjs";

// Initialize Firebase Admin SDK
let firebaseApp: App;
let firebaseAuth: Auth;

function getFirebaseApp(): App {
  if (firebaseApp) return firebaseApp;

  if (getApps().length > 0) {
    firebaseApp = getApps()[0];
    return firebaseApp;
  }

  // Initialize with service account credentials from environment
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase configuration missing. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY"
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
  } catch (e: any) {
    if (e.code === "auth/user-not-found") return null;
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
  claims?: Record<string, any>
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
// Rate Limiting (in-memory, consider Redis for production at scale)
// ============================================================================

type LoginAttempt = {
  attempts: number;
  lastAttempt: number;
  lockedUntil?: number;
};

const loginAttempts = new Map<string, LoginAttempt>();

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes after max attempts

/**
 * Check if a login attempt is allowed (rate limiting).
 * Returns { allowed: true } or { allowed: false, retryAfter: seconds }
 */
export function checkRateLimit(identifier: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = loginAttempts.get(identifier);

  if (!record) {
    return { allowed: true };
  }

  // Check if locked out
  if (record.lockedUntil && now < record.lockedUntil) {
    return {
      allowed: false,
      retryAfter: Math.ceil((record.lockedUntil - now) / 1000),
    };
  }

  // Reset if window has passed
  if (now - record.lastAttempt > RATE_LIMIT_WINDOW_MS) {
    loginAttempts.delete(identifier);
    return { allowed: true };
  }

  // Check attempt count
  if (record.attempts >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    return {
      allowed: false,
      retryAfter: Math.ceil(LOCKOUT_DURATION_MS / 1000),
    };
  }

  return { allowed: true };
}

/**
 * Record a login attempt (success or failure).
 */
export function recordLoginAttempt(identifier: string, success: boolean): void {
  const now = Date.now();

  if (success) {
    // Clear on success
    loginAttempts.delete(identifier);
    return;
  }

  const record = loginAttempts.get(identifier);
  if (record) {
    record.attempts += 1;
    record.lastAttempt = now;
  } else {
    loginAttempts.set(identifier, {
      attempts: 1,
      lastAttempt: now,
    });
  }
}

// ============================================================================
// Account Linking Helpers
// ============================================================================

/**
 * Set custom claims on a Firebase user.
 * Useful for marking account type, linked status, etc.
 */
export async function setUserClaims(uid: string, claims: Record<string, any>): Promise<void> {
  const auth = getFirebaseAuth();
  await auth.setCustomUserClaims(uid, claims);
}

/**
 * Delete a Firebase user (for testing or account deletion).
 */
export async function deleteFirebaseUser(uid: string): Promise<void> {
  const auth = getFirebaseAuth();
  await auth.deleteUser(uid);
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

/**
 * Generate an email verification link that can be sent to the user.
 */
export async function generateEmailVerificationLink(email: string): Promise<string> {
  const auth = getFirebaseAuth();
  return await auth.generateEmailVerificationLink(email);
}
