const DEFAULT_BASE = "https://games4james.com";

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
  const name = opts.screenName?.trim() || "Games4James player";
  const shareData = {
    title: `${name} on Games4James`,
    text: opts.isSelf
      ? `Follow me on Games4James! Here's my link: ${url}`
      : `Follow ${name} on Games4James: ${url}`,
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
