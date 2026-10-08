/**
 * Friends helpers (T7.6): friend-code input and kind words for the server's codes.
 * Codes are 6 characters from 2-9 and A-H; typing is forgiving (any case, spaces, dashes).
 */

export const FRIEND_CODE_LENGTH = 6;
const FRIEND_CODE_PATTERN = /^[2-9A-H]{6}$/;

/** What the input box should show while typing: upper case, no spaces or dashes, max 6. */
export function cleanFriendCodeInput(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase().slice(0, FRIEND_CODE_LENGTH);
}

/** The canonical code, or null when what was typed can't be one. */
export function normalizeFriendCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.replace(/[\s-]/g, "").toUpperCase();
  return FRIEND_CODE_PATTERN.test(code) ? code : null;
}

const MESSAGES: Record<string, string> = {
  invalid_code: "Friend codes have 6 letters and numbers. Check it and try again.",
  code_not_found: "We couldn't find that code. Check it with your friend.",
  cannot_friend_self: "That's your own code! Share it with a friend instead.",
  request_already_sent: "You've already asked them. Now we wait for a yes!",
  already_friends: "You're already friends!",
  request_not_found: "That request isn't there any more.",
  account_upgrade_required: "Make a username first, then you can add friends.",
  account_disabled: "Adding friends is switched off for this account.",
  signin_required: "Sign in to see your friends.",
  cannot_block_self: "You can't block yourself.",
};

/** A short, friendly message for a failed friends call (the server sends a code). */
export function friendErrorMessage(err: unknown, fallback = "Something went wrong. Try again?") {
  const message =
    err && typeof err === "object" ? (err as { message?: unknown }).message : undefined;
  return (typeof message === "string" && MESSAGES[message]) || fallback;
}
