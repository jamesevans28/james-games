/**
 * Admin switches. Sign-in is an emailed 6-digit code to the admin's own email (attached
 * in the player app's Settings). Google stays in the code for when the Supabase Google
 * provider is set up (docs/supabase-auth-setup.md).
 */
export const adminConfig = {
  googleSignIn: false,
} as const;
