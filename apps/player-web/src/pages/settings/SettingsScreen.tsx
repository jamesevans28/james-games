import { useEffect, useState } from "react";
import { checkScreenName, fetchMe, updateSettings, type ScreenNameCheck } from "../../lib/api";
import { useAuth } from "../../context/FirebaseAuthProvider";
import { adapters } from "../../platform/adapters";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { OfflineBanner } from "../../components/OfflineBanner";
import { errorMessage } from "../../utils/errorCode";
import DeleteAccountSection from "./DeleteAccountSection";
import FriendsPrivacySection from "./FriendsPrivacySection";

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
    void (async () => {
      try {
        const data = await fetchMe();
        const u = data.user;
        const sn = u?.screenName || "";
        if (!cancelled) {
          setScreenName(sn);
          setInitial(sn);
        }
      } catch {
        // ignore for now
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = screenName.trim() !== initial.trim() && screenName.trim().length >= 3;
  const [nameCheck, setNameCheck] = useState<ScreenNameCheck | null>(null);

  // Live availability check, debounced, only while the name differs from the saved one.
  useEffect(() => {
    const wanted = screenName.trim();
    if (!dirty) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void checkScreenName(wanted).then((result) => {
        if (!cancelled) setNameCheck(result);
      });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [screenName, dirty]);
  const shownCheck = dirty ? nameCheck : null;
  const nameBlocked = shownCheck?.ok === false;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    if (!adapters.network.isOnline()) {
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
    } catch (e) {
      if (!adapters.network.isOnline()) {
        setError("You're offline. Connect to save changes.");
      } else {
        setError(errorMessage(e, "Failed to update"));
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleLinkGoogle() {
    setLinkError(null);
    if (!adapters.network.isOnline()) {
      setLinkError("You're offline. Connect to link accounts.");
      return;
    }
    setLinkingProvider("google");
    try {
      await linkGoogle();
      await refreshProfile();
    } catch (e) {
      if (!adapters.network.isOnline()) {
        setLinkError("You're offline. Connect to link accounts.");
      } else {
        setLinkError(errorMessage(e, "Failed to link Google account"));
      }
    } finally {
      setLinkingProvider(null);
    }
  }

  async function handleLinkApple() {
    setLinkError(null);
    if (!adapters.network.isOnline()) {
      setLinkError("You're offline. Connect to link accounts.");
      return;
    }
    setLinkingProvider("apple");
    try {
      await linkApple();
      await refreshProfile();
    } catch (e) {
      setLinkError(errorMessage(e, "Failed to link Apple account"));
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
    if (!adapters.network.isOnline()) {
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
    } catch (e) {
      if (!adapters.network.isOnline()) {
        setEmailError("You're offline. Connect to add email.");
      } else {
        setEmailError(errorMessage(e, "Failed to add email"));
      }
    } finally {
      setAddingEmail(false);
    }
  }

  async function handleSendVerification() {
    setEmailError(null);
    setEmailSuccess(null);
    if (!adapters.network.isOnline()) {
      setEmailError("You're offline. Connect to send verification email.");
      return;
    }
    setSendingVerification(true);
    try {
      await sendVerificationEmail();
      setEmailSuccess("Verification email sent! Check your inbox.");
    } catch (e) {
      if (!adapters.network.isOnline()) {
        setEmailError("You're offline. Connect to send verification email.");
      } else {
        setEmailError(errorMessage(e, "Failed to send verification email"));
      }
    } finally {
      setSendingVerification(false);
    }
  }

  async function handleCheckVerification() {
    setEmailError(null);
    setEmailSuccess(null);
    if (!adapters.network.isOnline()) {
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
          "Email not yet verified. Please check your inbox and click the verification link.",
        );
      }
    } catch (e) {
      if (!adapters.network.isOnline()) {
        setEmailError("You're offline. Connect to check verification status.");
      } else {
        setEmailError(errorMessage(e, "Failed to check verification status"));
      }
    } finally {
      setCheckingVerification(false);
    }
  }

  async function handleChangePin(e: React.FormEvent) {
    e.preventDefault();
    setPinError(null);
    setPinSuccess(false);

    if (!adapters.network.isOnline()) {
      setPinError("You're offline. Connect to change PIN.");
      return;
    }

    if (!/^\d{6}$/.test(newPin)) {
      setPinError("New PIN must be 6 digits");
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
    } catch (e) {
      if (!adapters.network.isOnline()) {
        setPinError("You're offline. Connect to change PIN.");
      } else {
        setPinError(errorMessage(e, "Failed to change PIN"));
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
      <h1 className="text-2xl font-bold mb-6 text-ink">Account Settings</h1>

      {/* Offline Banner */}
      {!isOnline && <OfflineBanner className="mb-4" />}

      {/* Screen Name Section */}
      <form
        onSubmit={handleSubmit}
        className="space-y-4 mb-8 p-5 bg-card rounded-2xl border border-line"
      >
        <div>
          <label className="block text-sm font-bold text-ink mb-2">Screen name</label>
          <input
            type="text"
            value={screenName}
            onChange={(e) => {
              setScreenName(e.target.value);
              setNameCheck(null);
            }}
            className="w-full bg-paper-2 border border-line rounded-xl px-4 py-3 text-sm text-ink placeholder-ink-3 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50 transition-all"
            maxLength={16}
            placeholder="Your public name"
            aria-describedby="screen-name-help"
          />
          <p id="screen-name-help" className="mt-2 text-xs text-ink-2" aria-live="polite">
            {shownCheck?.ok === false
              ? shownCheck.message
              : shownCheck?.ok
                ? "✓ That name is free."
                : "3–16 letters, numbers, spaces or dashes. Shown on leaderboards. Don't use your real name."}
          </p>
        </div>
        {error && <div className="text-sm text-grape font-medium">{error}</div>}
        {success && <div className="text-sm text-brand font-medium">✓ Saved!</div>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!dirty || saving || nameBlocked}
            className={`btn ${
              dirty
                ? "btn-primary"
                : "bg-line text-ink-3 cursor-not-allowed rounded-full px-5 py-2.5 text-sm font-bold"
            }`}
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>

      {/* Account Section */}
      <div className="p-5 bg-card rounded-2xl border border-line mb-6">
        <h2 className="text-lg font-bold mb-4 text-ink">Account</h2>

        {/* Account Type Badge */}
        <div className="mb-4">
          <span className="text-sm text-ink-2 font-medium">Account type: </span>
          <span
            className={`text-xs px-3 py-1 rounded-full font-bold ${
              isAnonymous
                ? "bg-sun/20 text-ink border border-sun/50"
                : isUsernamePin
                  ? "bg-sky/20 text-sky border border-sky/30"
                  : "bg-brand/20 text-brand border border-brand/30"
            }`}
          >
            {isAnonymous ? "Guest" : isUsernamePin ? "Username + PIN" : "Linked Account"}
          </span>
        </div>

        {/* Username display for username+PIN accounts */}
        {user?.username && (
          <div className="mb-4">
            <span className="text-sm text-ink-2 font-medium">Username: </span>
            <span className="text-sm font-bold text-ink">{user.username}</span>
          </div>
        )}
      </div>

      {/* Friends & privacy (T7.6) */}
      <FriendsPrivacySection />

      {/* Email Section */}
      <div className="p-5 bg-card rounded-2xl border border-line mb-6">
        <h2 className="text-lg font-bold mb-4 text-ink">Email Address</h2>

        {emailError && (
          <div className="mb-3 p-3 bg-grape/10 border border-grape/30 text-grape text-sm rounded-xl font-medium">
            {emailError}
          </div>
        )}
        {emailSuccess && (
          <div className="mb-3 p-3 bg-brand/10 border border-brand/30 text-brand text-sm rounded-xl font-medium">
            {emailSuccess}
          </div>
        )}

        {hasEmail ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-ink-2 font-medium">Email: </span>
              <span className="text-sm text-ink font-bold">{user?.email}</span>
              {emailVerified ? (
                <span className="text-xs bg-brand/20 text-brand px-2 py-1 rounded-full font-bold border border-brand/30">
                  ✓ Verified
                </span>
              ) : (
                <span className="text-xs bg-sun/20 text-ink px-2 py-1 rounded-full font-bold border border-sun/50">
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
            <p className="text-sm text-ink-2">Add an email address to help recover your account.</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="flex-1 bg-paper-2 border border-line rounded-xl px-4 py-2.5 text-sm text-ink placeholder-ink-3 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50 transition-all"
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
        <div className="p-5 bg-card rounded-2xl border border-line mb-6">
          <h2 className="text-lg font-bold mb-4 text-ink">Security</h2>

          {pinSuccess && (
            <div className="mb-3 p-3 bg-brand/10 border border-brand/30 text-brand text-sm rounded-xl font-medium">
              ✓ PIN changed successfully!
            </div>
          )}

          {!showPinChange ? (
            <button onClick={() => setShowPinChange(true)} className="btn btn-outline text-sm">
              Change PIN
            </button>
          ) : (
            <form onSubmit={handleChangePin} className="space-y-4 max-w-xs">
              <div>
                <label className="block text-sm font-bold text-ink mb-2">Current PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="\d*"
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-full bg-paper-2 border border-line rounded-xl px-4 py-3 text-sm text-ink placeholder-ink-3 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50 transition-all"
                  placeholder="Enter current PIN"
                  maxLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-ink mb-2">New PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="\d*"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-full bg-paper-2 border border-line rounded-xl px-4 py-3 text-sm text-ink placeholder-ink-3 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50 transition-all"
                  placeholder="6 digits"
                  maxLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-ink mb-2">Confirm new PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="\d*"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-full bg-paper-2 border border-line rounded-xl px-4 py-3 text-sm text-ink placeholder-ink-3 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/50 transition-all"
                  placeholder="Confirm new PIN"
                  maxLength={6}
                />
              </div>

              {pinError && <div className="text-sm text-grape font-medium">{pinError}</div>}

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
      <div className="p-5 bg-card rounded-2xl border border-line">
        <h2 className="text-lg font-bold mb-4 text-ink">Linked Accounts</h2>

        {linkError && (
          <div className="mb-3 p-3 bg-grape/10 border border-grape/30 text-grape text-sm rounded-xl font-medium">
            {linkError}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {hasGoogle ? (
            <div className="flex items-center gap-3 text-sm text-ink bg-brand/10 p-4 rounded-xl border border-brand/30">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"
                />
              </svg>
              <span className="font-bold">Google connected</span>
              <span className="ml-auto text-brand font-bold">✓</span>
            </div>
          ) : (
            <button
              onClick={handleLinkGoogle}
              disabled={linkingProvider !== null}
              className="flex items-center gap-3 text-sm text-ink bg-card border border-line p-4 rounded-xl hover:bg-paper-2 hover:border-line disabled:opacity-50 transition-all"
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
            <div className="flex items-center gap-3 text-sm text-ink bg-brand/10 p-4 rounded-xl border border-brand/30">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
                />
              </svg>
              <span className="font-bold">Apple connected</span>
              <span className="ml-auto text-brand font-bold">✓</span>
            </div>
          ) : (
            <button
              onClick={handleLinkApple}
              disabled={linkingProvider !== null}
              className="flex items-center gap-3 text-sm text-ink bg-card border border-line p-4 rounded-xl hover:bg-paper-2 hover:border-line disabled:opacity-50 transition-all"
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

        <p className="text-xs text-ink-2 mt-4">
          Link a social account to sign in more easily and access your account from any device.
        </p>
      </div>

      <DeleteAccountSection />
    </div>
  );
}
