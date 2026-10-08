import type { Request, Response } from "express";
import {
  UserError,
  changeScreenName as changeScreenNameFor,
  checkScreenNameFor,
  getCurrentUser,
  getPublicProfile as getPublicProfileFor,
  updatePreferences as updatePreferencesFor,
} from "../services/userService.js";
import { isValidAvatar, isValidPrefs } from "../services/usernamePolicy.js";
import { sendServerError } from "../lib/http.js";

/** Answers a UserError with its status and message, anything else with a logged 500. */
export function replyWithError(res: Response, event: string, err: unknown) {
  if (err instanceof UserError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  return sendServerError(res, event, err);
}

/** The request body as a plain object (never trusted: every field is checked). */
export function bodyOf(req: Request): Record<string, unknown> {
  const body: unknown = req.body;
  return body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

/**
 * GET /me and GET /auth/firebase/me (one handler, one shape): `{ user: CurrentUser }`,
 * or 404 when the account has no row yet (the client then registers it).
 */
export async function me(req: Request, res: Response) {
  const auth = req.user;
  if (!auth) return res.status(401).json({ error: "unauthorized" });
  try {
    const user = await getCurrentUser(auth.userId, {
      email: auth.email,
      emailVerified: auth.emailVerified,
      providers: auth.providers,
    });
    if (!user) return res.status(404).json({ error: "user_not_found" });
    return res.json({ user });
  } catch (e) {
    return sendServerError(res, "users_me_failed", e);
  }
}

async function setScreenName(req: Request, res: Response) {
  const auth = req.user;
  if (!auth) return res.status(401).json({ error: "unauthorized" });
  try {
    const assigned = await changeScreenNameFor(auth.userId, bodyOf(req).screenName);
    return res.json({ ok: true, screenName: assigned });
  } catch (e) {
    return replyWithError(res, "users_screen_name_failed", e);
  }
}

/** GET /users/screen-name/check?name=… → { ok, name } or { ok: false, code, message } */
export async function checkScreenName(req: Request, res: Response) {
  const auth = req.user;
  if (!auth) return res.status(401).json({ error: "unauthorized" });
  try {
    return res.json(await checkScreenNameFor(auth.userId, req.query.name));
  } catch (e) {
    return sendServerError(res, "users_screen_name_check_failed", e);
  }
}

/** PATCH /me/screen-name and POST /users/screen-name { screenName } */
export const changeScreenName = setScreenName;

/** PATCH /users/settings { screenName } (the settings screen's endpoint). */
export const updateSettings = setScreenName;

/** POST /users/preferences { avatar?: number, preferences?: object } */
export async function updatePreferences(req: Request, res: Response) {
  const auth = req.user;
  if (!auth) return res.status(401).json({ error: "unauthorized" });
  const { avatar, preferences } = bodyOf(req);
  if (avatar !== undefined && !isValidAvatar(avatar)) {
    return res.status(400).json({ error: "invalid_avatar" });
  }
  if (preferences !== undefined && !isValidPrefs(preferences)) {
    return res.status(400).json({ error: "invalid_preferences" });
  }
  try {
    await updatePreferencesFor(auth.userId, { avatar, preferences });
    return res.json({ ok: true });
  } catch (e) {
    return replyWithError(res, "users_preferences_failed", e);
  }
}

/** GET /users/:userId: a public profile (whitelisted fields only) plus follow data. */
export async function getPublicProfile(req: Request, res: Response) {
  const targetUserId = String(req.params.userId ?? "").trim();
  if (!targetUserId) return res.status(400).json({ error: "userId_required" });
  try {
    const profile = await getPublicProfileFor(targetUserId, req.user?.userId);
    if (!profile) return res.status(404).json({ error: "user_not_found" });
    return res.json(profile);
  } catch (e) {
    return sendServerError(res, "users_public_profile_failed", e);
  }
}
