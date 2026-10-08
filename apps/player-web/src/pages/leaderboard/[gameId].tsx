import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useCatalog } from "../../context/GameCatalogProvider";
import { getTopScores, type ScoreEntry } from "../../lib/api";
import { getUserName } from "../../utils/user";
import Seo from "../../components/Seo";
import { ProfileAvatar } from "../../components/profile";
import { useAuth } from "../../context/FirebaseAuthProvider";
import { usePresenceReporter } from "../../hooks/usePresenceReporter";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { SITE_URL } from "../../utils/seoKeywords";
import { brand } from "../../config/brand";

export default function LeaderboardPage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { getGame } = useCatalog();
  const meta = useMemo(() => (gameId ? getGame(gameId) : undefined), [gameId, getGame]);
  const [rows, setRows] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabError, setTabError] = useState<string | null>(null);
  const myName = useMemo(() => getUserName() || "", []);
  const { user } = useAuth();
  const { isOnline } = useOnlineStatus();
  usePresenceReporter({
    status: "browsing_leaderboard",
    gameId: meta?.id,
    gameTitle: meta?.title,
    enabled: !!meta,
  });

  const getStoredTab = () => {
    if (typeof window === "undefined") return "overall" as const;
    const stored = window.localStorage.getItem("leaderboard:lastTab");
    return stored === "following" ? "following" : "overall";
  };

  const [activeTab, setActiveTab] = useState<"overall" | "following">(() => getStoredTab());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!gameId) return;
      setLoading(true);
      setError(null);
      setTabError(null);

      // Check if offline before attempting to fetch
      if (!navigator.onLine) {
        setRows([]);
        setLoading(false);
        setError("You're offline. Connect to the internet to view the leaderboard.");
        return;
      }

      const scope = activeTab === "following" ? "following" : undefined;
      if (scope === "following" && !user) {
        setRows([]);
        setLoading(false);
        setTabError("Sign in to see scores from people you follow.");
        return;
      }
      try {
        const res = await getTopScores(gameId, 25, { scope });
        if (!cancelled) setRows(res);
      } catch (e: any) {
        console.error(e);
        if (scope === "following" && e?.message === "signin_required") {
          if (!cancelled) {
            setRows([]);
            setTabError("Sign in to see scores from people you follow.");
          }
        } else if (!navigator.onLine) {
          if (!cancelled)
            setError("You're offline. Connect to the internet to view the leaderboard.");
        } else {
          if (!cancelled) setError("Failed to load leaderboard");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [gameId, activeTab, user?.userId, isOnline]);

  function handleTabChange(next: "overall" | "following") {
    setActiveTab(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("leaderboard:lastTab", next);
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <Seo
        title={
          meta
            ? `${meta.title} leaderboard | ${brand.name}`
            : `Leaderboard | ${brand.name}`
        }
        description={
          meta
            ? `Top scores for ${meta.title} on ${brand.name}.`
            : `Top scores on ${brand.name}.`
        }
        url={`${SITE_URL}/leaderboard/${meta?.id ?? ""}`}
        canonical={`${SITE_URL}/leaderboard/${meta?.id ?? ""}`}
        image={
          meta?.thumbnail
            ? `${SITE_URL}${meta.thumbnail}`
            : `${SITE_URL}/assets/shared/logo_square.png`
        }
        keywords={
          meta
            ? `${meta.title} leaderboard, ${meta.title} high scores, free game scores, top players`
            : "game leaderboard, high scores"
        }
        noindex={true}
      />
      <header className="fixed top-0 left-0 right-0 z-50 h-14">
        <div className="h-full flex items-center justify-between px-3 bg-paper/95 backdrop-blur text-ink border-b border-line">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center rounded-full px-3 py-1.5 text-ink-2 hover:bg-paper-2 transition-colors"
            aria-label="Close leaderboard"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <div className="text-center pointer-events-none select-none">
            <div className="text-lg font-extrabold text-ink">{meta?.title ?? "Game"}</div>
          </div>
          <div className="w-[84px]" />
        </div>
      </header>
      <div className="pt-16 pb-6 px-4 max-w-xl w-full mx-auto">
        <div className="flex gap-2 mb-4" role="tablist" aria-label="Leaderboard scope">
          {(
            [
              { id: "overall", label: "Overall" },
              { id: "following", label: "Following" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`flex-1 rounded-full border px-3 py-2 text-sm font-bold transition-colors ${
                activeTab === tab.id
                  ? "bg-brand text-on-brand border-brand shadow-sticker"
                  : "bg-card text-ink-2 border-line hover:bg-paper-2"
              }`}
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {loading && <div className="text-ink-2">Loading…</div>}
        {error && <div className="text-grape">{error}</div>}
        {tabError && <div className="text-sm text-tomato mb-3">{tabError}</div>}
        {!loading && !error && (
          <ol className="rounded-2xl overflow-hidden bg-card border border-line">
            {rows.map((r, i) => {
              const isMe = myName && r.screenName === myName;
              const medal = i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : null;
              const medalColors: Record<string, { ring: string; badge: string; text: string }> = {
                gold: { ring: "#fbbf24", badge: "#f59e0b", text: "#b7791f" },
                silver: { ring: "#c0c6cf", badge: "#9ca3af", text: "#6b7280" },
                bronze: { ring: "#d97706", badge: "#92400e", text: "#b45309" },
              };
              const avatarSize = medal ? 44 : 28;
              const hasProfile = Boolean(r.userId);
              const handleRowClick = () => {
                if (r.userId) navigate(`/profile/${r.userId}`);
              };
              const baseRowClass =
                "flex items-center justify-between px-4 py-3 border-b border-line last:border-b-0 " +
                (isMe
                  ? "bg-brand/10"
                  : medal === "gold"
                  ? "bg-sun/10"
                  : medal === "silver"
                  ? "bg-line/20"
                  : medal === "bronze"
                  ? "bg-tomato/10"
                  : "");
              return (
                <li
                  key={`${r.screenName}-${i}`}
                  className={
                    baseRowClass +
                    (hasProfile
                      ? " cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/50 hover:bg-paper-2"
                      : "")
                  }
                  role={hasProfile ? "button" : undefined}
                  tabIndex={hasProfile ? 0 : undefined}
                  onClick={hasProfile ? handleRowClick : undefined}
                  onKeyDown={
                    hasProfile
                      ? (evt) => {
                          if (evt.key === "Enter" || evt.key === " ") {
                            evt.preventDefault();
                            handleRowClick();
                          }
                        }
                      : undefined
                  }
                  aria-label={hasProfile ? `View ${r.screenName}'s profile` : undefined}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 text-ink-2 font-mono">{i + 1}.</span>
                    <div className="relative flex items-center">
                      <ProfileAvatar
                        user={{ avatar: r.avatar }}
                        size={avatarSize}
                        borderWidth={medal ? 3 : 2}
                        strokeWidth={medal ? 2 : 1}
                        borderColor={medal ? medalColors[medal].ring : isMe ? "var(--color-brand)" : "var(--color-sky)"}
                        title={r.screenName}
                      />
                      {medal && (
                        <span
                          className="absolute -bottom-1 -right-1 inline-flex items-center justify-center rounded-full text-[10px] font-bold shadow"
                          style={{
                            backgroundColor: medalColors[medal].badge,
                            color: "#fff",
                            width: 18,
                            height: 18,
                            border: "2px solid var(--color-edge)",
                          }}
                          aria-label={`${medal} medal`}
                        >
                          {medal === "gold" ? "🥇" : medal === "silver" ? "🥈" : "🥉"}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <span
                        className={
                          "font-bold truncate max-w-[210px] md:max-w-[260px] " +
                          (isMe
                            ? "text-brand"
                            : medal
                            ? ""
                            : "text-ink")
                        }
                        style={!isMe && medal ? { color: medalColors[medal].text } : undefined}
                        title={r.screenName}
                      >
                        {r.screenName}
                      </span>
                      {typeof r.level === "number" && (
                        <div className="text-[11px] text-ink-2">Level {r.level}</div>
                      )}
                    </div>
                  </div>
                  <div
                    className={
                      "text-right font-mono font-bold " +
                      (isMe ? "text-brand" : "text-ink")
                    }
                  >
                    {r.score}
                  </div>
                </li>
              );
            })}
            {rows.length === 0 && <div className="px-4 py-6 text-ink-2">No scores yet.</div>}
          </ol>
        )}
      </div>
    </div>
  );
}
