import { Link } from "react-router-dom";

type GameHeaderProps = {
  title: string;
  brand?: string;
};

export default function GameHeader({ title, brand = "James Games" }: GameHeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full h-14 border-b border-white/10 bg-gradient-to-r from-fuchsia-600/80 via-purple-600/80 to-blue-600/80 backdrop-blur supports-[backdrop-filter]:bg-opacity-80">
      <div className="h-full mx-auto max-w-[960px] px-3 flex items-center gap-3">
        <Link to="/" className="shrink-0">
          <span className="inline-flex items-center gap-2 rounded-md bg-white/10 hover:bg-white/20 px-3 py-1.5 text-sm font-semibold ring-1 ring-inset ring-white/20 transition-colors">
            <svg
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="-ml-0.5"
            >
              <path
                d="M12.5 4L6.5 10L12.5 16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back
          </span>
        </Link>

        <div className="flex-1 text-center">
          <div className="text-lg sm:text-xl font-extrabold tracking-wide text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]">
            {title}
          </div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/70">{brand}</div>
        </div>

        {/* spacer to balance layout with centered title */}
        <div className="w-[84px]" aria-hidden="true" />
      </div>
    </header>
  );
}
