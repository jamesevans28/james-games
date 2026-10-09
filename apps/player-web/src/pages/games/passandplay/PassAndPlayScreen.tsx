import { useEffect } from "react";
import { outcomeLine, passAndPlayWinner, type PassAndPlayState } from "./passAndPlay";

type Props = {
  state: PassAndPlayState;
  /** Hand-off: player 2 is holding the phone, start their run. */
  onReady: () => void;
  /** Result: both play again, player 1 first. */
  onPlayAgain: () => void;
  /** Leave two-player mode and go back to the game's page. */
  onDone: () => void;
};

/**
 * The screens between and after the two turns (T11.6): "Pass to <name>!" and then
 * who won. Shown over the game; nothing here is sent to the server.
 */
export default function PassAndPlayScreen({ state, onReady, onPlayAgain, onDone }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDone();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  if (state.stage === "turn") return null;
  const [first, second] = state.names;
  const [a, b] = state.scores;

  return (
    <div className="fixed inset-0 z-[10000] flex items-end justify-center sm:items-center">
      <div aria-hidden className="absolute inset-0 bg-scrim/70 backdrop-blur-sm" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pass-play-title"
        className="relative mx-3 mb-4 w-full max-w-md rounded-3xl border-2 border-edge bg-card shadow-sticker-lg sm:mb-0"
      >
        {state.stage === "handoff" ? (
          <div className="px-5 pb-5 pt-6 text-center">
            <p className="text-sm font-bold text-ink-2">
              {first} scored <span className="font-extrabold text-ink">{a ?? 0}</span>
            </p>
            <h2
              id="pass-play-title"
              className="mt-3 font-display text-4xl font-extrabold leading-tight text-brand"
            >
              Pass to {second}!
            </h2>
            <p className="kid-note mt-2 text-ink-2">Ready when you are.</p>
            <button
              type="button"
              autoFocus
              className="btn btn-primary mt-5 w-full py-4 text-xl"
              onClick={onReady}
            >
              I&rsquo;m ready!
            </button>
            <button type="button" className="btn btn-outline mt-3 w-full" onClick={onDone}>
              Stop
            </button>
          </div>
        ) : (
          <Result state={state} onPlayAgain={onPlayAgain} onDone={onDone} a={a ?? 0} b={b ?? 0} />
        )}
      </section>
    </div>
  );
}

function Result({
  state,
  a,
  b,
  onPlayAgain,
  onDone,
}: {
  state: PassAndPlayState;
  a: number;
  b: number;
  onPlayAgain: () => void;
  onDone: () => void;
}) {
  const outcome = passAndPlayWinner(
    { name: state.names[0], score: a },
    { name: state.names[1], score: b },
  );
  const rows = [
    { name: state.names[0], score: a, won: outcome.kind === "win" && outcome.winner === 0 },
    { name: state.names[1], score: b, won: outcome.kind === "win" && outcome.winner === 1 },
  ];
  return (
    <div className="px-5 pb-5 pt-6 text-center">
      <h2
        id="pass-play-title"
        className="inline-block rounded-full border-2 border-edge bg-sun px-4 py-1 font-display text-2xl font-extrabold text-on-accent shadow-sticker"
      >
        {outcomeLine(outcome)}
      </h2>
      <ul className="mt-4 grid grid-cols-2 gap-3">
        {rows.map((r, i) => (
          <li
            key={i}
            className={`rounded-2xl border-2 p-3 ${r.won ? "border-edge bg-paper-2" : "border-line"}`}
          >
            <span className="block truncate text-sm font-bold text-ink-2">{r.name}</span>
            <span className="block font-display text-4xl font-extrabold text-ink">{r.score}</span>
            {r.won && (
              <span className="mt-1 block text-xs font-extrabold uppercase text-brand">Winner</span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-2">Two-player scores stay on this phone.</p>
      <div className="mt-4 flex flex-col gap-3">
        <button
          type="button"
          autoFocus
          className="btn btn-primary w-full py-4 text-xl"
          onClick={onPlayAgain}
        >
          Play again
        </button>
        <button type="button" className="btn btn-outline w-full" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}
