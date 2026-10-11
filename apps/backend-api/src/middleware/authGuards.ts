// Auth guards and user attachment middleware (Supabase access tokens, Phase 14)
import type { Request, Response, NextFunction } from "express";
import {
  isSyntheticEmail,
  verifyAccessToken,
  type AccessTokenClaims,
} from "../services/supabaseAuthService.js";
import { getUserById } from "../repos/usersRepo.js";
import { log } from "../lib/log.js";

// Extended user info attached to request
export interface AuthUser {
  userId: string;
  email?: string;
  emailVerified?: boolean;
  isAnonymous: boolean;
  accountType: "anonymous" | "username_pin" | "linked";
  providers?: string[];
}

let verifyToken: (token: string) => Promise<AccessTokenClaims> = verifyAccessToken;

/** Route tests swap in a fake verifier (src/test/app.ts); production never calls this. */
export function setTokenVerifierForTests(fn: typeof verifyToken | null): void {
  verifyToken = fn ?? verifyAccessToken;
}

/** `app_metadata.account_type`, set by the API when it upgrades an account. */
function accountTypeOf(claim: unknown): AuthUser["accountType"] {
  return claim === "username_pin" || claim === "linked" ? claim : "anonymous";
}

/** The AuthUser for a verified token, or null for a token that isn't a signed-in user's. */
export function authUserFromClaims(claims: AccessTokenClaims): AuthUser | null {
  if (claims.role !== "authenticated") return null;
  // A PIN account's synthetic address is plumbing, never the player's email.
  const email = claims.email && !isSyntheticEmail(claims.email) ? claims.email : undefined;
  // Linked sign-in providers only: "email" is the PIN plumbing, not something to show.
  const providers = claims.app_metadata?.providers;
  return {
    userId: claims.sub,
    email,
    // Google and Apple verify the emails they hand over; PIN accounts have none.
    emailVerified: Boolean(email),
    isAnonymous: claims.is_anonymous === true,
    accountType: accountTypeOf(claims.app_metadata?.account_type),
    providers: Array.isArray(providers)
      ? providers.filter((p) => typeof p === "string" && p !== "email" && p !== "anonymous")
      : [],
  };
}

export async function attachUser(req: Request, res: Response, next: NextFunction) {
  req.user = undefined;

  const bearer = req.headers.authorization?.toString();
  const token = bearer?.startsWith("Bearer ") ? bearer.slice(7) : undefined;
  if (!token) return next();

  try {
    const user = authUserFromClaims(await verifyToken(token));
    if (user) req.user = user;
    else log.warn("token_role_rejected");
  } catch (err) {
    // Expired or forged: the user stays signed out. supabase-js refreshes tokens itself.
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
