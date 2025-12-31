import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { games } from "../../games";
import { getTopScores, ScoreEntry } from "../../lib/api";
import { getUserName } from "../../utils/user";
import Seo from "../../components/Seo";
import { ProfileAvatar } from "../../components/profile";
import { useAuth } from "../../context/FirebaseAuthProvider";
import { usePresenceReporter } from "../../hooks/usePresenceReporter";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";

export default function LeaderboardPage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const meta = useMemo(() => games.find((g) => g.id === gameId), [gameId]);
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
    <div className="min-h-screen bg-white text-black flex flex-col">
      <Seo
        title={meta ? `${meta.title} Leaderboard — Games4James` : "Leaderboard — Games4James"}
        description={`Top scores for ${meta?.title ?? "this game"} on Games4James.`}
        url={`https://games4james.com/leaderboard/${meta?.id ?? ""}`}
        canonical={`https://games4james.com/leaderboard/${meta?.id ?? ""}`}
        image={"https://games4james.com/assets/logo.png"}
      />
      <header className="fixed top-0 left-0 right-0 z-50 h-14">
        <div className="h-full flex items-center justify-between px-3 bg-white text-black border-b border-gray-200">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center rounded-md px-3 py-1.5"
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
            <div className="text-lg font-extrabold">{meta?.title ?? "Game"}</div>
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
              className={`flex-1 rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${
                activeTab === tab.id
                  ? "bg-black text-white border-black"
                  : "bg-white text-black border-gray-300"
              }`}
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {loading && <div className="text-gray-700">Loading…</div>}
        {error && <div className="text-red-600">{error}</div>}
        {tabError && <div className="text-sm text-orange-600 mb-3">{tabError}</div>}
        {!loading && !error && (
          <ol className="rounded-lg overflow-hidden bg-white border border-gray-200">
            {rows.map((r, i) => {
              const isMe = myName && r.screenName === myName;
              const medal = i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : null;
              const medalColors: Record<string, { ring: string; badge: string; text: string }> = {
                gold: { ring: "#fbbf24", badge: "#f59e0b", text: "#b45309" },
                silver: { ring: "#e5e7eb", badge: "#9ca3af", text: "#4b5563" },
                bronze: { ring: "#d97706", badge: "#92400e", text: "#78350f" },
              };
              const avatarSize = medal ? 44 : 28;
              const hasProfile = Boolean(r.userId);
              const handleRowClick = () => {
                if (r.userId) navigate(`/profile/${r.userId}`);
              };
              const baseRowClass =
                "flex items-center justify-between px-4 py-3 border-b border-gray-200 last:border-b-0 " +
                (isMe
                  ? "bg-amber-50"
                  : medal === "gold"
                  ? "bg-yellow-50"
                  : medal === "silver"
                  ? "bg-gray-50"
                  : medal === "bronze"
                  ? "bg-orange-50"
                  : "");
              return (
                <li
                  key={`${r.screenName}-${i}`}
                  className={
                    baseRowClass +
                    (hasProfile
                      ? " cursor-pointer focus:outline-none focus:ring-2 focus:ring-black"
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
                    <span className="w-7 text-gray-500 font-mono">{i + 1}.</span>
                    <div className="relative flex items-center">
                      <ProfileAvatar
                        user={{ avatar: r.avatar }}
                        size={avatarSize}
                        borderWidth={medal ? 3 : 2}
                        strokeWidth={medal ? 2 : 1}
                        borderColor={medal ? medalColors[medal].ring : isMe ? "#f59e0b" : "#3b82f6"}
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
                            border: "2px solid #000",
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
                          "font-semibold truncate max-w-[210px] md:max-w-[260px] " +
                          (isMe
                            ? "text-amber-700"
                            : medal
                            ? `text-[${medalColors[medal].text}]`
                            : "")
                        }
                        title={r.screenName}
                      >
                        {r.screenName}
                      </span>
                      {typeof r.level === "number" && (
                        <div className="text-[11px] text-gray-500">Level {r.level}</div>
                      )}
                    </div>
                  </div>
                  <div className={"text-right font-mono " + (isMe ? "text-amber-700" : "")}>
                    {r.score}
                  </div>
                </li>
              );
            })}
            {rows.length === 0 && <div className="px-4 py-6 text-gray-500">No scores yet.</div>}
          </ol>
        )}
      </div>
    </div>
  );
}
