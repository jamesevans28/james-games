import InfoPage from "../components/InfoPage";
import { brand } from "../config/brand";

/**
 * Any URL the app doesn't know. The host still answers 200 (it's a single-page app),
 * so `noindex` is what keeps these out of Google instead of "soft 404" errors.
 */
export default function NotFoundPage() {
  return (
    <InfoPage
      path="/"
      title="Page not found"
      description={`That page isn't on ${brand.name}.`}
      intro={
        <p>We couldn&rsquo;t find that page. It might have moved, or the game is having a rest.</p>
      }
      noindex
    />
  );
}
