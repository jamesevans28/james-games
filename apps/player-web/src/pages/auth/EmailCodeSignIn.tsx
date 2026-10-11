import { useState } from "react";
import { useAuth } from "../../context/AuthProvider";
import { adapters } from "../../platform/adapters";
import { errorMessage } from "../../utils/errorCode";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OFFLINE = "You're offline. Connect to the internet to sign in.";

const inputClass =
  "w-full p-3.5 bg-paper-2 border border-line rounded-2xl placeholder-ink-3 text-ink focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50 transition-all";

/**
 * Sign in with a 6-digit code emailed to the grown-up's address on the account (the way
 * back in when the PIN is forgotten). Never creates an account, and answers the same way
 * whether or not the address is known.
 */
export default function EmailCodeSignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const { sendEmailCode, signInWithEmailCode, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const wanted = email.trim();
    if (!EMAIL_PATTERN.test(wanted)) return setError("That doesn't look like an email address.");
    if (!adapters.network.isOnline()) return setError(OFFLINE);
    setBusy(true);
    try {
      await sendEmailCode(wanted);
      setSentTo(wanted);
      setCode("");
    } catch (err) {
      setError(errorMessage(err, "We couldn't send a code. Try again?"));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!sentTo) return;
    setError(null);
    if (!/^\d{6}$/.test(code)) return setError("The code is 6 numbers.");
    if (!adapters.network.isOnline()) return setError(OFFLINE);
    try {
      await signInWithEmailCode(sentTo, code);
      onSignedIn();
    } catch (err) {
      setError(errorMessage(err, "That code didn't work. Try again?"));
    }
  }

  return (
    <div className="space-y-4">
      {!sentTo ? (
        <form onSubmit={(e) => void send(e)} className="space-y-4">
          <label className="block">
            <div className="text-sm font-bold text-ink mb-1.5">Grown-up&apos;s email</div>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="The email added in Settings"
            />
          </label>
          <button type="submit" disabled={busy || !email} className="btn btn-primary w-full py-3.5">
            {busy ? "Sending..." : "Email me a code"}
          </button>
        </form>
      ) : (
        <form onSubmit={(e) => void verify(e)} className="space-y-4">
          <p className="text-sm text-ink">
            If <strong className="break-all">{sentTo}</strong> is on an account, we&apos;ve emailed
            it a 6-digit code. It works for 15 minutes.
          </p>
          <label className="block">
            <div className="text-sm font-bold text-ink mb-1.5">Code</div>
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
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="btn btn-primary w-full py-3.5"
          >
            {loading ? "Please wait..." : "Sign in"}
          </button>
          <button
            type="button"
            onClick={() => {
              setSentTo(null);
              setError(null);
            }}
            className="w-full text-sm font-bold text-brand underline min-h-11"
          >
            Use a different email
          </button>
        </form>
      )}
      {error && (
        <div className="p-3 bg-grape/10 border border-grape/30 rounded-2xl text-grape text-sm font-medium">
          {error}
        </div>
      )}
    </div>
  );
}
