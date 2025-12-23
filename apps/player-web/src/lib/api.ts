// NOTE: Vite only auto-loads .env files from the app root (apps/player-web).
// In this repo we also have a root-level .env.local, so we keep a safe dev default.
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";

async function tryRefreshSession(): Promise<boolean> {
  // Refresh token is stored in HttpOnly cookies; we can't inspect it client-side.
  // The safest way to detect availability is to call /auth/refresh.
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export type RatingSummary = {
  gameId: string;
  avgRating: number;
  ratingCount: number;
  userRating?: number;
  updatedAt?: string;
};

export type ExperienceSummary = {
  level: number;
  progress: number;
  required: number;
  percent: number;
  remaining: number;
  total: number;
  lastUpdated?: string;
};

export type PresenceStatus =
  | "looking_for_game"
  | "home"
  | "browsing_high_scores"
  | "browsing_leaderboard"
  | "game_lobby"
  | "playing"
  | "in_score_dialog";

export type FollowingActivityEntry = {
  userId: string;
  targetUserId: string;
  targetScreenName?: string | null;
  targetAvatar?: number | null;
  createdAt?: string;
  presence?: {
    status: PresenceStatus;
    gameId?: string;
    gameTitle?: string;
    updatedAt: string;
  };
};

export type FollowingSummaryEntry = {
  userId: string;
  screenName?: string | null;
  avatar?: number | null;
  targetUserId?: string;
  targetScreenName?: string | null;
  targetAvatar?: number | null;
  createdAt?: string;
  level?: number | null;
  presence?: FollowingActivityEntry["presence"];
  lastOnline?: string | null;
};

export type FollowersSummary = {
  following: FollowingSummaryEntry[];
  followers: Array<{
    userId: string;
    screenName?: string | null;
    avatar?: number | null;
    createdAt: string;
    level?: number | null;
  }>;
  followingCount: number;
  followersCount: number;
};

export type ScoreEntry = {
  userId?: string;
  screenName: string;
  avatar: number;
  score: number;
  createdAt?: string;
  level?: number | null;
};

export type FollowNotification = {
  userId: string;
  screenName?: string | null;
  avatar?: number | null;
  createdAt: string;
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
    // If access token expired but refresh token cookie exists, refresh and retry once.
    if (res.status === 401) {
      const refreshed = await tryRefreshSession();
      if (!refreshed) return;

      const retryRes = await fetch(`${API_BASE}/scores`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-auth-retry": "1" },
        credentials: "include",
        body: JSON.stringify(args),
      });
      if (!retryRes.ok) {
        if (retryRes.status === 401) return;
        throw new Error(`Failed to submit score: ${retryRes.status}`);
      }
      return retryRes.json();
    }
    throw new Error(`Failed to submit score: ${res.status}`);
  }
  return res.json();
}

export async function postExperienceRun(args: {
  gameId: string;
  score: number;
  xpMultiplier?: number;
}) {
  if (!API_BASE) return { awardedXp: 0, summary: null } as any;
  const res = await fetch(`${API_BASE}/experience/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(args),
  });
  if (res.status === 401) {
    const refreshed = await tryRefreshSession();
    if (!refreshed) throw new Error("signin_required");

    const retryRes = await fetch(`${API_BASE}/experience/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-auth-retry": "1" },
      credentials: "include",
      body: JSON.stringify(args),
    });
    if (retryRes.status === 401) throw new Error("signin_required");
    if (!retryRes.ok) throw new Error(`Failed to award experience: ${retryRes.status}`);
    return (await retryRes.json()) as { awardedXp: number; summary: ExperienceSummary };
  }
  if (!res.ok) throw new Error(`Failed to award experience: ${res.status}`);
  return (await res.json()) as { awardedXp: number; summary: ExperienceSummary };
}

