import { ReactNode, useEffect, useMemo, useState } from "react";
import { buildProfileLink, shareProfileLink } from "../utils/shareProfileLink";

interface ShareFollowCodeCardProps {
  userId: string;
  screenName?: string | null;
  heading?: string;
  description?: string;
  defaultExpanded?: boolean;
  children?: ReactNode;
}

export default function ShareFollowCodeCard({
  userId,
  screenName,
  heading = "Share your follow code",
  description = "Send this link or code to friends so they can follow you instantly.",
  defaultExpanded = false,
  children,
}: ShareFollowCodeCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [hint, setHint] = useState<string | null>(null);
  const profileLink = useMemo(() => buildProfileLink(userId), [userId]);

  useEffect(() => {
    if (!hint) return;
    if (typeof window === "undefined") return;
    const timer = window.setTimeout(() => setHint(null), 2500);
    return () => window.clearTimeout(timer);
  }, [hint]);

  const handleShare = async () => {
    const result = await shareProfileLink({ userId, screenName, isSelf: true });
    if (result.status === "shared") setHint("Sent via your share sheet");
    else if (result.status === "copied") setHint("Profile link copied to clipboard");
    else setHint(`Share this link: ${result.url}`);
  };

  const handleCopyCode = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(userId);
        setHint("Follow code copied");
        return;
      }
    } catch (err) {
      console.warn("copy failed", err);
    }
    setHint(`Code: ${userId}`);
  };

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(profileLink);
        setHint("Profile link copied");
        return;
      }
    } catch (err) {
      console.warn("copy link failed", err);
    }
    setHint(`Link: ${profileLink}`);
  };

  return (
    <section className="border-2 border-flingo-100 rounded-2xl bg-white shadow-card">
      <button
        type="button"
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <span className="text-lg font-bold text-flingo-800">{heading}</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          className={`transition-transform ${expanded ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {expanded && (
        <div className="px-5 pb-5">
          {description && <p className="text-sm text-flingo-600">{description}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <code className="text-xl font-mono font-bold px-4 py-2 rounded-xl bg-gradient-to-r from-flingo-600 to-flingo-700 text-white shadow-fun">
              {userId}
            </code>
            <button
              type="button"
              className="px-4 py-2 text-sm font-semibold border-2 border-flingo-200 rounded-full text-flingo-700 hover:bg-flingo-50 transition-colors"
              onClick={handleCopyCode}
            >
              Copy code
            </button>
            <button
              type="button"
              className="px-4 py-2 text-sm font-semibold border-2 border-flingo-200 rounded-full text-flingo-700 hover:bg-flingo-50 transition-colors"
              onClick={handleCopyLink}
            >
              Copy link
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border-2 border-flingo-500 text-flingo-600 hover:bg-flingo-50 transition-colors"
              onClick={handleShare}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M16 6l-4-4-4 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 2v13"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Share link
            </button>
          </div>
          <p className="mt-3 text-sm text-flingo-600">
            Anyone can open{" "}
            <span className="px-1.5 py-0.5 font-mono text-xs text-flingo-800 bg-flingo-50 rounded break-all">
              {profileLink}
            </span>{" "}
            to follow you instantly.
          </p>
          {children && <div className="mt-4">{children}</div>}
          {hint && <p className="mt-2 text-xs text-candy-mint font-semibold">{hint}</p>}
        </div>
      )}
    </section>
  );
}
