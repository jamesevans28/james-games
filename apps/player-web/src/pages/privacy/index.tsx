import { Link } from "react-router";
import InfoPage, { ContactEmail, InfoList, InfoSection } from "../../components/InfoPage";
import { brand, makersLine } from "../../config/brand";

/**
 * Privacy (T7.8), in plain words. Keep it true: if what the app stores changes,
 * change this page in the same commit.
 */
export default function PrivacyPage() {
  return (
    <InfoPage
      path="/privacy"
      title="Privacy"
      description={`What ${brand.name} keeps about players, and what it never does, in plain words.`}
      intro={
        <p>
          {brand.name} is a family project by {makersLine()}. Here is exactly what we keep, and why.
        </p>
      }
    >
      <InfoSection title="What we keep">
        <InfoList>
          <li>
            A player id from our sign-in service (Google Firebase). It&rsquo;s a random code, not
            your name.
          </li>
          <li>Your screen name and avatar. Other players see these on leaderboards.</li>
          <li>Your scores and the games you&rsquo;ve played.</li>
          <li>
            If you make an account: your username, and your PIN scrambled so nobody can read it, not
            even us.
          </li>
          <li>
            An email address, only if you sign in with Google or Apple or add one yourself. We use
            it for signing in. Other players never see it.
          </li>
          <li>Your friend code, your friends list and anyone you&rsquo;ve blocked.</li>
          <li>The stickers you&rsquo;ve collected.</li>
          <li>Your settings, like sound and whether friends can see when you&rsquo;re online.</li>
          <li>
            For one day, a note of sign-in tries, so nobody can keep guessing a PIN. Your internet
            address is scrambled before we store it.
          </li>
        </InfoList>
        <p className="text-ink-2">
          It&rsquo;s stored with Supabase (our database) and Google Firebase (sign-in).
        </p>
      </InfoSection>

      <InfoSection title="What we never do">
        <InfoList>
          <li>No ads.</li>
          <li>We never sell or share your information.</li>
          <li>No tracking you around other websites.</li>
        </InfoList>
      </InfoSection>

      <InfoSection title="Counting visits">
        <p>
          We count page views and game plays without cookies (Cloudflare Web Analytics). It tells us
          which games people enjoy, not who you are.
        </p>
      </InfoSection>

      <InfoSection title="Supporting us">
        <p>
          If a grown-up chooses to support us, the payment goes through Ko-fi. We never see card
          details.
        </p>
      </InfoSection>

      <InfoSection id="delete" title="Deleting your account">
        <p>
          Go to <strong>Settings → Delete my account</strong>. It happens straight away and
          can&rsquo;t be undone. Your name leaves every leaderboard, and your friends, stickers and
          settings are gone. We keep the bare game results with no name attached, just to count
          plays.
        </p>
        <p>
          Playing as a guest, or can&rsquo;t get in? Email{" "}
          <ContactEmail subject="Delete my account" /> with your screen name and we&rsquo;ll delete
          it for you.
        </p>
      </InfoSection>

      <InfoSection title="Questions">
        <p>
          Ask us anything at <ContactEmail subject="Privacy question" />. Grown-ups, there&rsquo;s
          more about how accounts and friends work on the{" "}
          <Link to="/parents" className="font-bold text-brand underline">
            page for grown-ups
          </Link>
          .
        </p>
      </InfoSection>
    </InfoPage>
  );
}
