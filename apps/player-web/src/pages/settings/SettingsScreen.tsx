import { useEffect, useState } from "react";
import { fetchMe, updateSettings } from "../../lib/api";
import { useAuth } from "../../context/FirebaseAuthProvider";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { OfflineBanner } from "../../components/OfflineBanner";

export default function SettingsScreen() {
  const {
    user,
    linkGoogle,
    linkApple,
    refreshProfile,
    changePin,
    addEmail,
    sendVerificationEmail,
    checkEmailVerified,
  } = useAuth();

  // Screen name state
  const [screenName, setScreenName] = useState("");
  const [initial, setInitial] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Linking state
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Email state
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [addingEmail, setAddingEmail] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(false);

  // PIN change state
  const [showPinChange, setShowPinChange] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState(false);
  const [changingPin, setChangingPin] = useState(false);

  const { isOnline } = useOnlineStatus();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchMe();
        const u = data?.user;
        const sn = u?.screenName || "";
        if (!cancelled) {
          setScreenName(sn);
          setInitial(sn);
        }
      } catch (e) {
        // ignore for now
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = screenName.trim() !== initial.trim() && screenName.trim().length >= 2;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    if (!navigator.onLine) {
      setError("You're offline. Connect to save changes.");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);
      const res = await updateSettings({ screenName: screenName.trim() });
      setInitial(res.screenName || screenName.trim());
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
      await refreshProfile();
    } catch (e: any) {
      if (!navigator.onLine) {
        setError("You're offline. Connect to save changes.");
      } else {
        setError(e?.message || "Failed to update");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleLinkGoogle() {
    setLinkError(null);
    if (!navigator.onLine) {
      setLinkError("You're offline. Connect to link accounts.");
      return;
    }
    setLinkingProvider("google");
    try {
      await linkGoogle();
      await refreshProfile();
    } catch (e: any) {
      if (!navigator.onLine) {
        setLinkError("You're offline. Connect to link accounts.");
      } else {
        setLinkError(e?.message || "Failed to link Google account");
      }
    } finally {
      setLinkingProvider(null);
    }
  }

  async function handleLinkApple() {
    setLinkError(null);
    if (!navigator.onLine) {
      setLinkError("You're offline. Connect to link accounts.");
      return;
    }
    setLinkingProvider("apple");
    try {
      await linkApple();
      await refreshProfile();
    } catch (e: any) {
      setLinkError(e?.message || "Failed to link Apple account");
    } finally {
      setLinkingProvider(null);
    }
  }

  async function handleAddEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Please enter a valid email address");
      return;
    }
    if (!navigator.onLine) {
      setEmailError("You're offline. Connect to add email.");
      return;
    }

    setEmailError(null);
    setEmailSuccess(null);
    setAddingEmail(true);
    try {
      await addEmail(email);
      setEmailSuccess("Email added! Check your inbox for a verification link.");
      // Automatically send verification email
      try {
        await sendVerificationEmail();
      } catch {
        // Ignore if verification email fails - user can resend manually
      }
      setEmail("");
    } catch (e: any) {
      if (!navigator.onLine) {
        setEmailError("You're offline. Connect to add email.");
      } else {
        setEmailError(e?.message || "Failed to add email");
      }
    } finally {
      setAddingEmail(false);
    }
  }

  async function handleSendVerification() {
    setEmailError(null);
    setEmailSuccess(null);
    if (!navigator.onLine) {
      setEmailError("You're offline. Connect to send verification email.");
      return;
    }
    setSendingVerification(true);
    try {
      await sendVerificationEmail();
      setEmailSuccess("Verification email sent! Check your inbox.");
    } catch (e: any) {
      if (!navigator.onLine) {
        setEmailError("You're offline. Connect to send verification email.");
      } else {
        setEmailError(e?.message || "Failed to send verification email");
      }
    } finally {
      setSendingVerification(false);
    }
  }

  async function handleCheckVerification() {
    setEmailError(null);
    setEmailSuccess(null);
    if (!navigator.onLine) {
      setEmailError("You're offline. Connect to check verification status.");
      return;
    }
    setCheckingVerification(true);
    try {
      const isVerified = await checkEmailVerified();
      if (isVerified) {
        setEmailSuccess("Email verified successfully!");
      } else {
        setEmailError(
          "Email not yet verified. Please check your inbox and click the verification link."
        );
      }
    } catch (e: any) {
      if (!navigator.onLine) {
        setEmailError("You're offline. Connect to check verification status.");
      } else {
        setEmailError(e?.message || "Failed to check verification status");
      }
    } finally {
      setCheckingVerification(false);
    }
  }

  async function handleChangePin(e: React.FormEvent) {
    e.preventDefault();
    setPinError(null);
    setPinSuccess(false);

    if (!navigator.onLine) {
      setPinError("You're offline. Connect to change PIN.");
      return;
    }

    if (!/^\d{4,8}$/.test(newPin)) {
      setPinError("New PIN must be 4-8 digits");
      return;
    }

    if (newPin !== confirmPin) {
      setPinError("PINs do not match");
      return;
    }

    setChangingPin(true);
    try {
      await changePin(currentPin, newPin);
      setPinSuccess(true);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setShowPinChange(false);
      setTimeout(() => setPinSuccess(false), 3000);
    } catch (e: any) {
      if (!navigator.onLine) {
        setPinError("You're offline. Connect to change PIN.");
      } else {
        setPinError(e?.message || "Failed to change PIN");
      }
    } finally {
      setChangingPin(false);
    }
  }

  const hasGoogle = user?.providers?.includes("google.com");
  const hasApple = user?.providers?.includes("apple.com");
  const isUsernamePin = user?.accountType === "username_pin";
  const isAnonymous = user?.accountType === "anonymous";
  const hasEmail = !!user?.email;
  const emailVerified = user?.emailVerified;

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6 text-flingo-900">Account Settings</h1>

      {/* Offline Banner */}
      {!isOnline && <OfflineBanner className="mb-4" />}

      {/* Screen Name Section */}
      <form
        onSubmit={handleSubmit}
        className="space-y-4 mb-8 p-5 bg-surface-card rounded-2xl border border-flingo-200/30"
      >
        <div>
          <label className="block text-sm font-bold text-flingo-900 mb-2">Screen name</label>
          <input
            type="text"
            value={screenName}
            onChange={(e) => setScreenName(e.target.value)}
            className="w-full bg-flingo-100 border border-flingo-200/50 rounded-xl px-4 py-3 text-sm text-flingo-900 placeholder-flingo-500 focus:outline-none focus:ring-2 focus:ring-neon-lime/50 focus:border-neon-lime/50 transition-all"
            maxLength={24}
            placeholder="Your public name"
          />
          <p className="mt-2 text-xs text-flingo-600">2–24 characters. Shown on leaderboards.</p>
        </div>
        {error && <div className="text-sm text-neon-pink font-medium">{error}</div>}
        {success && <div className="text-sm text-neon-lime font-medium">✓ Saved!</div>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!dirty || saving}
            className={`btn ${
              dirty
                ? "btn-primary"
                : "bg-flingo-200 text-flingo-500 cursor-not-allowed rounded-full px-5 py-2.5 text-sm font-bold"
            }`}
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>

      {/* Account Section */}
      <div className="p-5 bg-surface-card rounded-2xl border border-flingo-200/30 mb-6">
        <h2 className="text-lg font-bold mb-4 text-flingo-900">Account</h2>

        {/* Account Type Badge */}
        <div className="mb-4">
          <span className="text-sm text-flingo-700 font-medium">Account type: </span>
          <span
            className={`text-xs px-3 py-1 rounded-full font-bold ${
              isAnonymous
                ? "bg-neon-yellow/20 text-neon-yellow border border-neon-yellow/30"
                : isUsernamePin
                ? "bg-neon-blue/20 text-neon-blue border border-neon-blue/30"
                : "bg-neon-lime/20 text-neon-lime border border-neon-lime/30"
            }`}
          >
            {isAnonymous ? "Guest" : isUsernamePin ? "Username + PIN" : "Linked Account"}
          </span>
        </div>

        {/* Username display for username+PIN accounts */}
        {user?.username && (
          <div className="mb-4">
            <span className="text-sm text-flingo-700 font-medium">Username: </span>
            <span className="text-sm font-bold text-flingo-900">{user.username}</span>
          </div>
        )}
      </div>

      {/* Email Section */}
      <div className="p-5 bg-surface-card rounded-2xl border border-flingo-200/30 mb-6">
        <h2 className="text-lg font-bold mb-4 text-flingo-900">Email Address</h2>

        {emailError && (
          <div className="mb-3 p-3 bg-neon-pink/10 border border-neon-pink/30 text-neon-pink text-sm rounded-xl font-medium">
            {emailError}
          </div>
        )}
        {emailSuccess && (
          <div className="mb-3 p-3 bg-neon-lime/10 border border-neon-lime/30 text-neon-lime text-sm rounded-xl font-medium">
            {emailSuccess}
          </div>
        )}

        {hasEmail ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-flingo-700 font-medium">Email: </span>
              <span className="text-sm text-flingo-900 font-bold">{user?.email}</span>
              {emailVerified ? (
                <span className="text-xs bg-neon-lime/20 text-neon-lime px-2 py-1 rounded-full font-bold border border-neon-lime/30">
                  ✓ Verified
                </span>
              ) : (
                <span className="text-xs bg-neon-yellow/20 text-neon-yellow px-2 py-1 rounded-full font-bold border border-neon-yellow/30">
                  Not verified
                </span>
              )}
            </div>

            {!emailVerified && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleSendVerification}
                  disabled={sendingVerification}
                  className="btn btn-primary text-sm"
                >
                  {sendingVerification ? "Sending..." : "Resend verification email"}
                </button>
                <button
                  onClick={handleCheckVerification}
                  disabled={checkingVerification}
                  className="btn btn-outline text-sm"
                >
                  {checkingVerification ? "Checking..." : "I've verified my email"}
                </button>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleAddEmail} className="space-y-3">
            <p className="text-sm text-flingo-700">
              Add an email address to help recover your account.
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="flex-1 bg-flingo-100 border border-flingo-200/50 rounded-xl px-4 py-2.5 text-sm text-flingo-900 placeholder-flingo-500 focus:outline-none focus:ring-2 focus:ring-neon-lime/50 focus:border-neon-lime/50 transition-all"
              />
              <button
                type="submit"
                disabled={addingEmail || !email}
                className="btn btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingEmail ? "Adding..." : "Add"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* PIN Change Section (only for username+PIN accounts) */}
      {isUsernamePin && (
        <div className="p-5 bg-surface-card rounded-2xl border border-flingo-200/30 mb-6">
          <h2 className="text-lg font-bold mb-4 text-flingo-900">Security</h2>

          {pinSuccess && (
            <div className="mb-3 p-3 bg-neon-lime/10 border border-neon-lime/30 text-neon-lime text-sm rounded-xl font-medium">
              ✓ PIN changed successfully!
            </div>
          )}

          {!showPinChange ? (
            <button onClick={() => setShowPinChange(true)} className="btn btn-outline text-sm">
              🔐 Change PIN
            </button>
          ) : (
            <form onSubmit={handleChangePin} className="space-y-4 max-w-xs">
              <div>
                <label className="block text-sm font-bold text-flingo-900 mb-2">Current PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="\d*"
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  className="w-full bg-flingo-100 border border-flingo-200/50 rounded-xl px-4 py-3 text-sm text-flingo-900 placeholder-flingo-500 focus:outline-none focus:ring-2 focus:ring-neon-lime/50 focus:border-neon-lime/50 transition-all"
                  placeholder="Enter current PIN"
                  maxLength={8}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-flingo-900 mb-2">New PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="\d*"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  className="w-full bg-flingo-100 border border-flingo-200/50 rounded-xl px-4 py-3 text-sm text-flingo-900 placeholder-flingo-500 focus:outline-none focus:ring-2 focus:ring-neon-lime/50 focus:border-neon-lime/50 transition-all"
                  placeholder="4-8 digits"
                  maxLength={8}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-flingo-900 mb-2">
                  Confirm new PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="\d*"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  className="w-full bg-flingo-100 border border-flingo-200/50 rounded-xl px-4 py-3 text-sm text-flingo-900 placeholder-flingo-500 focus:outline-none focus:ring-2 focus:ring-neon-lime/50 focus:border-neon-lime/50 transition-all"
                  placeholder="Confirm new PIN"
                  maxLength={8}
                />
              </div>

              {pinError && <div className="text-sm text-neon-pink font-medium">{pinError}</div>}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={changingPin || !currentPin || !newPin || !confirmPin}
                  className="btn btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {changingPin ? "Changing..." : "Change PIN"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPinChange(false);
                    setCurrentPin("");
                    setNewPin("");
                    setConfirmPin("");
                    setPinError(null);
                  }}
                  className="btn btn-outline text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Linked Providers Section */}
      <div className="p-5 bg-surface-card rounded-2xl border border-flingo-200/30">
        <h2 className="text-lg font-bold mb-4 text-flingo-900">Linked Accounts</h2>

        {linkError && (
          <div className="mb-3 p-3 bg-neon-pink/10 border border-neon-pink/30 text-neon-pink text-sm rounded-xl font-medium">
            {linkError}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {hasGoogle ? (
            <div className="flex items-center gap-3 text-sm text-flingo-800 bg-neon-lime/10 p-4 rounded-xl border border-neon-lime/30">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"
                />
              </svg>
              <span className="font-bold">Google connected</span>
              <span className="ml-auto text-neon-lime font-bold">✓</span>
            </div>
          ) : (
            <button
              onClick={handleLinkGoogle}
              disabled={linkingProvider !== null}
              className="flex items-center gap-3 text-sm text-flingo-800 bg-surface-card border border-flingo-200/30 p-4 rounded-xl hover:bg-flingo-100 hover:border-flingo-200/50 disabled:opacity-50 transition-all"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"
                />
              </svg>
              <span className="font-bold">
                {linkingProvider === "google" ? "Connecting..." : "Connect Google"}
              </span>
            </button>
          )}

          {hasApple ? (
            <div className="flex items-center gap-3 text-sm text-flingo-800 bg-neon-lime/10 p-4 rounded-xl border border-neon-lime/30">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
                />
              </svg>
              <span className="font-bold">Apple connected</span>
              <span className="ml-auto text-neon-lime font-bold">✓</span>
            </div>
          ) : (
            <button
              onClick={handleLinkApple}
              disabled={linkingProvider !== null}
              className="flex items-center gap-3 text-sm text-flingo-800 bg-surface-card border border-flingo-200/30 p-4 rounded-xl hover:bg-flingo-100 hover:border-flingo-200/50 disabled:opacity-50 transition-all"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
                />
              </svg>
              <span className="font-bold">
                {linkingProvider === "apple" ? "Connecting..." : "Connect Apple"}
              </span>
            </button>
          )}
        </div>

        <p className="text-xs text-flingo-600 mt-4">
          Link a social account to sign in more easily and access your account from any device.
        </p>
      </div>
    </div>
  );
}
