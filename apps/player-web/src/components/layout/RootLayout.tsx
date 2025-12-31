import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header";

export default function RootLayout() {
  const { pathname } = useLocation();

  // Hide the global header and auth banner for any game-related pages.
  // Individual game pages such as PlayGame or GameLanding render their own
  // header/banner and we don't want duplicated chrome when viewing a game.
  // Also hide for leaderboard pages which present a focused view.
  const hideGlobalHeader =
    pathname === "/games" ||
    pathname.startsWith("/games/") ||
    pathname === "/leaderboard" ||
    pathname.startsWith("/leaderboard/");

  return (
    <div
      className="min-h-screen w-full font-sans text-gray-800"
      style={{
        background:
          "linear-gradient(180deg, #FAF5FF 0%, rgba(255, 247, 237, 0.3) 50%, rgba(236, 253, 245, 0.3) 100%)",
      }}
    >
      {!hideGlobalHeader && <Header />}
      <main className="w-full h-full">
        <Outlet />
      </main>
    </div>
  );
}
