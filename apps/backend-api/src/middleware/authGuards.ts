// Auth guards and user attachment middleware
import type { Request, Response, NextFunction } from "express";
import { verifyIdToken, refreshAuthTokens } from "../services/authService.js";
import { getUser } from "../services/dynamoService.js";
import { setSessionCookies } from "../utils/cookies.js";

export async function attachUser(req: Request, res: Response, next: NextFunction) {
  // @ts-ignore
  req.user = undefined;
  const bearer = req.headers.authorization?.toString();
  let token: string | undefined;
  if (bearer?.startsWith("Bearer ")) token = bearer.slice(7);
  else if (typeof (req as any).cookies?.idToken === "string") token = (req as any).cookies.idToken;
  if (!token) return next();
  try {
    const payload = await verifyIdToken(token);
    // @ts-ignore
    req.user = {
      userId: payload.sub,
      email: payload.email,
      emailProvided: payload["custom:email_provided"] === "true",
    };
  } catch {
    // Token verify failed (likely expired). Attempt refresh flow using refreshToken cookie.
    try {
      const refreshToken = (req as any).cookies?.refreshToken as string | undefined;
      const username = (req as any).cookies?.authUsername as string | undefined;
      if (refreshToken) {
        const newTokens: any = await refreshAuthTokens(refreshToken, username);
        if (newTokens?.IdToken && newTokens?.AccessToken) {
          // Persist refreshed tokens in cookies. Use returned RefreshToken if present, otherwise keep existing.
          setSessionCookies(
            res,
            {
              id_token: newTokens.IdToken,
              access_token: newTokens.AccessToken,
              refresh_token: newTokens.RefreshToken || refreshToken,
              expires_in: newTokens.ExpiresIn || 3600,
            },
            username
          );
          // Verify the new id token and attach user
          const payload = await verifyIdToken(newTokens.IdToken);
          // @ts-ignore
          req.user = {
            userId: payload.sub,
            email: payload.email,
            emailProvided: payload["custom:email_provided"] === "true",
          };
        }
      }
    } catch {
      // ignore refresh failures
    }
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // @ts-ignore
  if (!req.user?.userId) return res.status(401).json({ error: "unauthorized" });
  next();
}

export async function requireValidatedEmail(req: Request, res: Response, next: NextFunction) {
  // @ts-ignore
  if (!req.user?.userId) return res.status(401).json({ error: "unauthorized" });
  try {
    // Check validation status from users table
    const profile = await getUser((req as any).user.userId);
    if (profile?.validated) return next();
    return res.status(403).json({ error: "email_not_validated" });
  } catch (e) {
    return res.status(500).json({ error: "validation_check_failed" });
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  // @ts-ignore
  if (!req.user?.userId) return res.status(401).json({ error: "unauthorized" });
  try {
    const profile = await getUser((req as any).user.userId);
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