export async function fetchExperienceSummary(): Promise<ExperienceSummary | null> {
  if (!API_BASE) return null;
  const res = await fetch(`${API_BASE}/experience/summary`, {
    credentials: "include",
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Failed to load experience summary: ${res.status}`);
  const body = (await res.json()) as { summary?: ExperienceSummary | null };
  return body.summary ?? null;
}

export async function getTopScores(
  gameId: string,
  limit = 10,
  opts?: { scope?: "overall" | "following" }
): Promise<ScoreEntry[]> {
  if (!API_BASE) return [];
  const url = new URL(`${API_BASE}/scores/${encodeURIComponent(gameId)}`);
  url.searchParams.set("limit", String(limit));
  if (opts?.scope === "following") {
    url.searchParams.set("scope", "following");
  }
  const res = await fetch(url.toString(), {
    credentials: opts?.scope === "following" ? "include" : undefined,
  });
  if (res.status === 401) {
    throw new Error("signin_required");
  }
  if (!res.ok) {
    throw new Error(`Failed to load leaderboard: ${res.status}`);
  }
  return (await res.json()) as ScoreEntry[];
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

export async function fetchFollowersSummary(): Promise<FollowersSummary> {
  if (!API_BASE) return { following: [], followers: [], followingCount: 0, followersCount: 0 };
  const res = await fetch(`${API_BASE}/followers/summary`, { credentials: "include" });
  if (res.status === 401)
    return { following: [], followers: [], followingCount: 0, followersCount: 0 };
  if (!res.ok) throw new Error(`Failed to load followers: ${res.status}`);
  return (await res.json()) as FollowersSummary;
}

export async function followUserApi(targetUserId: string) {
  if (!API_BASE) return { ok: false } as any;
  const res = await fetch(`${API_BASE}/followers/${encodeURIComponent(targetUserId)}`, {
    method: "POST",
    credentials: "include",
  });
  if (res.status === 401) throw new Error("signin_required");
  if (!res.ok) throw new Error(`Failed to follow: ${res.status}`);
  return res.json();
}

export async function unfollowUserApi(targetUserId: string) {
  if (!API_BASE) return { ok: false } as any;
  const res = await fetch(`${API_BASE}/followers/${encodeURIComponent(targetUserId)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (res.status === 401) throw new Error("signin_required");
  if (!res.ok) throw new Error(`Failed to unfollow: ${res.status}`);
  return res.json();
}

export async function updatePresenceStatus(payload: {
  status: PresenceStatus;
  gameId?: string;
  gameTitle?: string;
}) {
  if (!API_BASE) return { ok: false } as any;
  const res = await fetch(`${API_BASE}/followers/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (res.status === 401) throw new Error("signin_required");
  if (!res.ok) throw new Error(`Failed to update presence: ${res.status}`);
  return res.json();
}

export async function fetchFollowingActivity(args: {
  gameId?: string;
  statuses?: PresenceStatus[];
}): Promise<{ activity: FollowingActivityEntry[] }> {
  if (!API_BASE) return { activity: [] };
  const url = new URL(`${API_BASE}/followers/activity`);
  if (args.gameId) url.searchParams.set("gameId", args.gameId);
  if (args.statuses && args.statuses.length) {
    url.searchParams.set("status", args.statuses.join(","));
  }
  const res = await fetch(url.toString(), { credentials: "include" });
  if (res.status === 401) return { activity: [] };
  if (!res.ok) throw new Error(`Failed to load activity: ${res.status}`);
  return (await res.json()) as { activity: FollowingActivityEntry[] };
}

export async function fetchUserProfile(userId: string) {
  if (!API_BASE) return null;
  const res = await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}`, {
    credentials: "include",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load profile: ${res.status}`);
  return res.json();
}

export async function fetchFollowNotifications(): Promise<{ notifications: FollowNotification[] }> {
  if (!API_BASE) return { notifications: [] };
  const res = await fetch(`${API_BASE}/followers/notifications`, { credentials: "include" });
  if (res.status === 401) return { notifications: [] };
  if (!res.ok) throw new Error(`Failed to load notifications: ${res.status}`);
  return (await res.json()) as { notifications: FollowNotification[] };
}
