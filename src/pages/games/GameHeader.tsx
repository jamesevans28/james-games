import { Link } from "react-router-dom";

interface Props {
  title: string;
  brand?: string;
  leaderboardTo?: string; // route to leaderboard page
}

export default function GameHeader({ title, brand = "games4james.com", leaderboardTo }: Props) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14">
      <div className="h-full flex items-center justify-between px-3 bg-white text-black border-b border-gray-200">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 transition-colors px-3 py-1.5"
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
        </Link>

        <div className="text-center pointer-events-none select-none">
          <div className="text-lg font-extrabold">{title}</div>
          <div className="text-[10px] text-gray-500 leading-none">{brand}</div>
        </div>

        <div className="w-[84px] flex justify-end">
          {leaderboardTo && (
            <Link
              to={leaderboardTo}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50 transition-colors px-3 py-1.5"
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
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
