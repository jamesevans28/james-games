import InfoPage, { ContactEmail, InfoList, InfoSection } from "../components/InfoPage";
import { Link } from "react-router";
import { brand, makersLine } from "../config/brand";
import { games } from "../games";
import { gamesByMaker } from "../utils/gamesByMaker";

const byMaker = gamesByMaker(
  games.filter((g) => g.status === "active"),
  brand.makers,
);

/** About us (T7.8): who makes the games and what the site is. */
export default function AboutPage() {
  return (
    <InfoPage
      path="/about"
      title="About us"
      description={`${brand.name} is a little family games studio: ${makersLine()}. Free games, no ads.`}
      intro={
        <p>
          Hello! We&rsquo;re {makersLine()}, and {brand.name} is where we put the little games we
          make together.
        </p>
      }
    >
      <InfoSection title="What it is">
        <p>
          Small games for phones and tablets. They run in your web browser, so there&rsquo;s nothing
          to download: tap a game and play.
        </p>
        <p>
          We think up the ideas together, try them out on each other, and keep the ones that make us
          laugh.
        </p>
      </InfoSection>

      <InfoSection id="games" title="Our games, by maker">
        <p>Everyone helps with every game. These are the ones each of us dreamed up.</p>
        {byMaker.map((group) => (
          <div key={group.maker ?? "everyone"}>
            <h3 className="kid-note mt-3 text-brand">
              {group.maker ? `${group.maker}’s games` : "Made by all of us"}
            </h3>
            <ul className="mt-1 flex flex-wrap gap-2">
              {group.games.map((g) => (
                <li key={g.id}>
                  <Link
                    to={`/games/${g.id}`}
                    className="inline-flex min-h-11 items-center rounded-full border border-line bg-paper-2 px-4 font-bold text-ink"
                  >
                    {g.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </InfoSection>

      <InfoSection title="Free, with no ads">
        <InfoList>
          <li>Every game is free to play.</li>
          <li>There are no ads, and there never will be.</li>
          <li>We don&rsquo;t sell anything about you to anyone.</li>
        </InfoList>
      </InfoSection>

      <InfoSection title="Help keep it going">
        <p>
          It costs a little to run. If a grown-up would like to chip in, see{" "}
          <Link to="/support" className="font-bold text-brand underline underline-offset-4">
            Support us
          </Link>
          .
        </p>
      </InfoSection>

      <InfoSection title="Say hello">
        <p>
          Got an idea for a game, or found a bug? We&rsquo;d love to hear from you at{" "}
          <ContactEmail subject={`Hello ${brand.name}`} />.
        </p>
      </InfoSection>
    </InfoPage>
  );
}
