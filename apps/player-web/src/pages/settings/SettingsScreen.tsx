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
      <h1 className="text-2xl font-bold mb-4 text-black">Account Settings</h1>

      {/* Offline Banner */}
      {!isOnline && <OfflineBanner className="mb-4" />}

      {/* Screen Name Section */}
      <form onSubmit={handleSubmit} className="space-y-4 mb-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Screen name</label>
          <input
            type="text"
            value={screenName}
            onChange={(e) => setScreenName(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            maxLength={24}
            placeholder="Your public name"
          />
          <p className="mt-1 text-xs text-gray-500">2–24 characters. Shown on leaderboards.</p>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        {success && <div className="text-sm text-green-600">Saved!</div>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!dirty || saving}
            className={`px-4 py-2 rounded text-sm font-medium text-white ${
              dirty ? "bg-indigo-600 hover:bg-indigo-700" : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>

      {/* Account Section */}
      <div className="border-t pt-6">
        <h2 className="text-lg font-semibold mb-3 text-black">Account</h2>

        {/* Account Type Badge */}
        <div className="mb-4">
          <span className="text-sm text-gray-600">Account type: </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              isAnonymous
                ? "bg-yellow-100 text-yellow-700"
                : isUsernamePin
                ? "bg-blue-100 text-blue-700"
                : "bg-green-100 text-green-700"
            }`}
          >
            {isAnonymous ? "Guest" : isUsernamePin ? "Username + PIN" : "Linked Account"}
          </span>
        </div>

        {/* Username display for username+PIN accounts */}
        {user?.username && (
          <div className="mb-4">
            <span className="text-sm text-gray-600">Username: </span>
            <span className="text-sm font-medium text-gray-900">{user.username}</span>
          </div>
        )}
      </div>

      {/* Email Section */}
      <div className="border-t pt-6 mt-6">
        <h2 className="text-lg font-semibold mb-3 text-black">Email Address</h2>

        {emailError && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded">
            {emailError}
          </div>
        )}
        {emailSuccess && (
          <div className="mb-3 p-3 bg-green-50 border border-green-200 text-green-600 text-sm rounded">
            {emailSuccess}
          </div>
        )}

        {hasEmail ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Email: </span>
              <span className="text-sm text-gray-900">{user?.email}</span>
              {emailVerified ? (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  Verified
                </span>
              ) : (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                  Not verified
                </span>
              )}
            </div>

            {!emailVerified && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleSendVerification}
                  disabled={sendingVerification}
                  className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                >
                  {sendingVerification ? "Sending..." : "Resend verification email"}
                </button>
                <button
                  onClick={handleCheckVerification}
                  disabled={checkingVerification}
                  className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 border border-gray-300 rounded hover:bg-gray-200 disabled:opacity-50"
                >
                  {checkingVerification ? "Checking..." : "I've verified my email"}
                </button>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleAddEmail} className="space-y-3">
            <p className="text-sm text-gray-600">
              Add an email address to help recover your account.
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={addingEmail || !email}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingEmail ? "Adding..." : "Add"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* PIN Change Section (only for username+PIN accounts) */}
      {isUsernamePin && (
        <div className="border-t pt-6 mt-6">
          <h2 className="text-lg font-semibold mb-3 text-black">Security</h2>

          {pinSuccess && (
            <div className="mb-3 p-3 bg-green-50 border border-green-200 text-green-600 text-sm rounded">
              PIN changed successfully!
            </div>
          )}

          {!showPinChange ? (
            <button
              onClick={() => setShowPinChange(true)}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 border border-gray-300 rounded hover:bg-gray-200"
            >
              Change PIN
            </button>
          ) : (
            <form onSubmit={handleChangePin} className="space-y-3 max-w-xs">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="\d*"
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter current PIN"
                  maxLength={8}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="\d*"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="4-8 digits"
                  maxLength={8}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm new PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="\d*"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Confirm new PIN"
                  maxLength={8}
                />
              </div>

              {pinError && <div className="text-sm text-red-600">{pinError}</div>}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={changingPin || !currentPin || !newPin || !confirmPin}
                  className="px-4 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 border border-gray-300 rounded hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Linked Providers Section */}
      <div className="border-t pt-6 mt-6">
        <h2 className="text-lg font-semibold mb-3 text-black">Linked Accounts</h2>

        {linkError && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded">
            {linkError}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {hasGoogle ? (
            <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 p-3 rounded">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"
                />
              </svg>
              <span>Google connected</span>
              <span className="ml-auto text-green-600">✓</span>
            </div>
          ) : (
            <button
              onClick={handleLinkGoogle}
              disabled={linkingProvider !== null}
              className="flex items-center gap-2 text-sm text-gray-700 bg-white border border-gray-300 p-3 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"
                />
              </svg>
              {linkingProvider === "google" ? "Connecting..." : "Connect Google"}
            </button>
          )}

          {hasApple ? (
            <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 p-3 rounded">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
                />
              </svg>
              <span>Apple connected</span>
              <span className="ml-auto text-green-600">✓</span>
            </div>
          ) : (
            <button
              onClick={handleLinkApple}
              disabled={linkingProvider !== null}
              className="flex items-center gap-2 text-sm text-gray-700 bg-white border border-gray-300 p-3 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
                />
              </svg>
              {linkingProvider === "apple" ? "Connecting..." : "Connect Apple"}
            </button>
          )}
        </div>

        <p className="text-xs text-gray-500 mt-3">
          Link a social account to sign in more easily and access your account from any device.
        </p>
      </div>
    </div>
  );
}
