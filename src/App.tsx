import { BrowserRouter, Routes, Route } from "react-router-dom";
import GameHub from "./pages/home";
import PlayGame from "./pages/games/PlayGame";
import LeaderboardPage from "./pages/leaderboard/[gameId]";
import LoginPage from "./pages/login";
import SignupPage from "./pages/signup";
import RootLayout from "./components/layout/RootLayout";
import SettingsScreen from "./pages/settings";
import AvatarSelect from "./pages/settings/AvatarSelect";
import { RequireAuth } from "./components/RouteGuards";
import SWUpdatePrompt from "./components/SWUpdatePrompt";
import InstallPWA from "./components/InstallPWA";
import IOSInstallHint from "./components/IOSInstallHint";
import SplashScreen from "./components/SplashScreen";
import { AuthProvider } from "./context/AuthProvider";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <SplashScreen />
        <SWUpdatePrompt />
        <InstallPWA />
        <IOSInstallHint />
        <Routes>
          <Route element={<RootLayout />}>
            <Route path="/" element={<GameHub />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route
              path="/settings"
              element={
                <RequireAuth>
                  <SettingsScreen />
                </RequireAuth>
              }
            />
            <Route
              path="/settings/avatar"
              element={
                <RequireAuth>
                  <AvatarSelect />
                </RequireAuth>
              }
            />
            <Route path="/games/:gameId" element={<PlayGame />} />
            <Route path="/leaderboard/:gameId" element={<LeaderboardPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
