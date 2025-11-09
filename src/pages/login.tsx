import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";

export default function LoginPage() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const doSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signIn({ username, password });
      const params = new URLSearchParams(window.location.search);
      const state = params.get("state") || "/";
      navigate(state);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

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
          <div className="text-xs text-gray-600">Welcome back — pick up where you left off!</div>
        </div>

        <div className="flex flex-col items-center mb-6">
          <img
            src="/assets/shared/logo_square.png"
            alt="Games4James"
            className="w-36 h-36 sm:w-40 sm:h-40 object-cover rounded-xl shadow-md border-4 border-white mb-3"
          />
          <h2 className="text-2xl font-extrabold mt-1">Sign in</h2>
        </div>

        {error && <div className="text-red-600 mb-3">{error}</div>}

        <div className="grid grid-cols-1 gap-4">
          <label className="block">
            <div className="text-sm font-semibold">Username</div>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full mt-1 p-3 border-2 rounded-xl shadow-inner placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f59e0b]"
              placeholder="your username"
            />
          </label>

          <label className="block">
            <div className="text-sm font-semibold">Password</div>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="w-full mt-1 p-3 border-2 rounded-xl shadow-inner placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#60a5fa]"
              placeholder="your password"
            />
          </label>
        </div>

        <div className="flex items-center justify-between mt-6">
          <button
            disabled={loading}
            className="px-6 py-3 bg-gradient-to-r from-[#ff7a45] to-[#ffd36b] text-black rounded-full font-semibold shadow-lg disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <div className="text-xs text-gray-500">
            Need an account?{" "}
            <button
              className="text-sm text-[#f97316] underline"
              type="button"
              onClick={() => navigate("/signup")}
            >
              Create one
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
