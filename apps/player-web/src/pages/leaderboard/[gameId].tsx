import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useCatalog } from "../../context/GameCatalogProvider";
import { getUserName } from "../../utils/user";
import Seo from "../../components/Seo";
import { ProfileAvatar } from "../../components/profile";
import { useAuth } from "../../context/FirebaseAuthProvider";
import { usePresenceReporter } from "../../hooks/usePresenceReporter";
import { useLeaderboard, type LeaderboardScope } from "../../hooks/useLeaderboard";
import { isSigninRequired } from "../../lib/apiError";
import { adapters } from "../../platform/adapters";
import { readStored, STORAGE_KEYS } from "../../utils/storageKeys";
import { SITE_URL, shareImageFor } from "../../utils/seoKeywords";
import { brand } from "../../config/brand";
import { useRemixInfo, useRemixLeaderboard } from "../games/remix/useRemixLeaderboard";

/** "remix" is a saved remix's own board (T11.2), shown when the link has `?remix=<id>`. */
type Tab = LeaderboardScope | "remix";

const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: "overall", label: "Everyone" },
  { id: "following", label: "Friends" },
];

/** Medal rows get a crayon tint; the ring colour uses the same token. */
const MEDALS = [
  { row: "bg-sun/15", ring: "var(--color-sun)", label: "1st" },
  { row: "bg-sky/15", ring: "var(--color-sky)", label: "2nd" },
  { row: "bg-tomato/10", ring: "var(--color-tomato)", label: "3rd" },
] as const;

function storedTab(): LeaderboardScope {
  return readStored("leaderboardTab") === "following" ? "following" : "overall";
}

export default function LeaderboardPage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { getGame } = useCatalog();
  const meta = useMemo(() => (gameId ? getGame(gameId) : undefined), [gameId, getGame]);
  const myName = useMemo(() => getUserName() || "", []);
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const remixId = searchParams.get("remix");
  const [activeTab, setActiveTab] = useState<Tab>(() => (remixId ? "remix" : storedTab()));
  const needsSignIn = activeTab === "following" && !user;
  const gameBoard = useLeaderboard(gameId, {
    limit: 25,
    scope: activeTab === "following" ? "following" : "overall",
    viewerId: user?.userId,
    enabled: !needsSignIn && activeTab !== "remix",
  });
  const remixBoard = useRemixLeaderboard(gameId, remixId, { enabled: activeTab === "remix" });
  const remixInfo = useRemixInfo(remixId);
  const board = activeTab === "remix" ? remixBoard : gameBoard;
  const tabs = remixId ? [{ id: "remix" as const, label: "This remix" }, ...TABS] : TABS;
  usePresenceReporter({ status: "browsing_leaderboard", gameId: meta?.id, enabled: !!meta });

  function handleTabChange(next: Tab) {
    setActiveTab(next);
    if (next !== "remix") adapters.storage.set(STORAGE_KEYS.leaderboardTab, next);
  }

  const rows = board.data ?? [];
  let message: string | null = null;
  if (needsSignIn || isSigninRequired(board.error)) {
    message = "Sign in to see scores from people you follow.";
  } else if (activeTab === "remix" && remixInfo.isSuccess && !remixInfo.data) {
    message = "We couldn't find that remix.";
  } else if (board.fetchStatus === "paused" || (board.isError && rows.length === 0)) {
    message = "Scores will show up here when you're online.";
  } else if (board.isSuccess && rows.length === 0) {
    message = "No scores yet. Yours could be the first!";
  }

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <Seo
        title={meta ? `${meta.title} leaderboard | ${brand.name}` : `Leaderboard | ${brand.name}`}
        description={
          meta ? `Top scores for ${meta.title} on ${brand.name}.` : `Top scores on ${brand.name}.`
        }
        url={`${SITE_URL}/leaderboard/${meta?.id ?? ""}`}
        canonical={`${SITE_URL}/leaderboard/${meta?.id ?? ""}`}
        image={shareImageFor(meta?.thumbnail)}
        noindex={true}
      />
      <header className="fixed top-0 left-0 right-0 z-50 h-14">
        <div className="h-full flex items-center justify-between px-2 bg-paper/95 backdrop-blur text-ink border-b border-line">
          <button
            type="button"
            onClick={() => void navigate(-1)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-2 hover:bg-paper-2"
            aria-label="Close leaderboard"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <h1 className="font-display text-lg font-extrabold text-ink truncate">
            {meta?.title ?? "Game"}
          </h1>
          <div className="w-11" />
        </div>
      </header>

      <div className="pt-16 pb-6 px-4 max-w-xl w-full mx-auto">
        <div className="flex gap-2 mb-4" role="tablist" aria-label="Whose scores">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`flex-1 min-h-11 rounded-full border-2 px-3 text-base font-bold transition-colors ${
                activeTab === tab.id
                  ? "bg-brand text-on-brand border-edge shadow-sticker"
                  : "bg-card text-ink-2 border-line hover:bg-paper-2"
              }`}
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "remix" && remixInfo.data && (
          <p className="mb-4 text-base text-ink-2">
            Best scores on{" "}
            <span className="font-bold text-ink">&ldquo;{remixInfo.data.name}&rdquo;</span>
            {remixInfo.data.owner && <>, a remix by {remixInfo.data.owner.screenName}</>}.
          </p>
        )}
        {board.isPending && board.fetchStatus === "fetching" && (
          <p className="text-base text-ink-2">Loading…</p>
        )}
        {message && <p className="text-base text-ink-2">{message}</p>}

        {rows.length > 0 && (
          <ol className="card overflow-hidden p-0">
            {rows.map((r, i) => {
              const isMe = Boolean(myName) && r.screenName === myName;
              const medal = MEDALS[i];
              const content = (
                <>
                  <span className="w-7 text-base font-extrabold text-ink-3">{i + 1}</span>
                  <ProfileAvatar
                    user={{ avatar: r.avatar }}
                    size={medal ? 44 : 32}
                    borderWidth={medal ? 3 : 2}
                    strokeWidth={medal ? 2 : 1}
                    borderColor={
                      medal ? medal.ring : isMe ? "var(--color-brand)" : "var(--color-line)"
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-base font-bold ${isMe ? "text-brand" : "text-ink"}`}
                    >
                      {r.screenName}
                      {medal && <span className="sr-only"> ({medal.label})</span>}
                    </span>
                    {typeof r.level === "number" && (
                      <span className="block text-sm text-ink-2">Level {r.level}</span>
                    )}
                  </span>
                  <span
                    className={`font-mono text-base font-extrabold ${isMe ? "text-brand" : "text-ink"}`}
                  >
                    {r.score.toLocaleString()}
                  </span>
                </>
              );
              const rowClass = `flex min-h-14 items-center gap-3 px-4 py-2 border-b border-line last:border-b-0 ${
                isMe ? "bg-brand/10" : (medal?.row ?? "")
              }`;
              return (
                <li key={`${i}-${r.screenName}`}>
                  {r.userId ? (
                    <button
                      type="button"
                      className={`${rowClass} w-full text-left hover:bg-paper-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand`}
                      onClick={() => void navigate(`/profile/${r.userId}`)}
                    >
                      {content}
                    </button>
                  ) : (
                    <div className={rowClass}>{content}</div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
