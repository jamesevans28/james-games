import { Link } from "react-router";
import { brand as brandConfig } from "../../config/brand";
import MuteButton from "../../components/MuteButton";

interface Props {
  title: string;
  brand?: string;
  leaderboardTo?: string; // route to leaderboard page
  /** Show the sound toggle (hidden on screens without a running game). */
  showMute?: boolean;
  onBack?: () => void;
}

export default function GameHeader({
  title,
  brand = brandConfig.name,
  leaderboardTo,
  showMute = false,
  onBack,
}: Props) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14">
      <div className="h-full flex items-center justify-between px-3 bg-paper/95 backdrop-blur-xl text-ink border-b border-line">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-paper-2 hover:bg-line hover:border-brand/50 transition-colors px-3 py-1.5 text-ink"
            aria-label="Back"
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
          </button>
        ) : (
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-paper-2 hover:bg-line hover:border-brand/50 transition-colors px-3 py-1.5 text-ink"
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
        )}

        <div className="text-center pointer-events-none select-none">
          <div className="text-lg font-extrabold text-ink">{title}</div>
          <div className="text-[10px] text-brand leading-none font-medium">{brand}</div>
        </div>

        <div className="flex items-center gap-2">
          {showMute && (
            <MuteButton className="inline-flex items-center rounded-full border border-line bg-paper-2 hover:bg-line hover:border-brand/50 transition-colors px-3 py-1.5 text-ink" />
          )}
          {leaderboardTo && (
            <Link
              to={leaderboardTo}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-paper-2 hover:bg-line hover:border-brand/50 transition-colors px-3 py-1.5 text-ink"
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
