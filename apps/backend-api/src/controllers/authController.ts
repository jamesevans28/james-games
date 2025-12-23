import type { Request, Response } from "express";
import {
  localSignUp,
  localSignIn,
  getLoginUrl,
  getLogoutUrl,
  verifyIdToken,
  refreshAuthTokens,
} from "../services/authService.js";
import { config } from "../config/index.js";
import { setSessionCookies, clearSessionCookies } from "../utils/cookies.js";
import { putUser } from "../services/dynamoService.js";
import { createUniqueScreenName } from "../services/userService.js";

export async function signup(req: Request, res: Response) {
  const { username, password, email, screenName } = (req.body || {}) as any;
  if (!username || !password || !screenName)
    return res.status(400).json({ error: "username, password, and screenName required" });
  try {
    await localSignUp(username, password, email);
    const signinResp: any = await localSignIn(username, password);
    const tokens = signinResp.AuthenticationResult;
    if (!tokens?.IdToken || !tokens?.AccessToken)
      return res.status(401).json({ error: "Authentication failed" });

    // Prefer Cognito's canonical username for subsequent refresh flows.
    // This avoids SECRET_HASH mismatch when users sign in with an alias (e.g. email).
    let canonicalUsername = username;
    try {
      const payload: any = await verifyIdToken(tokens.IdToken);
      canonicalUsername = payload?.["cognito:username"] || canonicalUsername;
    } catch {
      // If token verification fails here, fall back to the provided username.
    }
    setSessionCookies(
      res,
      {
        id_token: tokens.IdToken,
        access_token: tokens.AccessToken,
        refresh_token: tokens.RefreshToken,
        expires_in: tokens.ExpiresIn,
      },
      canonicalUsername
    );
    try {
      const payload: any = await verifyIdToken(tokens.IdToken);
      // Reserve a unique screen name (may append #NNNN if needed)
      const assigned = await createUniqueScreenName(screenName, payload.sub);
      await putUser({
        userId: payload.sub,
        screenName: assigned,
        emailProvided: !!email,
        email: email || null,
      });
      res.json({ ok: true, screenName: assigned });
    } catch (e: any) {
      // If we couldn't reserve a screen name for some reason, surface the error
      return res.status(500).json({ error: e?.message || "signup post-processing failed" });
    }
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "signup failed" });
  }
}

export async function signin(req: Request, res: Response) {
  const { username, password } = (req.body || {}) as any;
  if (!username || !password)
    return res.status(400).json({ error: "username and password required" });
  try {
    const signinResp: any = await localSignIn(username, password);
    const tokens = signinResp.AuthenticationResult;
    if (!tokens?.IdToken || !tokens?.AccessToken)
      return res.status(401).json({ error: "Authentication failed" });

    // Prefer Cognito's canonical username for subsequent refresh flows.
    let canonicalUsername = username;
    try {
      const payload: any = await verifyIdToken(tokens.IdToken);
      canonicalUsername = payload?.["cognito:username"] || canonicalUsername;
    } catch {
      // If token verification fails here, fall back to the provided username.
    }
    setSessionCookies(
      res,
      {
        id_token: tokens.IdToken,
        access_token: tokens.AccessToken,
        refresh_token: tokens.RefreshToken,
        expires_in: tokens.ExpiresIn,
      },
      canonicalUsername
    );
    res.json({ ok: true });
  } catch (e: any) {
    res.status(401).json({ error: e?.message || "signin failed" });
  }
}

export function loginRedirect(req: Request, res: Response) {
  const state = typeof req.query.state === "string" ? req.query.state : "/";
  res.redirect(getLoginUrl(state));
}

export function logout(req: Request, res: Response) {
  // Clear HttpOnly session cookies so the server no longer recognizes the user
  clearSessionCookies(res);
  // Redirect back to the frontend home (or a provided `next` query param).
  // Using the configured `appBaseUrl` ensures users land on the SPA home page.
  const next = typeof req.query?.next === "string" ? req.query.next : undefined;
  const dest = next || config.appBaseUrl || "/";
  res.redirect(dest);
}

// Proactive refresh endpoint. Uses the refreshToken HttpOnly cookie to obtain
// new Id / Access tokens from Cognito. Always attempts refresh; does not wait
// for existing tokens to expire so the client can keep sessions alive
// indefinitely with periodic calls.
export async function refresh(req: Request, res: Response) {
  try {
    const refreshToken = (req as any).cookies?.refreshToken as string | undefined;
    const username = (req as any).cookies?.authUsername as string | undefined;
    if (!refreshToken) return res.status(401).json({ error: "no_refresh_token" });
    const tokens: any = await refreshAuthTokens(refreshToken, username);
    if (!tokens?.IdToken || !tokens?.AccessToken)
      return res.status(401).json({ error: "refresh_failed" });
    setSessionCookies(
      res,
      {
        id_token: tokens.IdToken,
        access_token: tokens.AccessToken,
        refresh_token: tokens.RefreshToken || refreshToken,
        expires_in: tokens.ExpiresIn || 3600,
      },
      username
    );
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(401).json({ error: e?.message || "refresh_failed" });
  }
}
