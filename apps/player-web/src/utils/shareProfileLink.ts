import { brand } from "../config/brand";

const DEFAULT_BASE = brand.origin;

export function buildProfileLink(userId: string) {
  if (!userId) return DEFAULT_BASE;
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin.replace(/\/$/, "")}/profile/${userId}`;
  }
  return `${DEFAULT_BASE}/profile/${userId}`;
}

export async function shareProfileLink(opts: {
  userId: string;
  screenName?: string | null;
  isSelf?: boolean;
}) {
  const url = buildProfileLink(opts.userId);
  const name = opts.screenName?.trim() || `${brand.name} player`;
  const shareData = {
    title: `${name} on ${brand.name}`,
    text: opts.isSelf
      ? `Follow me on ${brand.name}! Here's my link: ${url}`
      : `Follow ${name} on ${brand.name}: ${url}`,
    url,
  };

  try {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      await (navigator as any).share(shareData);
      return { status: "shared" as const, url };
    }
  } catch (err) {
    console.warn("Share failed", err);
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return { status: "copied" as const, url };
  }

  return { status: "link" as const, url };
}
