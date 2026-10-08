import InfoPage, { ContactEmail, InfoList, InfoSection } from "../components/InfoPage";
import { Link } from "react-router";
import { brand, makersLine } from "../config/brand";

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
