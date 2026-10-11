import { useState } from "react";
import { Navigate, useLocation } from "react-router";
import { useAdminAuth } from "../context/AdminAuthContext";
import { adminConfig } from "../config";

const inputClass =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-sky-400 focus:outline-none";
const primaryButton =
  "mt-4 w-full rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:opacity-60";

/** Text for a Supabase auth error, from its code; never its raw message. */
function messageFor(err: unknown, fallback: string): string {
  const code = err && typeof err === "object" ? (err as { code?: unknown }).code : undefined;
  if (code === "otp_expired") return "That code didn't work or has run out. Send a new one.";
  if (code === "over_email_send_rate_limit") return "Too many emails sent. Try again in an hour.";
  if (code === "email_address_not_authorized") {
    return "Supabase's built-in mailer only sends to the project's team. Set up SMTP (docs/supabase-auth-setup.md).";
  }
  return fallback;
}

export function LoginPage() {
  const { signInWithGoogle, sendEmailCode, signInWithEmailCode, user, loading } = useAdminAuth();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const redirectPath =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || "/users";

  if (!loading && user) {
    return <Navigate to={redirectPath} replace />;
  }

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await sendEmailCode(email);
      setSentTo(email.trim());
      setCode("");
    } catch (err) {
      setError(messageFor(err, "Couldn't send a code. Try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sentTo) return;
    setError(null);
    setSubmitting(true);
    try {
      const isAdmin = await signInWithEmailCode(sentTo, code);
      if (!isAdmin) setError("That account isn't an admin.");
    } catch (err) {
      setError(messageFor(err, "That code didn't work. Try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setSubmitting(true);
    try {
      // A redirect: the page leaves for Google and comes back to "/" signed in.
      await signInWithGoogle();
    } catch (err) {
      setError(messageFor(err, "Sign in failed. Make sure you have admin access."));
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-8 text-white">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-white/10 bg-slate-950/70 p-8 shadow-2xl backdrop-blur">
        <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Games4James</p>
        <h1 className="mt-2 text-3xl font-semibold">Admin Access</h1>
        <p className="mt-2 text-sm text-slate-400">
          We&apos;ll email you a 6-digit code. Only accounts marked admin can get in.
        </p>

        {error && (
          <p className="mt-6 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </p>
        )}

        {!sentTo ? (
          <form onSubmit={(e) => void handleSendCode(e)} className="mt-8">
            <label className="block text-sm text-slate-300">
              Email
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@example.com"
              />
            </label>
            <button type="submit" disabled={submitting || !email} className={primaryButton}>
              {submitting ? "Sending..." : "Email me a code"}
            </button>
          </form>
        ) : (
          <form onSubmit={(e) => void handleVerify(e)} className="mt-8">
            <p className="text-sm text-slate-300">
              If {sentTo} is on an account, a code is on its way.
            </p>
            <label className="mt-4 block text-sm text-slate-300">
              Code
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                className={`${inputClass} font-mono tracking-widest`}
                placeholder="123456"
              />
            </label>
            <button
              type="submit"
              disabled={submitting || code.length !== 6}
              className={primaryButton}
            >
              {submitting ? "Checking..." : "Sign in"}
            </button>
            <button
              type="button"
              onClick={() => setSentTo(null)}
              className="mt-3 w-full text-sm text-slate-400 underline"
            >
              Use a different email
            </button>
          </form>
        )}

        {/* Google: hidden until the Supabase Google provider is set up (adminConfig). */}
        {adminConfig.googleSignIn && (
          <button
            onClick={handleGoogleSignIn}
            disabled={submitting}
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl bg-white hover:bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900 transition disabled:opacity-60"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {submitting ? "Signing in..." : "Sign in with Google"}
          </button>
        )}
      </div>
    </div>
  );
}
