const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export async function postHighScore(args: { name: string; gameId: string; score: number }) {
  if (args.name === "JamesTest") return;
  if (!API_BASE) return; // allow front-end to work without backend configured
  const res = await fetch(`${API_BASE}/scores`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    throw new Error(`Failed to submit score: ${res.status}`);
  }
  return res.json();
}

export async function getTopScores(gameId: string, limit = 10) {
  if (!API_BASE) return [] as { name: string; score: number; createdAt?: string }[];
  const url = new URL(`${API_BASE}/scores/${encodeURIComponent(gameId)}`);
  url.searchParams.set("limit", String(limit));
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Failed to load leaderboard: ${res.status}`);
  }
  return (await res.json()) as { name: string; score: number; createdAt?: string }[];
}
