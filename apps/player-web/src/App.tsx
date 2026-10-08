import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router";
import HomeGrid from "./pages/home/HomeGrid";
import RootLayout from "./components/layout/RootLayout";
import { RequireRegistered } from "./components/RouteGuards";
import SWUpdatePrompt from "./components/SWUpdatePrompt";
import InstallPWA from "./components/InstallPWA";
import IOSInstallHint from "./components/IOSInstallHint";
import SplashScreen from "./components/SplashScreen";
import { adapters } from "./platform/adapters";
import { useScoreQueueFlusher } from "./hooks/useScoreQueueFlusher";
import { AuthProvider } from "./context/FirebaseAuthProvider";
import { GameCatalogProvider } from "./context/GameCatalogProvider";
import PageTransition from "./components/PageTransition";

// The home grid loads with the app so the first screen paints at once; every other
// page is its own chunk, fetched on first visit (and precached by the service worker).
const PlayGame = lazy(() => import("./pages/games/PlayGame"));
const LeaderboardPage = lazy(() => import("./pages/leaderboard/[gameId]"));
const LoginPage = lazy(() => import("./pages/firebase-login"));
const SettingsScreen = lazy(() => import("./pages/settings"));
const AvatarSelect = lazy(() => import("./pages/settings/AvatarSelect"));
const FollowersPage = lazy(() => import("./pages/followers"));
const ProfilePage = lazy(() => import("./pages/profile/[userId]"));
const NotificationsPage = lazy(() => import("./pages/notifications"));
const PrivacyPage = lazy(() => import("./pages/privacy"));
const AboutPage = lazy(() => import("./pages/about"));
const ParentsPage = lazy(() => import("./pages/parents"));
const SupportPage = lazy(() => import("./pages/support"));

function AppRoutes() {
  const location = useLocation();
  useScoreQueueFlusher();

  return (
    <PageTransition>
      <Suspense fallback={null}>
        <Routes location={location}>
          <Route element={<RootLayout />}>
            <Route path="/" element={<HomeGrid />} />
            <Route path="/games-list" element={<Navigate to="/" replace />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/parents" element={<ParentsPage />} />
            <Route path="/support" element={<SupportPage />} />
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
      </Suspense>
    </PageTransition>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <GameCatalogProvider>
        <BrowserRouter>
          {/* Inside the native apps: no service worker, no install hints, native splash (T10.2). */}
          {!adapters.app.isNative && (
            <>
              <SplashScreen />
              <SWUpdatePrompt />
              <InstallPWA />
              <IOSInstallHint />
            </>
          )}
          <AppRoutes />
        </BrowserRouter>
      </GameCatalogProvider>
    </AuthProvider>
  );
}
