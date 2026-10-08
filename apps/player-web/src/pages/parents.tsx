import { Link } from "react-router";
import InfoPage, { ContactEmail, InfoList, InfoSection } from "../components/InfoPage";
import { brand, makersLine } from "../config/brand";

/** For grown-ups (T7.8): accounts, friends, privacy settings, deleting, reporting, PINs. */
export default function ParentsPage() {
  return (
    <InfoPage
      path="/parents"
      title="For grown-ups"
      description={`How accounts, friends and safety work on ${brand.name}, for parents and carers.`}
      intro={
        <p>
          {brand.name} is made by {makersLine()} for kids like ours. Here&rsquo;s how it works, so
          you know what your child is using.
        </p>
      }
    >
      <InfoSection id="accounts" title="Accounts">
        <InfoList>
          <li>
            <strong>Guest</strong> is the default. No sign-up: your child gets a random screen name
            and can play straight away. Progress stays with this device.
          </li>
          <li>
            <strong>Username and PIN.</strong> A username and a 6-digit PIN, no email needed. Use it
            to play on more than one device. Too many wrong PINs and sign-in pauses for a while.
          </li>
          <li>
            <strong>Google or Apple.</strong> You can sign in with a grown-up&rsquo;s account. We
            only use the email to sign in; other players never see it.
          </li>
        </InfoList>
        <p>
          Screen names are checked against a word list, and we ask kids not to use their real name.
        </p>
      </InfoSection>

      <InfoSection id="friends" title="Friends">
        <InfoList>
          <li>There&rsquo;s no searching for players by name.</li>
          <li>
            The only way to add a friend is to swap a 6-character friend code, for example with a
            cousin or a classmate you know.
          </li>
          <li>Adding someone sends a request. Nothing changes until they say yes.</li>
          <li>Block hides two players from each other and ends the friendship.</li>
          <li>There&rsquo;s no chat and no messages.</li>
        </InfoList>
      </InfoSection>

      <InfoSection id="online" title="Showing when you're online">
        <p>
          <strong>Show when I&rsquo;m online</strong> is off unless your child turns it on in
          Settings. Even then, only friends see it, and they just see &ldquo;online&rdquo;. Turn it
          off again in Settings at any time.
        </p>
      </InfoSection>

      <InfoSection id="report" title="Reporting a name">
        <p>
          See a screen name that isn&rsquo;t OK? Email <ContactEmail subject="Report a name" /> with
          the name and the game you saw it in. We&rsquo;ll change it.
        </p>
      </InfoSection>

      <InfoSection id="forgot-pin" title="Forgot the PIN?">
        <p>
          A grown-up can email <ContactEmail subject="PIN reset" /> with the username. James will
          reset the PIN and reply with a new one. We may ask a question or two to check the account
          is yours. Afterwards, pick a fresh PIN in Settings.
        </p>
      </InfoSection>

      <InfoSection id="delete" title="Deleting an account">
        <p>
          In <strong>Settings → Delete my account</strong>. It&rsquo;s immediate and can&rsquo;t be
          undone. Or email <ContactEmail subject="Delete my account" /> and we&rsquo;ll do it for
          you.
        </p>
      </InfoSection>

      <InfoSection title="Money">
        <p>
          The games are free and there are no ads. If you&rsquo;d like to support us, payments go
          through Ko-fi and are made by a grown-up; we never see card details.
        </p>
        <p>
          What we keep is all on the{" "}
          <Link to="/privacy" className="font-bold text-brand underline">
            privacy page
          </Link>
          .
        </p>
      </InfoSection>
    </InfoPage>
  );
}
