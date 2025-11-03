import { BrowserRouter, Routes, Route } from "react-router-dom";
import GameHub from "./pages";
import PlayGame from "./pages/games/[gameId]";
import LeaderboardPage from "./pages/leaderboard/[gameId]";
import RootLayout from "./components/RootLayout";
import SWUpdatePrompt from "./components/SWUpdatePrompt";
import InstallPWA from "./components/InstallPWA";
import IOSInstallHint from "./components/IOSInstallHint";

export default function App() {
  return (
    <BrowserRouter>
      <SWUpdatePrompt />
      <InstallPWA />
      <IOSInstallHint />
      <Routes>
        <Route element={<RootLayout />}>
          <Route path="/" element={<GameHub />} />
          <Route path="/games/:gameId" element={<PlayGame />} />
          <Route path="/leaderboard/:gameId" element={<LeaderboardPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
