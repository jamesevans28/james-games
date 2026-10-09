import { useEffect, useState, type ReactNode } from "react";
import { adapters } from "../platform/adapters";
import {
  isCorrect,
  makeChallenge,
  onGrownUpRequest,
  settleGrownUp,
  type GateChallenge,
} from "../platform/parentGate";

/**
 * A link that leaves the app (an external page or an email). On the web it's a
 * plain link; inside the apps it goes through adapters.app.openUrl, which asks a
 * grown-up first (T10.7).
 */
export default function GrownUpLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const external = /^https?:/.test(href);
  return (
    <a
      href={href}
      className={className}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      onClick={(e) => {
        if (!adapters.app.isNative) return;
        e.preventDefault();
        adapters.app.openUrl(href);
      }}
    >
      {children}
    </a>
  );
}

/** The grown-ups-only question, shown whenever requestGrownUp() is called. Mount once. */
export function GrownUpGateHost() {
  const [challenge, setChallenge] = useState<GateChallenge | null>(null);
  const [answer, setAnswer] = useState("");
  const [wrong, setWrong] = useState(false);

  useEffect(
    () =>
      onGrownUpRequest((open) => {
        setChallenge(open ? makeChallenge() : null);
        setAnswer("");
        setWrong(false);
      }),
    [],
  );

  if (!challenge) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="grown-up-title"
      className="fixed inset-0 z-[11000] flex items-center justify-center bg-scrim/60 p-4"
    >
      <form
        className="card w-full max-w-sm space-y-3 p-5 text-ink"
        onSubmit={(e) => {
          e.preventDefault();
          if (isCorrect(challenge, answer)) {
            settleGrownUp(true);
          } else {
            setWrong(true);
            setChallenge(makeChallenge());
            setAnswer("");
          }
        }}
      >
        <h2 id="grown-up-title" className="font-display text-xl font-extrabold">
          Grown-ups only
        </h2>
        <p className="text-sm text-ink-2">This opens something outside the games.</p>
        <label className="block font-bold">
          {challenge.question}
          <input
            inputMode="numeric"
            autoComplete="off"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className="mt-2 w-full rounded-xl border border-line bg-paper-2 p-3 text-ink"
          />
        </label>
        {wrong && <p className="text-sm text-ink-2">Not quite. Here&apos;s another one.</p>}
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-outline min-h-11 flex-1"
            onClick={() => settleGrownUp(false)}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary min-h-11 flex-1">
            Continue
          </button>
        </div>
      </form>
    </div>
  );
}
