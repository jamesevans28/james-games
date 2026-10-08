import { useMemo, useState, type ReactNode } from "react";
import Seo from "../../components/Seo";
import GameTile from "../../components/feed/GameTile";
import { useAuth } from "../../context/FirebaseAuthProvider";
import { useCatalog } from "../../context/GameCatalogProvider";
import { filterByBetaAccess } from "../../hooks/useGameCatalog";
import { usePresenceReporter } from "../../hooks/usePresenceReporter";
import { buildHomeSections, isNewGame } from "../../lib/homeSections";
import { getLastPlayedGames } from "../../utils/playHistory";
import {
  buildWebsiteJsonLd,
  buildGameCollectionJsonLd,
  buildOrganizationJsonLd,
  SITE_URL,
} from "../../utils/seoKeywords";
import { brand } from "../../config/brand";

/** Tiles in the first row load their covers at once; everything else is lazy. */
const EAGER_TILES = 2;

/** Home (T7.1): the games as a grid of big square covers. New, Play again, All games. */
export default function HomeGrid() {
  const { user } = useAuth();
  const { games } = useCatalog();
  const visible = useMemo(
    () => filterByBetaAccess(games, Boolean(user?.betaTester)),
    [games, user?.betaTester],
  );
  // Read once per visit: the grid shouldn't reshuffle while you look at it.
  const [snapshot] = useState(() => ({ recent: getLastPlayedGames(), now: Date.now() }));
  const sections = useMemo(
    () => buildHomeSections(visible, snapshot.recent, snapshot.now),
    [visible, snapshot],
  );

  usePresenceReporter({ status: "home", enabled: true });

  // `before`: tiles in the sections above, so only the very first row loads eagerly.
  const grid = (list: typeof visible, before: number, newBadges: boolean) => (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {list.map((game, i) => (
        <li key={game.id}>
          <GameTile
            game={game}
            eager={before + i < EAGER_TILES}
            badge={newBadges && isNewGame(game, snapshot.now) ? "New" : undefined}
          />
        </li>
      ))}
    </ul>
  );
  const { fresh, playAgain, all } = sections;

  return (
    <div className="w-full max-w-[720px] mx-auto px-4 pb-16">
      <Seo
        title={`${brand.name} | ${brand.tagline}`}
        description={brand.description}
        url={`${SITE_URL}/`}
        canonical={`${SITE_URL}/`}
        image={`${SITE_URL}${brand.ogImage}`}
        jsonLd={[
          buildWebsiteJsonLd(),
          buildOrganizationJsonLd(),
          buildGameCollectionJsonLd(visible),
        ]}
      />
      <h1 className="sr-only">{brand.name}</h1>

      {fresh.length > 0 && <Section title="New">{grid(fresh, 0, false)}</Section>}
      {playAgain.length > 0 && (
        <Section title="Play again">{grid(playAgain, fresh.length, false)}</Section>
      )}
      <Section title="All games">{grid(all, fresh.length + playAgain.length, true)}</Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="pt-5">
      <h2 className="font-display text-xl font-extrabold text-ink mb-3">{title}</h2>
      {children}
    </section>
  );
}
