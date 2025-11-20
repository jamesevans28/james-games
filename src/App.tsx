import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import GameHub from "./pages/home";
import PlayGame from "./pages/games/PlayGame";
import LeaderboardPage from "./pages/leaderboard/[gameId]";
import LoginPage from "./pages/login";
import SignupPage from "./pages/signup";
import RootLayout from "./components/layout/RootLayout";
import SettingsScreen from "./pages/settings";
import AvatarSelect from "./pages/settings/AvatarSelect";
import FollowersPage from "./pages/followers";
import ProfilePage from "./pages/profile/[userId]";
import NotificationsPage from "./pages/notifications";
import { RequireAuth } from "./components/RouteGuards";
import SWUpdatePrompt from "./components/SWUpdatePrompt";
import InstallPWA from "./components/InstallPWA";
import IOSInstallHint from "./components/IOSInstallHint";
import SplashScreen from "./components/SplashScreen";
import { AuthProvider } from "./context/AuthProvider";
import PageTransition from "./components/PageTransition";

function AppRoutes() {
  const location = useLocation();

  return (
    <PageTransition>
      <Routes location={location}>
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
          <Route
            path="/followers"
            element={
              <RequireAuth>
                <FollowersPage />
              </RequireAuth>
            }
          />
          <Route
            path="/notifications"
            element={
              <RequireAuth>
                <NotificationsPage />
              </RequireAuth>
            }
          />
          <Route path="/profile/:userId" element={<ProfilePage />} />
          <Route path="/games/:gameId" element={<PlayGame />} />
          <Route path="/leaderboard/:gameId" element={<LeaderboardPage />} />
        </Route>
      </Routes>
    </PageTransition>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <SplashScreen />
        <SWUpdatePrompt />
        <InstallPWA />
        <IOSInstallHint />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
