const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export type RatingSummary = {
  gameId: string;
  avgRating: number;
  ratingCount: number;
  userRating?: number;
  updatedAt?: string;
};

function emptySummary(gameId: string): RatingSummary {
  return { gameId, avgRating: 0, ratingCount: 0 };
}

export async function postHighScore(args: { gameId: string; score: number }) {
  if (!API_BASE) return; // allow front-end to work without backend configured
  const res = await fetch(`${API_BASE}/scores`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    // Surface 401 as a no-op for unauthenticated users — they simply won't post
    if (res.status === 401) return;
    throw new Error(`Failed to submit score: ${res.status}`);
  }
  return res.json();
}

export async function getTopScores(gameId: string, limit = 10) {
  if (!API_BASE)
    return [] as { screenName: string; avatar: number; score: number; createdAt?: string }[];
  const url = new URL(`${API_BASE}/scores/${encodeURIComponent(gameId)}`);
  url.searchParams.set("limit", String(limit));
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Failed to load leaderboard: ${res.status}`);
  }
  return (await res.json()) as {
    screenName: string;
    avatar: number;
    score: number;
    createdAt?: string;
  }[];
}

// Update user settings (currently only screenName). Returns { ok, screenName }.
export async function updateSettings(data: { screenName: string }) {
  if (!API_BASE) return { ok: false } as any;
  const res = await fetch(`${API_BASE}/users/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update settings: ${res.status}`);
  return res.json();
}

// Fetch current user profile including screenName.
export async function fetchMe() {
  if (!API_BASE) return { user: null };
  const res = await fetch(`${API_BASE}/me`, { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to load profile: ${res.status}`);
  return res.json();
}

export async function startEmailUpdate(email: string) {
  if (!API_BASE) return { ok: false } as any;
  const res = await fetch(`${API_BASE}/users/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(`Failed to start email update: ${res.status}`);
  return res.json();
}

export async function verifyEmail(code: string) {
  if (!API_BASE) return { ok: false } as any;
  const res = await fetch(`${API_BASE}/users/email/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error(`Email verification failed: ${res.status}`);
  return res.json();
}

// Update user preferences (e.g., avatar). Body can include { avatar: number } or { preferences: {...} }
export async function updatePreferences(data: Record<string, any>) {
  if (!API_BASE) return { ok: false } as any;
  const res = await fetch(`${API_BASE}/users/preferences`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update preferences: ${res.status}`);
  return res.json();
}

export async function fetchRatingSummary(gameId: string): Promise<RatingSummary> {
  if (!gameId) throw new Error("gameId required");
  if (!API_BASE) return emptySummary(gameId);
  const res = await fetch(`${API_BASE}/ratings/${encodeURIComponent(gameId)}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Failed to load rating: ${res.status}`);
  return (await res.json()) as RatingSummary;
}

export async function fetchRatingSummaries(gameIds: string[]): Promise<RatingSummary[]> {
  const ids = Array.from(new Set(gameIds.filter(Boolean)));
  if (!ids.length) return [];
  if (!API_BASE) return ids.map((id) => emptySummary(id));
  const url = new URL(`${API_BASE}/ratings`);
  url.searchParams.set("ids", ids.join(","));
  const res = await fetch(url.toString(), { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to load ratings: ${res.status}`);
  const body = (await res.json()) as { summaries?: RatingSummary[] };
  if (!body.summaries) return ids.map((id) => emptySummary(id));
  return body.summaries;
}

export async function submitRating(gameId: string, rating: number): Promise<RatingSummary> {
  if (!gameId) throw new Error("gameId required");
  if (!API_BASE) throw new Error("Rating API unavailable");
  const res = await fetch(`${API_BASE}/ratings/${encodeURIComponent(gameId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ rating }),
  });
  if (res.status === 401) throw new Error("signin_required");
  if (!res.ok) throw new Error(`Failed to submit rating: ${res.status}`);
  return (await res.json()) as RatingSummary;
}
