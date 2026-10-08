// Firebase auth flows: anonymous, username + PIN, and linked (Google/Apple) accounts.
// Every route that acts for the caller reads the uid from the verified bearer token
// (req.user, set by attachUser); nothing trusts a uid from the body.
import type { Request, Response } from "express";
import {
  addEmail as addEmailFor,
  adminResetPin,
  changePin as changePinFor,
  deleteAccount,
  linkProvider as linkProviderFor,
  loginWithUsername as loginWithUsernameFor,
  registerAnonymous as registerAnonymousFor,
  registerUsername,
  syncEmailVerified,
  UserError,
} from "../services/userService.js";
import { isValidPin, isValidUsername } from "../services/usernamePolicy.js";
import {
  RULES,
  checkThrottle,
  loginChecks,
  pinKey,
  recordAttempt,
  type ThrottleCheck,
} from "../services/throttle.js";
import { log } from "../lib/log.js";
import { errorInfo } from "../lib/errors.js";
import { bodyOf, replyWithError } from "./usersController.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// One message for an unknown username, a username without a PIN and a wrong PIN (T7.7).
const LOGIN_FAILED = { error: "That username and PIN don't match" };

/** 429 with Retry-After. Says nothing about whether the username exists. */
function tooManyTries(res: Response, retryAfterSec: number) {
  res.setHeader("Retry-After", String(retryAfterSec));
  return res.status(429).json({
    error: "Too many tries. Take a break and try again in a little while.",
    code: "too_many_attempts",
    retryAfter: retryAfterSec,
  });
}

/**
 * POST /auth/firebase/register-anonymous (bearer: the anonymous user's ID token).
 * Creates the row with a generated screen name; idempotent.
 */
export async function registerAnonymous(req: Request, res: Response) {
  const auth = req.user;
  if (!auth) return res.status(401).json({ error: "unauthorized" });
  try {
    const { user, isNew } = await registerAnonymousFor(auth.userId);
    return res.json({
      ok: true,
      userId: user.id,
      screenName: user.screenName,
      accountType: user.accountType,
      isNew,
    });
  } catch (e) {
    return replyWithError(res, "auth_register_anonymous_failed", e);
  }
}

/**
 * POST /auth/firebase/register-username { username, pin, screenName? }
 * (bearer: the current, usually anonymous, user). Returns a custom token with the
 * new claims for the client's signInWithCustomToken.
 */
export async function registerWithUsername(req: Request, res: Response) {
  const auth = req.user;
  if (!auth) return res.status(401).json({ error: "unauthorized" });
  const body = bodyOf(req);
  if (!isValidUsername(body.username)) {
    return res.status(400).json({
      error: "Username must be 3-20 characters, letters, numbers, and underscores only",
    });
  }
  if (!isValidPin(body.pin)) {
    return res.status(400).json({ error: "PIN must be 6 digits" });
  }
  // The service checks a chosen screen name against the T6.7 rules (400 with a friendly message).
  const screenName =
    typeof body.screenName === "string" && body.screenName.trim() ? body.screenName : undefined;
  try {
    const { user, customToken } = await registerUsername(auth.userId, {
      username: body.username,
      pin: body.pin,
      screenName,
    });
    return res.json({
      ok: true,
      customToken,
      screenName: user.screenName,
      accountType: user.accountType,
    });
  } catch (e) {
    return replyWithError(res, "auth_register_username_failed", e);
  }
}

/**
 * POST /auth/firebase/login-username { username, pin } (public).
 * Returns a Firebase custom token the client exchanges for an ID token.
 */
export async function loginWithUsername(req: Request, res: Response) {
  const { username, pin } = bodyOf(req);
  if (typeof username !== "string" || typeof pin !== "string" || !username || !pin) {
    return res.status(400).json({ error: "username and pin required" });
  }

  // req.ip is the socket address: on Lambda, serverless-http fills it from API Gateway's
  // sourceIp, which the client can't forge. `trust proxy` stays off on purpose, since
  // it would make req.ip the client-supplied X-Forwarded-For.
  const checks = loginChecks(isValidUsername(username) ? username : null, req.ip);
  try {
    const verdict = await checkThrottle(checks);
    if (!verdict.allowed) {
      log.warn("auth_login_throttled");
      return tooManyTries(res, verdict.retryAfterSec);
    }
    const result = await loginWithUsernameFor(username, pin);
    await recordAttempt(checks, Boolean(result));
    if (!result) return res.status(401).json(LOGIN_FAILED);
    return res.json({
      ok: true,
      customToken: result.customToken,
      userId: result.user.id,
      screenName: result.user.screenName,
      accountType: result.user.accountType,
    });
  } catch (e) {
    return replyWithError(res, "auth_login_failed", e);
  }
}

