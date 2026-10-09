import { useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { fetchSharedPlay } from "../../lib/api";

/**
 * /s/:playId, a shared score (T11.5). On the web the site's /s/* CloudFront
 * behaviour normally sends these links to the API's preview page, which forwards
 * people to the game itself; this route covers the rest (before that behaviour
 * exists, the installed app's service worker, the native apps): look the play up
 * and open its game, or the home page if there's no such score.
 */
export default function SharedPlay() {
  const { playId = "" } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const open = (play: { gameId: string } | null) => {
      if (cancelled) return;
      void navigate(play ? `/games/${encodeURIComponent(play.gameId)}` : "/", { replace: true });
    };
    fetchSharedPlay(playId).then(open, () => open(null));
    return () => {
      cancelled = true;
    };
  }, [playId, navigate]);

  return (
    <p role="status" className="p-8 text-center font-display text-lg font-extrabold text-ink-2">
      Opening the game…
    </p>
  );
}
