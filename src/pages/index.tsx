import { useNavigate } from "react-router-dom";
import Seo from "../components/Seo";
import { games } from "../games";

export default function GameHub() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center px-4 py-6">
      <Seo
        title="Free Online Games | Play Skill, Reflex & Arcade Games at Games4James"
        description="Play free online games made by James! Fun, fast, skill-based games you can play instantly on your phone or browser. Join Games4James today and test your reflexes."
        url="https://games4james.com/"
        canonical="https://games4james.com/"
        image="https://games4james.com/assets/logo.png"
      />
      {/* Logo at the top */}
      <div className="mt-2 mb-4 max-w-full">
        <img
          src="/assets/shared/logo_square.png"
          alt="James Games"
          className="block max-w-full h-auto w-24 md:w-28 rounded-xl shadow-[0_6px_20px_rgba(0,0,0,0.35)] ring-1 ring-white/10 mx-auto"
        />
      </div>

      <p className="text-xs uppercase tracking-[0.2em] text-white/70 mb-5">Tap a game to play</p>

      {/* Simple, inviting game buttons */}
      <div className="mx-auto px-3 sm:px-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-4xl">
        {games.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => navigate(`/games/${g.id}`)}
            className="text-left w-full m-3 rounded-3xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 px-5 py-5 shadow-[0_6px_20px_rgba(0,0,0,0.25)]"
            aria-label={`Open ${g.title}`}
          >
            <div className="text-2xl md:text-3xl font-extrabold tracking-wide text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]">
              {g.title}
            </div>
            <div className="mt-1 h-1 w-12 rounded-full bg-gradient-to-r from-fuchsia-500 via-purple-500 to-sky-500 opacity-70" />
            {g.description && (
              <div className="text-sm text-white/70 mt-1 leading-snug">{g.description}</div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
