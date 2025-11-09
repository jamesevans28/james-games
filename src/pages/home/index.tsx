import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Seo from "../../components/Seo";
import { games, GameMeta } from "../../games";
import { getUserName, setUserName } from "../../utils/user";
// import NameDialog from "../../components/NameDialog";
// useSession removed — currently not needed on the home page

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

  // Filter games into recently added and most popular
  const { recentGames, popularGames } = useMemo(() => {
    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

    const recent: GameMeta[] = [];
    const popular: GameMeta[] = [];

    games.forEach((game) => {
      if (game.createdAt) {
        const createdDate = new Date(game.createdAt);
        if (createdDate >= fourDaysAgo) {
          recent.push(game);
        } else {
          popular.push(game);
        }
      } else {
        // Games without createdAt go to popular
        popular.push(game);
      }
    });

    // Sort recent games by createdAt descending (most recent first)
    recent.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());

    return { recentGames: recent, popularGames: popular };
  }, []);

  const GameCard = ({ game }: { game: GameMeta }) => (
    <div
      className="bg-white rounded-lg border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => navigate(`/games/${game.id}`)}
    >
      {/* Game Thumbnail */}
      <div
        className="aspect-square bg-cover bg-center"
        style={{ backgroundImage: `url(${game.thumbnail || "/assets/logo.png"})` }}
        title={game.title}
      />

      {/* Game Info */}
      <div className="px-3 py-2">
        <h3 className="text-sm font-semibold truncate">{game.title}</h3>
      </div>
    </div>
  );
  return (
    <div className="min-h-screen bg-white text-black flex flex-col">
      <Seo
        title="Free Online Games | Play Skill, Reflex & Arcade Games at Games4James"
        description="Play free online games made by James! Fun, fast, skill-based games you can play instantly on your phone or browser. Join Games4James today and test your reflexes."
        url="https://games4james.com/"
        canonical="https://games4james.com/"
        image="https://games4james.com/assets/logo.png"
      />

      {/* Recently Added Section */}
      {recentGames.length > 0 && (
        <div className="w-full max-w-6xl mx-auto px-4 py-6">
          <h2 className="text-xl font-bold mb-4 text-black">Recently Added</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            {recentGames.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        </div>
      )}

      {/* Most Popular Section */}
      <div className="w-full max-w-6xl mx-auto px-4 py-6">
        <h2 className="text-xl font-bold mb-4 text-black">Most Popular</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {popularGames.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </div>

      {/* {showNameDialog && (
        <NameDialog
          initialValue={name}
          onCancel={() => setShowNameDialog(false)}
          onSave={handleSaveName}
        />
      )} */}
    </div>
  );
}
