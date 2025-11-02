import { Link } from "react-router-dom";

interface Props {
  title: string;
  brand?: string;
  leaderboardTo?: string; // route to leaderboard page
}

export default function GameHeader({ title, brand = "James Games", leaderboardTo }: Props) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14">
      <div
        className="h-full flex items-center justify-between px-3
        bg-gradient-to-r from-fuchsia-600 via-purple-600 to-sky-600
        text-white shadow-lg border-b border-white/20 backdrop-blur"
      >
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full bg-white/15 hover:bg-white/25
                     transition-colors px-3 py-1.5"
          aria-label="Back to games"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M15 6l-6 6 6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-sm font-medium">Back</span>
        </Link>

        <div className="text-center pointer-events-none select-none">
          <div className="text-lg font-extrabold drop-shadow-sm">{title}</div>
          <div className="text-[10px] opacity-80 leading-none">{brand}</div>
        </div>

        <div className="w-[84px] flex justify-end">
          {leaderboardTo && (
            <Link
              to={leaderboardTo}
              className="inline-flex items-center gap-2 rounded-full bg-white/15 hover:bg-white/25 transition-colors px-3 py-1.5"
              aria-label="Open leaderboard"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 14h4v6H4v-6zm6-10h4v16h-4V4zm6 6h4v10h-4V10z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-sm font-medium">Top 25</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
