// Auth guards and user attachment middleware (Firebase-based)
import type { Request, Response, NextFunction } from "express";
import { verifyIdToken as verifyFirebaseToken } from "../services/firebaseAuthService.js";
import { getUser } from "../services/dynamoService.js";

// Extended user info attached to request
export interface AuthUser {
  userId: string;
  email?: string;
  emailVerified?: boolean;
  isAnonymous: boolean;
  accountType: "anonymous" | "username_pin" | "linked";
  displayName?: string;
  providers?: string[];
}

export async function attachUser(req: Request, res: Response, next: NextFunction) {
  // @ts-ignore
  req.user = undefined;

  // Get token from Authorization header
  const bearer = req.headers.authorization?.toString();
  let token: string | undefined;
  if (bearer?.startsWith("Bearer ")) {
    token = bearer.slice(7);
  }

  if (!token) return next();

  try {
    // Verify Firebase ID token
    const decodedToken = await verifyFirebaseToken(token);

    // Build user object from token claims
    const user: AuthUser = {
      userId: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      isAnonymous: decodedToken.firebase?.sign_in_provider === "anonymous",
      accountType: decodedToken.accountType || "anonymous",
      displayName: decodedToken.name || decodedToken.displayName,
      providers: decodedToken.firebase?.identities
        ? Object.keys(decodedToken.firebase.identities)
        : [],
    };

    // @ts-ignore
    req.user = user;
  } catch (err) {
    // Token verification failed - user remains undefined
    // Firebase tokens are short-lived; client should refresh automatically
    console.error("Firebase token verification failed:", err);
  }

  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // @ts-ignore
  if (!req.user?.userId) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

// Require a non-anonymous account (username+PIN or linked)
export function requireRegisteredAccount(req: Request, res: Response, next: NextFunction) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.userId) {
    return res.status(401).json({ error: "unauthorized" });
  }
  if (user.accountType === "anonymous") {
    return res.status(403).json({
      error: "account_upgrade_required",
      message: "Please create a username to access this feature",
    });
  }
  next();
}

// Require a linked account with verified email
export async function requireVerifiedEmail(req: Request, res: Response, next: NextFunction) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.userId) {
    return res.status(401).json({ error: "unauthorized" });
  }
  if (!user.email || !user.emailVerified) {
    return res.status(403).json({
      error: "email_not_verified",
      message: "Please verify your email to access this feature",
    });
  }
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  // @ts-ignore
  const user = req.user as AuthUser | undefined;
  if (!user?.userId) {
    return res.status(401).json({ error: "unauthorized" });
  }
  try {
    const profile = await getUser(user.userId);
    if (profile?.admin) {
      // Surface the profile for downstream handlers to avoid duplicate lookups
      // @ts-ignore
      req.authProfile = profile;
      return next();
    }
    return res.status(403).json({ error: "admin_required" });
  } catch (err) {
    return res.status(500).json({ error: "admin_check_failed" });
  }
}

// Legacy export for backwards compatibility during migration
export const requireValidatedEmail = requireVerifiedEmail;
