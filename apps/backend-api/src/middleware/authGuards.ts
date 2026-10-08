// Auth guards and user attachment middleware (Firebase-based)
import type { Request, Response, NextFunction } from "express";
import { verifyIdToken as verifyFirebaseToken } from "../services/firebaseAuthService.js";
import { getUserById } from "../repos/usersRepo.js";
import { log } from "../lib/log.js";

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

type DecodedToken = Awaited<ReturnType<typeof verifyFirebaseToken>>;
let verifyToken: (token: string) => Promise<DecodedToken> = verifyFirebaseToken;

/** Route tests swap in a fake verifier (src/test/app.ts); production never calls this. */
export function setTokenVerifierForTests(fn: typeof verifyToken | null): void {
  verifyToken = fn ?? verifyFirebaseToken;
}

/** The `accountType` custom claim, set by the backend when it mints or upgrades an account. */
function accountTypeOf(claim: unknown): AuthUser["accountType"] {
  return claim === "username_pin" || claim === "linked" ? claim : "anonymous";
}

export async function attachUser(req: Request, res: Response, next: NextFunction) {
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
    const decodedToken = await verifyToken(token);

    // Build user object from token claims
    const user: AuthUser = {
      userId: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      isAnonymous: decodedToken.firebase?.sign_in_provider === "anonymous",
      accountType: accountTypeOf(decodedToken.accountType),
      displayName: typeof decodedToken.name === "string" ? decodedToken.name : undefined,
      providers: decodedToken.firebase?.identities
        ? Object.keys(decodedToken.firebase.identities)
        : [],
    };

    req.user = user;
  } catch (err) {
    // Token verification failed - user remains undefined
    // Firebase tokens are short-lived; client should refresh automatically
    log.warn("token_verification_failed", undefined, err);
  }

  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.userId) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

// Require a non-anonymous account (username+PIN or linked)
export function requireRegisteredAccount(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
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
export function requireVerifiedEmail(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
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
  const user = req.user;
  if (!user?.userId) {
    return res.status(401).json({ error: "unauthorized" });
  }
  try {
    const profile = await getUserById(user.userId);
    if (profile?.admin) {
      // Surface the profile for downstream handlers to avoid duplicate lookups
      req.authProfile = profile;
      return next();
    }
    return res.status(403).json({ error: "admin_required" });
  } catch {
    return res.status(500).json({ error: "admin_check_failed" });
  }
}
