import RatingStars from "../../../components/RatingStars";
import { type RatingSummary } from "../../../lib/api";

/**
 * Stars for this game. The landing page only shows this after your 3rd play (T7.2),
 * and only to signed-in players, who are the ones who can rate.
 */
export default function LandingRating({
  summary,
  userRating,
  submitting,
  error,
  onRate,
}: {
  summary: RatingSummary | null;
  userRating: number | null;
  submitting: boolean;
  error: string | null;
  onRate: (value: number) => void;
}) {
  const count = summary?.ratingCount ?? 0;
  return (
    <section className="card mt-6 p-5" aria-labelledby="rate-it">
      <h2 id="rate-it" className="font-display text-xl font-extrabold text-ink">
        {userRating ? "Your stars" : "Do you like it?"}
      </h2>
      <div className="mt-2 -ml-2">
        <RatingStars value={userRating ?? 0} onSelect={onRate} readOnly={submitting} />
      </div>
      {count > 0 && summary && (
        <p className="mt-1 text-base text-ink-2">
          Players give it {summary.avgRating.toFixed(1)} stars ({count})
        </p>
      )}
      {error && <p className="mt-2 text-base font-semibold text-tomato">{error}</p>}
    </section>
  );
}