/**
 * POST /auth/firebase/link-provider (bearer: the ID token issued after the client
 * linked or signed in with Google/Apple). Providers and email come from that token.
 */
export async function linkProvider(req: Request, res: Response) {
  const auth = req.user;
  if (!auth) return res.status(401).json({ error: "unauthorized" });
  try {
    const user = await linkProviderFor(auth.userId, {
      email: auth.email,
      emailVerified: auth.emailVerified,
    });
    return res.json({
      ok: true,
      providers: auth.providers ?? [],
      email: user.email,
      emailVerified: user.emailVerified,
      accountType: user.accountType,
    });
  } catch (e) {
    return replyWithError(res, "auth_link_provider_failed", e);
  }
}

/** POST /auth/firebase/change-pin { currentPin, newPin } (username+PIN accounts). */
export async function changePin(req: Request, res: Response) {
  const auth = req.user;
  if (!auth) return res.status(401).json({ error: "unauthorized" });
  const { currentPin, newPin } = bodyOf(req);
  if (typeof currentPin !== "string" || !currentPin || newPin === undefined) {
    return res.status(400).json({ error: "currentPin and newPin required" });
  }
  if (!isValidPin(newPin)) {
    return res.status(400).json({ error: "New PIN must be 6 digits" });
  }
  const checks: ThrottleCheck[] = [{ key: pinKey(auth.userId), rule: RULES.pinChange }];
  try {
    const verdict = await checkThrottle(checks);
    if (!verdict.allowed) {
      log.warn("auth_change_pin_throttled");
      return tooManyTries(res, verdict.retryAfterSec);
    }
    try {
      await changePinFor(auth.userId, currentPin, newPin);
    } catch (e) {
      if (e instanceof UserError && e.code === "wrong_pin") await recordAttempt(checks, false);
      throw e;
    }
    await recordAttempt(checks, true);
    return res.json({ ok: true });
  } catch (e) {
    return replyWithError(res, "auth_change_pin_failed", e);
  }
}

/** POST /auth/firebase/add-email { email }: sets an unverified email. */
export async function addEmail(req: Request, res: Response) {
  const auth = req.user;
  if (!auth) return res.status(401).json({ error: "unauthorized" });
  const { email } = bodyOf(req);
  if (typeof email !== "string" || !EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ error: "Valid email address required" });
  }
  try {
    await addEmailFor(auth.userId, email);
    return res.json({ ok: true, email, emailVerified: false });
  } catch (e) {
    const code = errorInfo(e).code;
    if (code === "auth/email-already-exists") {
      log.warn("auth_add_email_rejected", { code });
      return res
        .status(409)
        .json({ error: "This email is already associated with another account" });
    }
    if (code === "auth/invalid-email") {
      log.warn("auth_add_email_rejected", { code });
      return res.status(400).json({ error: "Invalid email address format" });
    }
    return replyWithError(res, "auth_add_email_failed", e);
  }
}

/** POST /auth/firebase/check-email-verified: copies Firebase's emailVerified onto the row. */
export async function checkEmailVerifiedStatus(req: Request, res: Response) {
  const auth = req.user;
  if (!auth) return res.status(401).json({ error: "unauthorized" });
  try {
    const emailVerified = await syncEmailVerified(auth.userId);
    return res.json({ ok: true, emailVerified });
  } catch (e) {
    return replyWithError(res, "auth_check_email_verified_failed", e);
  }
}

/** POST /auth/firebase/admin/reset-pin { userId, newPin } (requireAdmin). */
export async function adminResetUserPin(req: Request, res: Response) {
  const { userId, newPin } = bodyOf(req);
  if (typeof userId !== "string" || !userId || newPin === undefined) {
    return res.status(400).json({ error: "userId and newPin required" });
  }
  if (!isValidPin(newPin)) {
    return res.status(400).json({ error: "PIN must be 6 digits" });
  }
  try {
    await adminResetPin(userId, newPin);
    log.info("admin_pin_reset");
    return res.json({ success: true, message: "PIN reset successfully" });
  } catch (e) {
    return replyWithError(res, "admin_pin_reset_failed", e);
  }
}

/**
 * DELETE /me: deletes the caller's account for good (T7.8). Plays stay, anonymised;
 * everything else about the player goes, and so does the Firebase user.
 */
export async function deleteMe(req: Request, res: Response) {
  const auth = req.user;
  if (!auth) return res.status(401).json({ error: "unauthorized" });
  try {
    await deleteAccount(auth.userId);
    log.info("account_deleted");
    return res.json({ ok: true });
  } catch (e) {
    return replyWithError(res, "account_delete_failed", e);
  }
}
