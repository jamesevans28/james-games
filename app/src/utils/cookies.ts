import type { Response } from "express";

export function setSessionCookies(
  res: Response,
  tokens: { id_token: string; access_token: string; refresh_token?: string; expires_in: number },
  username?: string
) {
  // For PWA compatibility, use 'lax' instead of 'none' to avoid issues with mobile/PWA contexts
  // 'lax' allows cookies to be sent on top-level navigation while maintaining security
  const secure = true;
  const sameSite: any = "lax";
  const maxAge = tokens.expires_in * 1000; // ms
  res.cookie("idToken", tokens.id_token, { httpOnly: true, secure, sameSite, maxAge, path: "/" });
  res.cookie("accessToken", tokens.access_token, {
    httpOnly: true,
    secure,
    sameSite,
    maxAge,
    path: "/",
  });
  if (tokens.refresh_token) {
    // Persist refresh token for 365 days so returning users stay signed in
    // even after long idle periods. Note: Cognito's refresh-token TTL must
    // also be configured to >= 365 days for this to be effective.
    const refreshMaxAge = 365 * 24 * 60 * 60 * 1000;
    res.cookie("refreshToken", tokens.refresh_token, {
      httpOnly: true,
      secure,
      sameSite,
      maxAge: refreshMaxAge,
      path: "/",
    });
    // Persist a small username cookie (httpOnly) so server-side refresh can
    // compute SECRET_HASH when the App Client requires a client secret.
    if (username) {
      res.cookie("authUsername", username, {
        httpOnly: true,
        secure,
        sameSite,
        maxAge: refreshMaxAge,
        path: "/",
      });
    }
  }
}

export function clearSessionCookies(res: Response) {
  res.clearCookie("idToken", { path: "/" });
  res.clearCookie("accessToken", { path: "/" });
  res.clearCookie("refreshToken", { path: "/" });
  res.clearCookie("authUsername", { path: "/" });
}
