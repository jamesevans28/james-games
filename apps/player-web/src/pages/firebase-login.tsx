import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/FirebaseAuthProvider";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { OfflineBanner } from "../components/OfflineBanner";

type AuthMode = "login" | "register";

export default function FirebaseLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    signInWithUsername,
    registerWithUsername,
    signInWithGoogle,
    signInWithApple,
    loading,
    user,
    initialized,
  } = useAuth();

  // Determine initial mode based on route path
  const getInitialMode = (): AuthMode => {
    if (location.pathname === "/signup") return "register";
    return "login";
  };

  const [mode, setMode] = useState<AuthMode>(getInitialMode);
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [screenName, setScreenName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const { isOnline } = useOnlineStatus();

  // Update mode when route changes
  useEffect(() => {
    setMode(getInitialMode());
  }, [location.pathname]);

  // Show loading while Firebase initializes
  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-dark">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neon-lime mx-auto mb-4"></div>
          <p className="text-flingo-800 font-medium">Loading...</p>
          <p className="text-xs text-flingo-600 mt-2">Getting things ready...</p>
        </div>
      </div>
    );
  }

  // If user is already signed in with a non-anonymous account, redirect
  if (user && !user.isAnonymous) {
    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get("state") || "/";
    navigate(returnTo, { replace: true });
    return null;
  }

  const validate = () => {
    const errors: string[] = [];
    if (!username || username.length < 3) {
      errors.push("Username must be at least 3 characters");
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      errors.push("Username can only contain letters, numbers, and underscores");
    }
    if (!pin || pin.length < 4) {
      errors.push("PIN must be at least 4 digits");
    }
    if (!/^\d+$/.test(pin)) {
      errors.push("PIN must be numbers only");
    }
    if (mode === "register" && !screenName) {
      errors.push("Screen name is required");
    }
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTriedSubmit(true);
    setError(null);

    // Check if offline
    if (!navigator.onLine) {
      setError("You're offline. Connect to the internet to sign in.");
      return;
    }

    const validationErrors = validate();
    if (validationErrors.length > 0) {
      setError(validationErrors[0]);
      return;
    }

    try {
      if (mode === "login") {
        await signInWithUsername(username, pin);
      } else {
        // registerWithUsername handles anonymous sign-in internally if needed
        await registerWithUsername(username, pin, screenName || username);
      }
      const params = new URLSearchParams(window.location.search);
      const returnTo = params.get("state") || "/";
      navigate(returnTo, { replace: true });
    } catch (err: any) {
      if (!navigator.onLine) {
        setError("You're offline. Connect to the internet to sign in.");
      } else {
        setError(err?.message || "Authentication failed");
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    // Check if offline
    if (!navigator.onLine) {
      setError("You're offline. Connect to the internet to sign in.");
      return;
    }
    try {
      await signInWithGoogle();
      const params = new URLSearchParams(window.location.search);
      const returnTo = params.get("state") || "/";
      navigate(returnTo, { replace: true });
    } catch (err: any) {
      if (!navigator.onLine) {
        setError("You're offline. Connect to the internet to sign in.");
      } else {
        setError(err?.message || "Google sign in failed");
      }
    }
  };

  const handleAppleSignIn = async () => {
    setError(null);
    // Check if offline
    if (!navigator.onLine) {
      setError("You're offline. Connect to the internet to sign in.");
      return;
    }
    try {
      await signInWithApple();
      const params = new URLSearchParams(window.location.search);
      const returnTo = params.get("state") || "/";
      navigate(returnTo, { replace: true });
    } catch (err: any) {
      if (!navigator.onLine) {
        setError("You're offline. Connect to the internet to sign in.");
      } else {
        setError(err?.message || "Apple sign in failed");
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-dark p-6">
      <div className="max-w-lg w-full p-6 bg-surface-card backdrop-blur-lg rounded-3xl shadow-card-hover border border-flingo-200/30">
        {/* Offline Banner */}
        {!isOnline && <OfflineBanner className="mb-4" />}

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-sm text-flingo-700 font-medium hover:text-neon-lime transition-colors"
          >
            ← Back
          </button>
          <img src="/assets/shared/flingo-logo-small.svg" alt="Flingo.fun" className="w-10 h-10" />
        </div>

        {/* Mode Toggle */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex bg-flingo-100 rounded-full p-1">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
                mode === "login"
                  ? "bg-surface-card shadow-card text-neon-lime"
                  : "text-flingo-600 hover:text-flingo-800"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError(null);
              }}
              className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
                mode === "register"
                  ? "bg-surface-card shadow-card text-neon-lime"
                  : "text-flingo-600 hover:text-flingo-800"
              }`}
            >
              Create Account
            </button>
          </div>
        </div>

        {/* Migration Notice Banner */}
        <div className="mb-5 text-sm p-4 bg-neon-blue/10 border border-neon-blue/30 rounded-2xl">
          <div className="font-bold mb-2 text-flingo-900">📢 Account System Update</div>
          <p className="text-flingo-800 mb-2">
            We've upgraded our login system! If you had an account before:
          </p>
          <ul className="list-disc list-inside space-y-1 text-flingo-700 text-xs">
            <li>
              <strong>Existing users:</strong> Use "Create Account" with your{" "}
              <strong>same username</strong> and set a new PIN. Your scores and progress will be
              restored!
            </li>
            <li>
              <strong>New users:</strong> Just create a new account below.
            </li>
          </ul>
        </div>

        {/* Info for new users */}
        {mode === "register" && (
          <div className="mb-5 text-sm text-flingo-800 p-4 bg-neon-yellow/10 border border-neon-yellow/30 rounded-2xl">
            <div className="font-bold mb-2">🎮 Why create an account?</div>
            <ul className="list-disc list-inside space-y-1 text-flingo-700">
              <li>Save your high scores to leaderboards</li>
              <li>Choose your own avatar</li>
              <li>Follow your friends</li>
              <li>Keep your progress across devices</li>
            </ul>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="mb-4 p-3 bg-neon-pink/10 border border-neon-pink/30 rounded-2xl text-neon-pink text-sm font-medium">
            {error}
          </div>
        )}

        {/* Username + PIN Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <div className="text-sm font-bold text-flingo-900 mb-1.5">Username</div>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-3.5 bg-flingo-100 border border-flingo-200/50 rounded-2xl placeholder-flingo-500 text-flingo-900 focus:outline-none focus:ring-2 focus:ring-neon-lime/50 focus:border-neon-lime/50 transition-all"
              placeholder="Enter your username"
              autoComplete="username"
            />
            {triedSubmit && !username && (
              <div className="text-neon-pink text-xs mt-1 font-medium">Username is required</div>
            )}
          </label>

          <label className="block">
            <div className="text-sm font-bold text-flingo-900 mb-1.5">PIN (4-8 digits)</div>
            <input
              value={pin}
              onChange={(e) => {
                // Only allow digits
                const val = e.target.value.replace(/\D/g, "").slice(0, 8);
                setPin(val);
              }}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              className="w-full p-3.5 bg-flingo-100 border border-flingo-200/50 rounded-2xl placeholder-flingo-500 text-flingo-900 focus:outline-none focus:ring-2 focus:ring-neon-lime/50 focus:border-neon-lime/50 font-mono text-xl tracking-widest transition-all"
              placeholder="••••"
              autoComplete={mode === "register" ? "new-password" : "current-password"}
            />
            {triedSubmit && (!pin || pin.length < 4) && (
              <div className="text-neon-pink text-xs mt-1 font-medium">
                PIN must be at least 4 digits
              </div>
            )}
            <div className="text-xs text-flingo-600 mt-1.5">
              {mode === "register"
                ? "Choose a PIN you'll remember — like a birthday or lucky numbers!"
                : "Enter your 4-8 digit PIN"}
            </div>
          </label>

          {mode === "register" && (
            <label className="block">
              <div className="text-sm font-bold text-flingo-900 mb-1.5">Screen Name</div>
              <input
                value={screenName}
                onChange={(e) => setScreenName(e.target.value)}
                className="w-full p-3.5 bg-flingo-100 border border-flingo-200/50 rounded-2xl placeholder-flingo-500 text-flingo-900 focus:outline-none focus:ring-2 focus:ring-neon-lime/50 focus:border-neon-lime/50 transition-all"
                placeholder="Your display name on leaderboards"
              />
              {triedSubmit && !screenName && (
                <div className="text-neon-pink text-xs mt-1 font-medium">
                  Screen name is required
                </div>
              )}
            </label>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary w-full py-3.5">
            {loading ? "Please wait..." : mode === "login" ? "🚀 Sign In" : "🎉 Create Account"}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-flingo-200/30"></div>
          <span className="px-4 text-sm text-flingo-600 font-medium">or continue with</span>
          <div className="flex-1 border-t border-flingo-200/30"></div>
        </div>

        {/* Social Sign In */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-3.5 bg-white text-gray-800 rounded-full font-semibold hover:bg-gray-100 disabled:opacity-50 flex items-center justify-center gap-3 transition-all"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>

          <button
            type="button"
            onClick={handleAppleSignIn}
            disabled={loading}
            className="w-full py-3.5 bg-white text-gray-900 rounded-full font-semibold hover:bg-gray-100 disabled:opacity-50 flex items-center justify-center gap-3 transition-all"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            Continue with Apple
          </button>
        </div>

        {/* Anonymous play notice */}
        {user?.isAnonymous && (
          <div className="mt-6 text-center text-sm text-flingo-600">
            <p className="font-medium">You're currently playing as a guest.</p>
            <p className="text-xs mt-1">
              Create an account to save your progress and compete on leaderboards!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
