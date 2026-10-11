import { useState } from "react";
import { useAuth } from "../../context/AuthProvider";
import { adapters } from "../../platform/adapters";
import { errorMessage } from "../../utils/errorCode";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OFFLINE = "You're offline. Connect to the internet first.";

const inputClass =
  "w-full bg-paper-2 border border-line rounded-xl px-4 py-3 text-sm text-ink placeholder-ink-3 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50 transition-all";

/**
 * Settings → "A grown-up's email" (username + PIN accounts). Supabase emails the address
 * a 6-digit code; once confirmed it can sign in with an emailed code when the PIN is
 * forgotten. Other players never see it.
 */
export default function EmailSection() {
  const { user, addEmail, confirmEmail } = useAuth();
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const current = user?.email ?? null;
  const showForm = editing || !current;

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    const wanted = email.trim();
    if (!EMAIL_PATTERN.test(wanted)) return setError("That doesn't look like an email address.");
    if (!adapters.network.isOnline()) return setError(OFFLINE);
    setBusy(true);
    try {
      await addEmail(wanted);
      setSentTo(wanted);
      setCode("");
    } catch (err) {
      setError(errorMessage(err, "We couldn't send the code. Try again?"));
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!sentTo) return;
    setError(null);
    if (!/^\d{6}$/.test(code.trim())) return setError("The code is 6 numbers.");
    if (!adapters.network.isOnline()) return setError(OFFLINE);
    setBusy(true);
    try {
      await confirmEmail(sentTo, code);
      setDone(true);
      setSentTo(null);
      setEditing(false);
      setEmail("");
    } catch (err) {
      setError(errorMessage(err, "That code didn't work. Try again?"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="p-5 bg-card rounded-2xl border border-line mb-6">
      <h2 className="text-lg font-bold mb-2 text-ink">A grown-up&apos;s email</h2>
      <p className="text-sm text-ink-2 mb-4">
        Optional. If the PIN is ever forgotten, we can email this address a code to sign in. Other
        players never see it, and we don&apos;t send anything else.
      </p>

      {current && !showForm && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold text-ink break-all">{current}</span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="btn btn-outline text-sm"
          >
            Change
          </button>
        </div>
      )}

      {showForm && !sentTo && (
        <form onSubmit={(e) => void sendCode(e)} className="space-y-3">
          <label className="block">
            <span className="block text-sm font-bold text-ink mb-1.5">Email address</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="grown-up@example.com"
            />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !email} className="btn btn-primary text-sm">
              {busy ? "Sending..." : "Send a code"}
            </button>
            {current && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="btn btn-outline text-sm"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {sentTo && (
        <form onSubmit={(e) => void confirm(e)} className="space-y-3">
          <p className="text-sm text-ink">
            We emailed a 6-digit code to <strong className="break-all">{sentTo}</strong>. It works
            for 15 minutes.
          </p>
          <label className="block max-w-xs">
            <span className="block text-sm font-bold text-ink mb-1.5">Code</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className={`${inputClass} font-mono text-xl tracking-widest`}
              placeholder="123456"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="btn btn-primary text-sm"
            >
              {busy ? "Checking..." : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => {
                setSentTo(null);
                setError(null);
              }}
              className="btn btn-outline text-sm"
            >
              Use a different email
            </button>
          </div>
        </form>
      )}

      <p className="mt-2 min-h-5 text-sm font-medium" aria-live="polite">
        {error ? (
          <span className="text-grape">{error}</span>
        ) : done ? (
          <span className="text-brand">✓ Email saved.</span>
        ) : null}
      </p>
    </section>
  );
}
