import { type GameMeta } from "../../../games";
import { brand, makersLine } from "../../../config/brand";

/** Cover, title, who made it, and the designer's note. */
export default function LandingHero({ meta }: { meta: GameMeta }) {
  return (
    <header>
      <div className="card mx-auto aspect-square w-full max-w-sm overflow-hidden bg-paper-2 p-0">
        <img
          src={meta.thumbnail || brand.logoSquare}
          alt=""
          width={512}
          height={512}
          decoding="async"
          fetchPriority="high"
          className="h-full w-full object-contain"
        />
      </div>
      <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight text-ink">
        {meta.title}
      </h1>
      <p className="text-base font-bold text-ink-2">
        Made by {makersLine(meta.makers ?? brand.makers)}
      </p>
      {meta.note && (
        <figure className="card mt-4 rotate-[-0.6deg] p-4">
          <figcaption className="text-sm font-extrabold uppercase tracking-wide text-brand">
            Designer&rsquo;s note{meta.noteBy ? ` from ${meta.noteBy}` : ""}
          </figcaption>
          <blockquote className="kid-note mt-1 text-ink">{meta.note}</blockquote>
        </figure>
      )}
    </header>
  );
}
