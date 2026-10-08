import { brand } from "../config/brand";
import { adapters } from "../platform/adapters";

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
  const result = await adapters.share.share(shareData);
  if (result === "shared") return { status: "shared", url };
  // "copied": no share sheet, so the adapter copied the link. A closed sheet
  // ("cancelled") still falls back to copying; if the clipboard is blocked, show the link.
  if (result === "copied" || (result === "cancelled" && (await adapters.share.copy(url)))) {
    return { status: "copied", url };
  }
  return { status: "link", url };
}
