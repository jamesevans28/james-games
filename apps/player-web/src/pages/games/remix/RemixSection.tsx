import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../../../context/FirebaseAuthProvider";
import type { Remix } from "../../../lib/api";
import { adapters } from "../../../platform/adapters";
import { defaultValues, formatKnob, type RemixValues } from "../../../platform/remix";
import RemixPanel from "./RemixPanel";
import { remixBoardPath, remixShareData } from "./remixLinks";
import type { ActiveRemixState } from "./useActiveRemix";

const SHARE_FEEDBACK: Partial<Record<string, string>> = {
  copied: "Link copied!",
  failed: "Try again",
};

type Props = {
  gameId: string;
  gameTitle: string;
  remix: ActiveRemixState;
  /** Starts a run with whatever remix is active (the landing's own Play). */
  onPlay: () => void;
};

/**
 * Remix on the game's landing page (T11.2): a "Remix" button that opens the sliders,
 * or, while a remix is on, a card with its name, what it changes, its board, share
 * and a way back to the normal game. Games without knobs show nothing.
 */
export default function RemixSection({ gameId, gameTitle, remix, onPlay }: Props) {
  const { user } = useAuth();
  const canSave = Boolean(user && !user.isAnonymous && user.accountType !== "anonymous");
  const [panel, setPanel] = useState<null | "sliders" | "save">(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const { knobs, active, saved } = remix;

  useEffect(() => {
    if (!shareFeedback) return;
    const t = window.setTimeout(() => setShareFeedback(null), 2500);
    return () => window.clearTimeout(t);
  }, [shareFeedback]);

  if (knobs.length === 0) return null;

  const playValues = (values: RemixValues) => {
    // Same render batch: PlayGame makes the host after this commit, with these values.
    remix.playValues(values);
    setPanel(null);
    onPlay();
  };
  const adopt = (r: Remix) => {
    remix.adoptSaved(r);
    setPanel(null);
  };
  const share = async () => {
    if (!saved) return;
    const result = await adapters.share.share(
      remixShareData({ gameId, gameTitle, remixId: saved.id, name: saved.name }),
    );
    setShareFeedback(SHARE_FEEDBACK[result] ?? null);
  };

  const changed = active
    ? knobs.filter((k) => (active.values[k.key] ?? k.default) !== k.default)
    : [];
  const maker = saved?.isMine ? "you" : saved?.owner?.screenName;

  return (
    <>
      {remix.loading && (
        <p className="mt-4 text-center text-base text-ink-2" role="status">
          Loading the remix…
        </p>
      )}
      {(remix.missing || remix.failed) && !active && (
        <div className="card mt-4 p-4 text-center">
          <p className="text-base text-ink-2">
            {remix.missing
              ? "We couldn't find that remix. Here's the normal game."
              : "That remix will load when you're back online."}
          </p>
          <button type="button" className="btn btn-outline mt-3 min-h-11" onClick={remix.clear}>
            OK
          </button>
        </div>
      )}

      {active ? (
        <section className="card mt-4 p-4" aria-labelledby="remix-on">
          <p className="inline-block rounded-full border-2 border-edge bg-sun px-3 py-0.5 text-sm font-extrabold text-on-accent">
            Remix on
          </p>
          <h2 id="remix-on" className="mt-2 font-display text-xl font-extrabold text-ink">
            {active.name ?? "Your remix (not saved)"}
          </h2>
          {maker && <p className="text-base text-ink-2">Made by {maker}</p>}
          {changed.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2" aria-label="What it changes">
              {changed.map((k) => (
                <li
                  key={k.key}
                  className="rounded-full bg-paper-2 px-3 py-1 text-sm font-bold text-ink"
                >
                  {k.label} {formatKnob(k, active.values[k.key] ?? k.default)}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-sm text-ink-2">Play uses this remix.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {saved ? (
              <>
                <Link
                  to={remixBoardPath(gameId, saved.id)}
                  className="btn btn-outline min-h-11 px-3 text-center"
                >
                  Remix board
                </Link>
                <button
                  type="button"
                  className="btn btn-outline min-h-11 px-3"
                  onClick={() => void share()}
                >
                  {shareFeedback ?? "Share"}
                </button>
              </>
            ) : canSave ? (
              <button
                type="button"
                className="btn btn-secondary col-span-2 min-h-11"
                onClick={() => setPanel("save")}
              >
                Save remix
              </button>
            ) : (
              <Link to="/login" className="btn btn-outline col-span-2 min-h-11 text-center">
                Sign up to save it
              </Link>
            )}
            <button
              type="button"
              className="btn btn-outline min-h-11 px-3"
              onClick={() => setPanel("sliders")}
            >
              Change
            </button>
            <button type="button" className="btn btn-outline min-h-11 px-3" onClick={remix.clear}>
              Normal game
            </button>
          </div>
          <span className="sr-only" role="status">
            {shareFeedback ?? ""}
          </span>
        </section>
      ) : (
        <button
          type="button"
          className="btn btn-outline mt-3 w-full min-h-11"
          onClick={() => setPanel("sliders")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M4 7h10M18 7h2M4 17h4M12 17h8"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="16" cy="7" r="2.5" stroke="currentColor" strokeWidth="2.5" />
            <circle cx="10" cy="17" r="2.5" stroke="currentColor" strokeWidth="2.5" />
          </svg>
          Remix this game
        </button>
      )}

      {panel && (
        <RemixPanel
          gameId={gameId}
          gameTitle={gameTitle}
          knobs={knobs}
          initial={active?.values ?? defaultValues(knobs)}
          canSave={canSave}
          startOnSave={panel === "save"}
          onPlay={playValues}
          onSaved={adopt}
          onPickSaved={adopt}
          onClose={() => setPanel(null)}
        />
      )}
    </>
  );
}
