import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Seo from "../components/Seo";
import { games } from "../games";
import { getUserName, setUserName } from "../utils/user";
import NameDialog from "../components/NameDialog";

export default function GameHub() {
  const navigate = useNavigate();
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [name, setName] = useState<string>(getUserName() || "");

  useEffect(() => {
    // Prompt for name on first visit if not set
    if (!getUserName()) {
      setShowNameDialog(true);
    }
  }, []);

  const handleSaveName = (value: string) => {
    const v = value.trim();
    if (v.length === 0) return;
    setUserName(v);
    setName(v);
    setShowNameDialog(false);
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white flex flex-col items-center px-6 py-8">
      <Seo
        title="Free Online Games | Play Skill, Reflex & Arcade Games at Games4James"
        description="Play free online games made by James! Fun, fast, skill-based games you can play instantly on your phone or browser. Join Games4James today and test your reflexes."
        url="https://games4james.com/"
        canonical="https://games4james.com/"
        image="https://games4james.com/assets/logo.png"
      />
      
      {/* Logo */}
      <div className="mb-8 text-center">
        <img
          src="/assets/shared/logo_square.png"
          alt="James Games"
          className="block max-w-[300px] w-48 h-auto rounded-3xl shadow-2xl mx-auto ring-2 ring-purple-400/50"
        />
      </div>

      {/* Screen Name Button */}
      <div className="w-full max-w-6xl flex justify-end mb-8">
        <button
          type="button"
          onClick={() => setShowNameDialog(true)}
          className="text-sm font-bold px-6 py-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg hover:shadow-purple-500/50 transition-all transform hover:scale-105"
        >
          {name ? `👋 Hi, ${name}` : "Set Screen Name"}
        </button>
      </div>

      {/* Game Cards Grid - 1 col mobile, 2 col tablet, 4 col desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 w-full max-w-6xl">
        {games.map((g) => (
          <div
            key={g.id}
            className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl hover:shadow-purple-500/30 transition-all transform hover:scale-105 cursor-pointer border border-purple-500/20"
            onClick={() => navigate(`/games/${g.id}`)}
          >
            {/* Game Thumbnail */}
            <div
              className="h-48 bg-cover bg-center"
              style={{ backgroundImage: `url(${g.thumbnail || '/assets/logo.png'})` }}
              title={g.title}
            />
            
            {/* Game Info */}
            <div className="p-5">
              <h3 className="text-xl font-bold mb-2 text-white">{g.title}</h3>
              <p className="text-gray-300 text-sm mb-4 leading-relaxed">{g.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-purple-400 font-semibold text-sm">Play Now →</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showNameDialog && (
        <NameDialog
          initialValue={name}
          onCancel={() => setShowNameDialog(false)}
          onSave={handleSaveName}
        />
      )}
    </div>
  );
}
