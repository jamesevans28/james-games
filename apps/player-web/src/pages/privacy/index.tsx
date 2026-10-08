import { Link } from "react-router";
import Seo from "../../components/Seo";
import { brand, makersLine, siteUrl } from "../../config/brand";

/**
 * Placeholder privacy page (T3.5) so the Google sign-in consent screen has a
 * real URL. T7.8 replaces it with the full parent page. Keep it true: if what
 * the app stores changes, change this page in the same commit.
 */
export default function PrivacyPage() {
  return (
    <div className="max-w-xl mx-auto px-4 py-8 text-ink">
      <Seo
        title={`Privacy | ${brand.name}`}
        description={`What ${brand.name} keeps about players, in plain words.`}
        url={siteUrl("/privacy")}
        canonical={siteUrl("/privacy")}
      />
      <h1 className="text-3xl font-extrabold mb-2">Privacy</h1>
      <p className="text-ink-2 mb-6">
        {brand.name} is a family project by {makersLine()}. This is the short version; a fuller
        page for parents is on its way.
      </p>

      <section className="card p-5 mb-4">
        <h2 className="text-lg font-extrabold mb-2">What we keep</h2>
        <ul className="list-disc pl-5 space-y-1.5 text-sm">
          <li>Your screen name and avatar. These show on leaderboards.</li>
          <li>Your username, and your PIN stored scrambled (we can&rsquo;t read it).</li>
          <li>Your scores, ratings, XP, streaks and who you follow.</li>
          <li>
            An email address, only if you add one or sign in with Google or Apple. It is never shown
            to other players.
          </li>
          <li>
            Players who follow you can see when you were last online and which game you&rsquo;re
            playing. (We&rsquo;re changing this to friends-only.)
          </li>
        </ul>
      </section>

      <section className="card p-5 mb-4">
        <h2 className="text-lg font-extrabold mb-2">What we don&rsquo;t do</h2>
        <ul className="list-disc pl-5 space-y-1.5 text-sm">
          <li>No ads.</li>
          <li>We don&rsquo;t sell or share your information.</li>
        </ul>
      </section>

      <section className="card p-5 mb-6">
        <h2 className="text-lg font-extrabold mb-2">Visit counts</h2>
        <p className="text-sm">
          We use Google Analytics to count visits and see which games get played, so we know what
          to make next.
        </p>
      </section>

      <Link to="/" className="btn btn-outline">
        Back to the games
      </Link>
    </div>
  );
}
