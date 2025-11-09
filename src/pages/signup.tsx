import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";

export default function SignupPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [screenName, setScreenName] = useState("");
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function doSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTriedSubmit(true);
    setError(null);

    const errs: Record<string, string> = {};
    if (!username) errs.username = "Username is required";
    const pwErrs = passwordErrors(password);
    if (pwErrs.length) errs.password = pwErrs.join(", ");
    if (email && !isValidEmail(email)) errs.email = "Invalid email";
    if (!screenName) errs.screenName = "Screen name is required";

    setValidationErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      await signUp({ username, password, email: email || undefined, screenName });
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err?.message || "Sign up failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#FFEDD5] via-[#FFF7ED] to-[#FEF3C7] p-6">
      <form
        onSubmit={doSubmit}
        className="max-w-lg w-full p-6 bg-white/90 backdrop-blur rounded-3xl shadow-2xl border-2 border-[#fde68a]"
      >
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-sm text-neutral-800 hover:underline"
          >
            ← Back
          </button>
          <div className="text-xs text-gray-600">Fun and friendly — join the hub!</div>
        </div>

        <div className="flex flex-col items-center mb-6">
          <img
            src="/assets/shared/logo_square.png"
            alt="Games4James"
            className="mb-4 w-40 h-40 object-cover rounded-xl shadow-md border-4 border-white -mb-4"
          />
          <div className="bg-gradient-to-r from-[#ffb86b] to-[#ffd86b] px-4 py-2 rounded-full mt-2 shadow-sm">
            <h2 className="text-2xl font-extrabold tracking-tight text-black leading-none">
              Create account
            </h2>
          </div>
        </div>

        <div className="mb-5 text-sm text-gray-700 p-4 rounded-lg">
          <div className="font-semibold">Why sign up?</div>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>submit your highscores to leaderboards</li>
            <li>select your own avatar</li>
            <li>rate games</li>
            <li>follow your friends</li>
          </ul>
        </div>

        {error && <div className="text-red-600 mb-2">{error}</div>}

        <div className="grid grid-cols-1 gap-4">
          <label className="block">
            <div className="text-sm font-semibold">Username</div>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full mt-1 p-3 border-2 rounded-xl shadow-inner placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
              placeholder="pick a username to login with"
            />
            {triedSubmit && validationErrors.username && (
              <div className="text-red-600 text-sm mt-1">{validationErrors.username}</div>
            )}
          </label>

          <label className="block">
            <div className="text-sm font-semibold">Password</div>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="w-full mt-1 p-3 border-2 rounded-xl shadow-inner placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#60a5fa]"
              placeholder="choose a secure password"
            />
            {triedSubmit && validationErrors.password && (
              <div className="text-red-600 text-sm mt-1">{validationErrors.password}</div>
            )}
            <div className="text-xs text-gray-500 mt-1">
              Password must be at least 6 characters, include 1 lowercase letter and 1 number.
            </div>
          </label>

          <label className="block">
            <div className="text-sm font-semibold">Email (optional)</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1 p-3 border-2 rounded-xl shadow-inner placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#34d399]"
              placeholder="you@example.com"
            />
            {triedSubmit && validationErrors.email && (
              <div className="text-red-600 text-sm mt-1">{validationErrors.email}</div>
            )}
          </label>

          <label className="block">
            <div className="text-sm font-semibold">Screen name</div>
            <input
              value={screenName}
              onChange={(e) => setScreenName(e.target.value)}
              className="w-full mt-1 p-3 border-2 rounded-xl shadow-inner placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f472b6]"
              placeholder="display name for leaderboards"
            />
            {triedSubmit && validationErrors.screenName && (
              <div className="text-red-600 text-sm mt-1">{validationErrors.screenName}</div>
            )}
          </label>
        </div>

        <div className="flex items-center justify-between mt-6">
          <button
            disabled={loading}
            className="px-6 py-3 bg-gradient-to-r from-[#ff7a45] to-[#ffd36b] text-black rounded-full font-semibold shadow-lg disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create account"}
          </button>
          <div className="text-xs text-gray-500">No spam. Play on.</div>
        </div>
      </form>
    </div>
  );
}

// Validation helpers placed after the component to keep component small
function isValidEmail(v: string) {
  if (!v) return false;
  // simple RFC-ish email check
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function passwordErrors(pw: string) {
  const errs: string[] = [];
  if (pw.length < 6) errs.push("at least 6 characters");
  if (!/[a-z]/.test(pw)) errs.push("at least one lowercase letter");
  if (!/[0-9]/.test(pw)) errs.push("at least one number");
  return errs;
}
