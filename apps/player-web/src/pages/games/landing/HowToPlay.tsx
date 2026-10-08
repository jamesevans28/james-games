import { type GameMeta } from "../../../games";

/** Always visible: what the game is, what you're trying to do, and how to do it. */
export default function HowToPlay({ meta }: { meta: GameMeta }) {
  return (
    <section className="card mt-6 p-5" aria-labelledby="how-to-play">
      <h2 id="how-to-play" className="font-display text-xl font-extrabold text-ink">
        How to play
      </h2>
      {meta.description && <p className="mt-1 text-base text-ink-2">{meta.description}</p>}
      <dl className="mt-3 space-y-2 text-base">
        <div>
          <dt className="font-extrabold text-ink">Goal</dt>
          <dd className="text-ink-2">{meta.objective || "Score as high as you can."}</dd>
        </div>
        <div>
          <dt className="font-extrabold text-ink">Controls</dt>
          <dd className="text-ink-2">{meta.controls || "Tap to play."}</dd>
        </div>
      </dl>
    </section>
  );
}
