import { useState, type FormEvent } from "react";
import { sendFriendRequest } from "../../lib/api";
import { cleanFriendCodeInput, friendErrorMessage, normalizeFriendCode } from "../../utils/friends";

/** "Add a friend": type their 6-character code and send a request. No search by name. */
export default function AddFriendForm({
  initialCode = "",
  run,
  onSent,
}: {
  initialCode?: string;
  run: <T>(action: () => Promise<T>) => Promise<T>;
  onSent?: () => void;
}) {
  const [code, setCode] = useState(() => cleanFriendCodeInput(initialCode));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const valid = normalizeFriendCode(code);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) {
      setMessage({ ok: false, text: friendErrorMessage(new Error("invalid_code")) });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await run(() => sendFriendRequest(valid));
      setMessage({
        ok: true,
        text:
          res.status === "friends"
            ? "You're friends now!"
            : "Request sent! They'll see it next time they visit.",
      });
      setCode("");
      onSent?.();
    } catch (err) {
      setMessage({ ok: false, text: friendErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-line rounded-2xl bg-card shadow-card p-5"
      noValidate
    >
      <label htmlFor="friend-code-input" className="text-lg font-bold text-ink">
        Add a friend
      </label>
      <p id="friend-code-help" className="mt-1 text-sm text-ink-2">
        Ask your friend for their 6-character friend code and type it here.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          id="friend-code-input"
          type="text"
          value={code}
          onChange={(e) => {
            setCode(cleanFriendCodeInput(e.target.value));
            setMessage(null);
          }}
          className="min-w-0 flex-1 min-h-11 bg-paper-2 border border-line rounded-full px-4 text-lg font-mono font-bold tracking-[0.2em] text-ink placeholder-ink-3 focus:border-brand/50 focus:ring-2 focus:ring-brand/30 focus:outline-none"
          placeholder="AB3C9H"
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby="friend-code-help friend-code-message"
        />
        <button
          type="submit"
          className="btn btn-primary min-h-11 shrink-0 disabled:opacity-60"
          disabled={busy || !valid}
        >
          {busy ? "Sending…" : "Send"}
        </button>
      </div>
      <p
        id="friend-code-message"
        className={`mt-2 min-h-5 text-sm font-medium ${message?.ok ? "text-brand" : "text-ink-2"}`}
        aria-live="polite"
      >
        {message?.text}
      </p>
    </form>
  );
}
