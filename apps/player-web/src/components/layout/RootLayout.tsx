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
      className="min-h-screen w-full font-sans text-flingo-900"
      style={{
        background: "#121318",
        backgroundImage: `
          radial-gradient(ellipse at 20% 0%, rgba(200, 255, 50, 0.04) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 100%, rgba(255, 62, 181, 0.04) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 50%, rgba(50, 212, 255, 0.02) 0%, transparent 70%)
        `,
      }}
    >
      {!hideGlobalHeader && <Header />}
      <main className="w-full h-full">
        <Outlet />
      </main>
    </div>
  );
}
