import { useEffect, useMemo, useState } from "react";
import { fetchMe, updateSettings } from "../../lib/api";
import { useLocation } from "react-router-dom";

export default function SettingsScreen() {
  const [screenName, setScreenName] = useState("");
  const [initial, setInitial] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const location = useLocation();
  const mustValidate = useMemo(() => {
    const s = (location.state as any) || {};
    return s?.reason === "email_required";
  }, [location.state]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchMe();
        const sn = data?.user?.screenName || "";
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
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);
      const res = await updateSettings({ screenName: screenName.trim() });
      setInitial(res.screenName || screenName.trim());
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (e: any) {
      setError(e?.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 text-black">Settings</h1>
      {mustValidate && (
        <div className="mb-4 p-3 border border-yellow-200 bg-yellow-50 text-yellow-800 text-sm rounded">
          You must have a valid email to access that page. Please set and verify your email below.
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
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
    </div>
  );
}
