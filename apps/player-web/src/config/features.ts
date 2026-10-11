/**
 * Feature switches. Flip one here, never with scattered conditions.
 *
 * socialSignIn: the "Continue with Google / Apple" buttons and the Settings
 * "Linked accounts" card. Off since 2026-10-11 (James): sign-in is guest or
 * username + PIN until a provider is wanted. The flows behind the buttons stay
 * in AuthProvider so turning them back on is this one line plus the provider
 * setup in docs/plan/14-supabase-auth.md.
 */
export const features = {
  socialSignIn: false,
} as const;
