import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import GameHub from "./pages/home";
import PlayGame from "./pages/games/PlayGame";
import LeaderboardPage from "./pages/leaderboard/[gameId]";
import LoginPage from "./pages/firebase-login";
import RootLayout from "./components/layout/RootLayout";
import SettingsScreen from "./pages/settings";
import AvatarSelect from "./pages/settings/AvatarSelect";
import FollowersPage from "./pages/followers";
import ProfilePage from "./pages/profile/[userId]";
import NotificationsPage from "./pages/notifications";
import { RequireAuth, RequireRegistered } from "./components/RouteGuards";
import SWUpdatePrompt from "./components/SWUpdatePrompt";
import InstallPWA from "./components/InstallPWA";
import IOSInstallHint from "./components/IOSInstallHint";
import SplashScreen from "./components/SplashScreen";
import AccountUpgradeBanner from "./components/AccountUpgradeBanner";
import { AuthProvider } from "./context/FirebaseAuthProvider";
import PageTransition from "./components/PageTransition";

function AppRoutes() {
  const location = useLocation();

  return (
    <PageTransition>
      <Routes location={location}>
        <Route element={<RootLayout />}>
          <Route path="/" element={<GameHub />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<LoginPage />} />
          <Route
            path="/settings"
            element={
              <RequireRegistered>
                <SettingsScreen />
              </RequireRegistered>
            }
          />
          <Route
            path="/settings/avatar"
            element={
              <RequireRegistered>
                <AvatarSelect />
              </RequireRegistered>
            }
          />
          <Route
            path="/followers"
            element={
              <RequireRegistered>
                <FollowersPage />
              </RequireRegistered>
            }
          />
          <Route
            path="/notifications"
            element={
              <RequireRegistered>
                <NotificationsPage />
              </RequireRegistered>
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
        <AccountUpgradeBanner />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
