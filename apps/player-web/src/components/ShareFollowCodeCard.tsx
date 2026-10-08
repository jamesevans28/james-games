import { type ReactNode, useEffect, useState } from "react";
import { adapters } from "../platform/adapters";
import { shareFriendCode } from "../utils/shareProfileLink";

interface ShareFollowCodeCardProps {
  /** The player's own 6-character friend code. */
  friendCode: string;
  heading?: string;
  description?: string;
  children?: ReactNode;
}

/** Your friend code, big and easy to read out, with Copy and Share (T7.6). */
export default function ShareFollowCodeCard({
  friendCode,
  heading = "Your friend code",
  description = "Give this code to a friend. When they send a request, you say yes and you're friends!",
  children,
}: ShareFollowCodeCardProps) {
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (!hint) return;
    const timer = window.setTimeout(() => setHint(null), 2500);
    return () => window.clearTimeout(timer);
  }, [hint]);

  const handleCopy = async () => {
    if (await adapters.share.copy(friendCode)) setHint("Code copied!");
    else setHint(`Your code is ${friendCode}`);
  };

  const handleShare = async () => {
    const result = await shareFriendCode(friendCode);
    if (result.status === "shared") setHint("Sent!");
    else if (result.status === "copied") setHint("Link copied!");
    else setHint(`Share this link: ${result.url}`);
  };

  return (
    <section className="border border-line rounded-2xl bg-card shadow-card p-5">
      <h2 className="text-lg font-bold text-ink">{heading}</h2>
      {description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <code
          className="text-2xl font-mono font-bold tracking-[0.2em] px-4 py-2 rounded-xl bg-brand text-on-brand shadow-sticker"
          aria-label={`Friend code ${friendCode.split("").join(" ")}`}
        >
          {friendCode || "······"}
        </code>
        <button
          type="button"
          className="btn btn-outline text-sm min-h-11"
          onClick={handleCopy}
          disabled={!friendCode}
        >
          Copy
        </button>
        <button
          type="button"
          className="btn btn-outline text-sm min-h-11"
          onClick={handleShare}
          disabled={!friendCode}
        >
          Share
        </button>
      </div>
      <p className="mt-2 min-h-5 text-xs text-brand font-semibold" aria-live="polite">
        {hint}
      </p>
      {children && <div className="mt-2">{children}</div>}
    </section>
  );
}
