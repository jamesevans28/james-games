import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../../context/FirebaseAuthProvider";
import { adapters } from "../../platform/adapters";
import { errorMessage } from "../../utils/errorCode";

const CONFIRM_WORD = "DELETE";

/**
 * "Delete my account" (T7.8). Two steps: open the panel, then type DELETE and
 * press the button. On success the player is signed out and sent home.
 */
export default function DeleteAccountSection() {
  const { deleteAccount, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmed = typed.trim().toUpperCase() === CONFIRM_WORD;

  function close() {
    setOpen(false);
    setTyped("");
    setError(null);
  }

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmed || busy) return;
    if (!adapters.network.isOnline()) {
      setError("You're offline. Connect to the internet first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteAccount();
    } catch (err) {
      setError(errorMessage(err, "We couldn't delete your account. Try again?"));
      setBusy(false);
      return;
    }
    // Leave Settings before signing out, or its guard would bounce to the login page.
    void navigate("/", { replace: true });
    try {
      await signOut();
    } catch {
      // The account is already gone; the local session clears on the next load.
    }
  }

  return (
    <section
      aria-labelledby="delete-account-title"
      className="p-5 bg-card rounded-2xl border border-line mt-6"
    >
      <h2 id="delete-account-title" className="text-lg font-bold mb-2 text-ink">
        Delete my account
      </h2>
      <p className="text-sm text-ink-2 mb-4">
        This removes your account for good: your name leaves the leaderboards, and your friends,
        stickers and settings are gone. It can&rsquo;t be undone.{" "}
        <Link to="/privacy#delete" className="underline font-semibold text-ink">
          What gets deleted
        </Link>
      </p>

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="btn btn-outline text-sm">
          Delete my account…
        </button>
      ) : (
        <form onSubmit={handleDelete} className="space-y-3">
          <label className="block">
            <span className="block text-sm font-bold text-ink mb-2">
              Type {CONFIRM_WORD} to be sure
            </span>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="w-full bg-paper-2 border border-line rounded-xl px-4 py-3 text-base text-ink placeholder-ink-3 focus:outline-none focus:ring-2 focus:ring-tomato/50 focus:border-tomato/50 transition-all"
              placeholder={CONFIRM_WORD}
              aria-describedby={error ? "delete-account-error" : undefined}
            />
          </label>

          {error && (
            <div
              id="delete-account-error"
              role="alert"
              className="p-3 bg-grape/10 border border-grape/30 text-grape text-sm rounded-xl font-medium"
            >
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={!confirmed || busy}
              className="btn bg-tomato text-on-brand text-sm disabled:cursor-not-allowed"
            >
              {busy ? "Deleting…" : "Delete for good"}
            </button>
            <button
              type="button"
              onClick={close}
              disabled={busy}
              className="btn btn-outline text-sm"
            >
              Keep my account
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
