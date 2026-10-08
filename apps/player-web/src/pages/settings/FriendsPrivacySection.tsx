import { useState } from "react";
import { Link } from "react-router";
import { useSharePresence } from "../../hooks/useFriends";

/** Settings → "Friends & privacy" (T7.6). Sharing that you're online is off unless switched on. */
export default function FriendsPrivacySection() {
  const { sharePresence, loaded, saving, setSharePresence } = useSharePresence();
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    setError(null);
    try {
      await setSharePresence(!sharePresence);
    } catch {
      setError("That didn't save. Try again?");
    }
  };

  return (
    <section className="p-5 bg-card rounded-2xl border border-line mb-6">
      <h2 className="text-lg font-bold mb-4 text-ink">Friends &amp; privacy</h2>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p id="share-presence-label" className="text-base font-bold text-ink">
            Show friends when I'm online
          </p>
          <p id="share-presence-help" className="text-sm text-ink-2">
            Only your friends see it, and only the word "Online". Never what you're playing.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={sharePresence}
          aria-labelledby="share-presence-label"
          aria-describedby="share-presence-help"
          disabled={!loaded || saving}
          onClick={() => void toggle()}
          className={`relative inline-flex h-11 w-[4.5rem] shrink-0 items-center rounded-full border-2 border-edge transition-colors motion-reduce:transition-none disabled:opacity-60 ${
            sharePresence ? "bg-grass" : "bg-paper-2"
          }`}
        >
          <span
            className={`inline-block h-8 w-8 rounded-full border-2 border-edge bg-card transition-transform motion-reduce:transition-none ${
              sharePresence ? "translate-x-8" : "translate-x-1"
            }`}
            aria-hidden
          />
        </button>
      </div>
      <p className="mt-2 min-h-5 text-sm font-medium text-grape" aria-live="polite">
        {error}
      </p>
      <p className="text-sm text-ink-2">
        Friends are only added with friend codes, and you can remove or block anyone on your{" "}
        <Link to="/followers" className="font-bold text-brand hover:underline">
          Friends page
        </Link>
        .
      </p>
    </section>
  );
}
