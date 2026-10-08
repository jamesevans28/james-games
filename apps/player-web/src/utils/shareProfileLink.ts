import { brand } from "../config/brand";

/**
 * Sharing a friend code (T7.6). The link opens the Friends page with the code
 * filled in; the other player still has to send a request and you still have to
 * say yes. Profiles are never found by name.
 */

function origin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  return brand.origin;
}

/** `https://games4james.com/followers?code=AB3C9H` */
export function buildFriendLink(friendCode: string): string {
  return `${origin()}/followers?code=${encodeURIComponent(friendCode)}`;
}

export type ShareResult = { status: "shared" | "copied" | "link"; url: string };

/** Opens the share sheet, or copies the link, or hands back the link to show. */
export async function shareFriendCode(friendCode: string): Promise<ShareResult> {
  const url = buildFriendLink(friendCode);
  const shareData = {
    title: `Be my friend on ${brand.name}`,
    text: `Add me as a friend on ${brand.name}! My friend code is ${friendCode}.`,
    url,
  };
  try {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      await navigator.share(shareData);
      return { status: "shared", url };
    }
  } catch {
    // Cancelled or not allowed: fall back to copying.
  }
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return { status: "copied", url };
    }
  } catch {
    // Clipboard blocked: show the link instead.
  }
  return { status: "link", url };
}
