import type { ReactNode } from "react";
import { type GameMeta } from "../../games";
import { useAuth } from "../../context/FirebaseAuthProvider";
import { useGameRatings } from "../../hooks/useGameRatings";
import { useRatingPrompt } from "../../hooks/useRatingPrompt";
import { PROMPT_AFTER_PLAYS, readRatingPromptState } from "../../lib/ratingPrompt";
import RatingPromptModal from "../../components/RatingPromptModal";
import LandingHero from "./landing/LandingHero";
import HowToPlay from "./landing/HowToPlay";
import LandingScores from "./landing/LandingScores";
import LandingRating from "./landing/LandingRating";
import PassAndPlayToggle from "./passandplay/PassAndPlayToggle";

type Props = {
  meta: GameMeta;
  onPlay: () => void;
  /** False while playing and once a run has finished on this visit (no prompt in a replay loop). */
  canPromptRating?: boolean;
  /** The remix button or card under Play (T11.2); gets this page's own Play. */
  renderRemix?: (onPlay: () => void) => ReactNode;
};

/**
 * A game's landing page (T7.2): cover, title, makers and note, a big Play, how to play,
 * your best and the top 5, and stars after your 3rd play. Works with the API offline:
 * everything server-side has an empty state.
 */
export default function GameLanding({ meta, onPlay, canPromptRating = false, renderRemix }: Props) {
  const { user } = useAuth();
  const ratings = useGameRatings(meta.id);
  // Read on every render: PlayGame re-renders this page after each run.
  const plays = readRatingPromptState(meta.id).plays;
  const prompt = useRatingPrompt({
    gameId: meta.id,
    enabled: canPromptRating,
    canRate: Boolean(user),
    ready: ratings.isReady,
    alreadyRated: ratings.userRating !== null,
  });

  const rate = (value: number) => {
    ratings.rate(value).catch(() => {
      // shown via ratings.submitError
    });
  };

  return (
    <div className="mx-auto max-w-md px-4 pt-20 pb-16">
      <LandingHero meta={meta} />

      <button type="button" className="btn btn-primary mt-5 w-full py-4 text-2xl" onClick={onPlay}>
        Play
      </button>
      {renderRemix?.(onPlay)}
      <PassAndPlayToggle />

      <HowToPlay meta={meta} />
      <LandingScores gameId={meta.id} />

      {user && (plays >= PROMPT_AFTER_PLAYS || ratings.userRating !== null) && (
        <LandingRating
          summary={ratings.summary}
          userRating={ratings.userRating}
          submitting={ratings.isSubmitting}
          error={prompt.open ? null : ratings.submitError}
          onRate={rate}
        />
      )}

      <RatingPromptModal
        open={prompt.open}
        gameTitle={meta.title}
        initialRating={ratings.userRating}
        submitting={ratings.isSubmitting}
        error={ratings.submitError}
        onSubmit={rate}
        onSkip={prompt.dismiss}
      />
    </div>
  );
}
