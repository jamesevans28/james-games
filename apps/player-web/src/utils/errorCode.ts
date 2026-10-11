/**
 * A loggable summary of an error: its code or name, never the object itself.
 * Auth-library errors can carry request details, so raw errors must not be
 * logged (org rule: no PII in logs).
 */
export function errorCode(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { code?: unknown; name?: unknown };
    if (typeof e.code === "string") return e.code;
    if (typeof e.name === "string") return e.name;
  }
  return "error";
}

/**
 * Kid-friendly text for the Supabase Auth error codes a player can actually hit.
 * https://supabase.com/docs/guides/auth/debugging/error-codes
 */
const AUTH_MESSAGES: Record<string, string> = {
  anonymous_provider_disabled: "Playing as a guest is switched off right now. Try again later.",
  otp_expired: "That code didn't work, or it ran out. Please try again.",
  identity_already_exists: "That account is already joined to a different player.",
  over_request_rate_limit: "Too many tries. Take a break and try again in a little while.",
  session_expired: "You were signed out. Please sign in again.",
  refresh_token_not_found: "You were signed out. Please sign in again.",
  access_denied: "Sign-in was cancelled.",
  social_sign_in_unavailable: "That sign-in isn't available in the app yet.",
  email_exists: "That email is already on another account.",
  email_address_invalid: "That email address can't be used. Try another one?",
  over_email_send_rate_limit: "We've sent too many emails for now. Try again in an hour.",
  // Supabase's built-in sender only reaches the project's team until our own mail server is set up.
  email_address_not_authorized:
    "We can't send email to that address yet. Ask a grown-up to tell us.",
  same_email: "That's already the email on this account.",
};

/** Supabase's AuthError (and our redirect errors) carry this flag. */
function isAuthError(err: object): err is { code?: unknown } {
  return (err as { __isAuthError?: unknown }).__isAuthError === true;
}

/**
 * A message to show the user for a caught error. Auth errors get friendly text for
 * known codes and the fallback otherwise (their messages are for developers); other
 * errors show their `message` when it has one. For UI only; do not log the result.
 */
export function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object") {
    const code = (err as { code?: unknown }).code;
    if (typeof code === "string" && AUTH_MESSAGES[code]) return AUTH_MESSAGES[code];
    if (isAuthError(err)) return fallback;
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}
