import type { Response } from "express";

export function setSessionCookies(
  res: Response,
  tokens: { id_token: string; access_token: string; refresh_token?: string; expires_in: number }
) {
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
    res.cookie("refreshToken", tokens.refresh_token, {
      httpOnly: true,
      secure,
      sameSite,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: "/",
    });
  }
}

export function clearSessionCookies(res: Response) {
  res.clearCookie("idToken", { path: "/" });
  res.clearCookie("accessToken", { path: "/" });
  res.clearCookie("refreshToken", { path: "/" });
}
