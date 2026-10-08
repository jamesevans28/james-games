import { API_BASE_URL } from "../config/env";
const API_BASE = API_BASE_URL;

// Firebase token getter - set by FirebaseAuthProvider
let getAuthToken: (() => Promise<string | null>) | null = null;

export function setAuthTokenGetter(getter: () => Promise<string | null>) {
  getAuthToken = getter;
}

// Helper to make authenticated API calls with Firebase token
async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);

  // Get Firebase token if available
  if (getAuthToken) {
    const token = await getAuthToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  return fetch(url, {
    ...options,
    headers,
  });
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
  /** Null when they are offline (no presence in the last 2 minutes). */
  presence?: {
    status: PresenceStatus;
    gameId?: string | null;
    /** From the server's games table. */
    gameTitle?: string | null;
    updatedAt: string;
  } | null;
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

/** Body of mutations that only acknowledge success (follow, unfollow, presence, preferences). */
export type OkResponse = { ok: boolean };

/** PATCH /users/settings. `screenName` is the name the server actually assigned. */
export type UpdateSettingsResponse = { ok: boolean; screenName?: string };

/**
 * The signed-in user's own account. GET /me and GET /auth/firebase/me return the
 * same shape (backend userService.CurrentUser), or 404 before the account is registered.
 */
export type MeUser = {
  userId: string;
  username: string | null;
  screenName: string;
  avatar: number;
  accountType: "anonymous" | "username_pin" | "linked";
  email: string | null;
  emailVerified: boolean;
  /** Linked sign-in providers (from the ID token). */
  providers: string[];
  preferences: Record<string, unknown>;
  betaTester: boolean;
  admin: boolean;
  experience: ExperienceSummary;
  streak: { current: number; longest: number; lastDay: string | null };
  createdAt: string;
  updatedAt: string;
};

export type MeResponse = { user: MeUser | null };

/** GET /users/:id: a public profile (whitelisted fields only) plus follow data. */
export interface ProfileResponse {
  profile: {
    userId: string;
    screenName?: string | null;
    avatar?: number | null;
    experience?: ExperienceSummary | null;
    currentStreak?: number;
  };
  followingCount: number;
  followersCount: number;
  following: Array<{ userId: string; screenName?: string | null; avatar?: number | null }>;
  followers: Array<{ userId: string; screenName?: string | null; avatar?: number | null }>;
  recentGames: Array<{
    userId: string;
    gameId: string;
    bestScore?: number;
    lastScore?: number;
    lastPlayedAt?: string;
  }>;
  isSelf: boolean;
  isFollowing: boolean;
}

function emptySummary(gameId: string): RatingSummary {
  return { gameId, avgRating: 0, ratingCount: 0 };
}

export type ScoreSubmissionResult = {
  ok: boolean;
  gameId: string;
  score: number;
  createdAt: string;
  awardedXp: number;
  summary: ExperienceSummary | null;
  /** True when this run beat the player's best for the game. */
  newBest?: boolean;
  /** Present only when the run levelled the player up. */
  newLevel?: number;
  streak?: StreakData & { extended: boolean; isNewStreak: boolean };
};

/**
 * Saves a run. The server awards XP from its own game config and counts today's
 * streak; it gets only the device's UTC offset and decides the date itself.
 */
export async function postHighScore(args: {
  gameId: string;
  score: number;
  durationMs?: number;
}): Promise<ScoreSubmissionResult | undefined> {
  if (!API_BASE) return;
  const tzOffsetMinutes = -new Date().getTimezoneOffset(); // minutes east of UTC
  const res = await fetchWithAuth(`${API_BASE}/scores`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...args, tzOffsetMinutes }),
  });
  if (!res.ok) {
    if (res.status === 401) return; // Not authenticated
    throw new Error(`Failed to submit score: ${res.status}`);
  }
  return (await res.json()) as ScoreSubmissionResult;
}

export async function fetchExperienceSummary(): Promise<ExperienceSummary | null> {
  if (!API_BASE) return null;
  const res = await fetchWithAuth(`${API_BASE}/experience/summary`);
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Failed to load experience summary: ${res.status}`);
  const body = (await res.json()) as { summary?: ExperienceSummary | null };
  return body.summary ?? null;
}

export async function getTopScores(
  gameId: string,
  limit = 10,
  opts?: { scope?: "overall" | "following" },
): Promise<ScoreEntry[]> {
  if (!API_BASE) return [];
  const url = new URL(`${API_BASE}/scores/${encodeURIComponent(gameId)}`);
  url.searchParams.set("limit", String(limit));
  if (opts?.scope === "following") {
    url.searchParams.set("scope", "following");
  }
  const res =
    opts?.scope === "following" ? await fetchWithAuth(url.toString()) : await fetch(url.toString());
  if (res.status === 401) {
    throw new Error("signin_required");
  }
  if (!res.ok) {
    throw new Error(`Failed to load leaderboard: ${res.status}`);
  }
  return (await res.json()) as ScoreEntry[];
}

/** The friendly message from a `{ error, code }` body, or a generic one. */
async function errorFrom(res: Response, fallback: string): Promise<Error> {
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error) return new Error(body.error);
  } catch {
    // not JSON
  }
  return new Error(`${fallback}: ${res.status}`);
}

/** PATCH /me/screen-name (T6.7). Returns the name the server stored. */
export async function updateSettings(data: {
  screenName: string;
}): Promise<UpdateSettingsResponse> {
  if (!API_BASE) return { ok: false };
  const res = await fetchWithAuth(`${API_BASE}/me/screen-name`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw await errorFrom(res, "Failed to update your name");
  return (await res.json()) as UpdateSettingsResponse;
}

export type ScreenNameCheck =
  { ok: true; name: string } | { ok: false; code: string; message: string };

/** Live check for the name field: the server's rules, then whether it's free. */
export async function checkScreenName(name: string): Promise<ScreenNameCheck | null> {
  if (!API_BASE) return null;
  const url = new URL("/users/screen-name/check", API_BASE);
  url.searchParams.set("name", name);
  const res = await fetchWithAuth(url.toString());
  if (!res.ok) return null;
  return (await res.json()) as ScreenNameCheck;
}

// The signed-in user's account; { user: null } when signed out or not registered yet.
export async function fetchMe(): Promise<MeResponse> {
  if (!API_BASE) return { user: null };
  const res = await fetchWithAuth(`${API_BASE}/me`);
  if (res.status === 401 || res.status === 404) return { user: null };
  if (!res.ok) throw new Error(`Failed to load profile: ${res.status}`);
  return (await res.json()) as MeResponse;
}

// Update user preferences (e.g., avatar). Body can include { avatar: number } or { preferences: {...} }
export async function updatePreferences(data: {
  avatar?: number;
  preferences?: Record<string, unknown>;
}): Promise<OkResponse> {
  if (!API_BASE) return { ok: false };
  const res = await fetchWithAuth(`${API_BASE}/users/preferences`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update preferences: ${res.status}`);
  return (await res.json()) as OkResponse;
}

export async function fetchRatingSummary(gameId: string): Promise<RatingSummary> {
  if (!gameId) throw new Error("gameId required");
  if (!API_BASE) return emptySummary(gameId);
  const res = await fetchWithAuth(`${API_BASE}/ratings/${encodeURIComponent(gameId)}`);
  if (!res.ok) throw new Error(`Failed to load rating: ${res.status}`);
  return (await res.json()) as RatingSummary;
}

export async function fetchRatingSummaries(gameIds: string[]): Promise<RatingSummary[]> {
  const ids = Array.from(new Set(gameIds.filter(Boolean)));
  if (!ids.length) return [];
  if (!API_BASE) return ids.map((id) => emptySummary(id));
  const url = new URL(`${API_BASE}/ratings`);
  url.searchParams.set("ids", ids.join(","));
  const res = await fetchWithAuth(url.toString());
  if (!res.ok) throw new Error(`Failed to load ratings: ${res.status}`);
  const body = (await res.json()) as { summaries?: RatingSummary[] };
  if (!body.summaries) return ids.map((id) => emptySummary(id));
  return body.summaries;
}

export async function submitRating(gameId: string, rating: number): Promise<RatingSummary> {
  if (!gameId) throw new Error("gameId required");
  if (!API_BASE) throw new Error("Rating API unavailable");
  const res = await fetchWithAuth(`${API_BASE}/ratings/${encodeURIComponent(gameId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rating }),
  });
  if (res.status === 401) throw new Error("signin_required");
  if (!res.ok) throw new Error(`Failed to submit rating: ${res.status}`);
  return (await res.json()) as RatingSummary;
}

export async function fetchFollowersSummary(): Promise<FollowersSummary> {
  if (!API_BASE) return { following: [], followers: [], followingCount: 0, followersCount: 0 };
  const res = await fetchWithAuth(`${API_BASE}/followers/summary`);
  if (res.status === 401)
    return { following: [], followers: [], followingCount: 0, followersCount: 0 };
  if (!res.ok) throw new Error(`Failed to load followers: ${res.status}`);
  return (await res.json()) as FollowersSummary;
}

export async function followUserApi(targetUserId: string): Promise<OkResponse> {
  if (!API_BASE) return { ok: false };
  const res = await fetchWithAuth(`${API_BASE}/followers/${encodeURIComponent(targetUserId)}`, {
    method: "POST",
  });
  if (res.status === 401) throw new Error("signin_required");
  if (!res.ok) throw new Error(`Failed to follow: ${res.status}`);
  return (await res.json()) as OkResponse;
}

export async function unfollowUserApi(targetUserId: string): Promise<OkResponse> {
  if (!API_BASE) return { ok: false };
  const res = await fetchWithAuth(`${API_BASE}/followers/${encodeURIComponent(targetUserId)}`, {
    method: "DELETE",
  });
  if (res.status === 401) throw new Error("signin_required");
  if (!res.ok) throw new Error(`Failed to unfollow: ${res.status}`);
  return (await res.json()) as OkResponse;
}

/** The server derives the game title from `gameId`; it never accepts a title from the client. */
export async function updatePresenceStatus(payload: {
  status: PresenceStatus;
  gameId?: string;
}): Promise<OkResponse> {
  if (!API_BASE) return { ok: false };
  const res = await fetchWithAuth(`${API_BASE}/followers/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.status === 401) throw new Error("signin_required");
  if (!res.ok) throw new Error(`Failed to update presence: ${res.status}`);
  return (await res.json()) as OkResponse;
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
  const res = await fetchWithAuth(url.toString());
  if (res.status === 401) return { activity: [] };
  if (!res.ok) throw new Error(`Failed to load activity: ${res.status}`);
  return (await res.json()) as { activity: FollowingActivityEntry[] };
}

export async function fetchUserProfile(userId: string): Promise<ProfileResponse | null> {
  if (!API_BASE) return null;
  const res = await fetchWithAuth(`${API_BASE}/users/${encodeURIComponent(userId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load profile: ${res.status}`);
  return (await res.json()) as ProfileResponse;
}

export async function fetchFollowNotifications(): Promise<{ notifications: FollowNotification[] }> {
  if (!API_BASE) return { notifications: [] };
  const res = await fetchWithAuth(`${API_BASE}/followers/notifications`);
  if (res.status === 401) return { notifications: [] };
  if (!res.ok) throw new Error(`Failed to load notifications: ${res.status}`);
  return (await res.json()) as { notifications: FollowNotification[] };
}

// ============================================================================
// Streak API
// ============================================================================

export interface StreakCheckinResponse {
  currentStreak: number;
  longestStreak: number;
  lastLoginDate: string | null;
  extended: boolean;
  isNewStreak: boolean;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastLoginDate: string | null;
}

/**
 * Check in for daily streak. Call this once per day when the app loads.
 * Sends only the device's UTC offset; the server decides the date.
 */
export async function checkinStreak(): Promise<StreakCheckinResponse | null> {
  if (!API_BASE) return null;
  const tzOffsetMinutes = -new Date().getTimezoneOffset(); // minutes east of UTC
  const res = await fetchWithAuth(`${API_BASE}/users/streak/checkin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tzOffsetMinutes }),
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Failed to checkin streak: ${res.status}`);
  return (await res.json()) as StreakCheckinResponse;
}

/**
 * Get current streak data.
 */
export async function fetchStreakData(): Promise<StreakData | null> {
  if (!API_BASE) return null;
  const res = await fetchWithAuth(`${API_BASE}/users/streak`);
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Failed to fetch streak: ${res.status}`);
  return (await res.json()) as StreakData;
}
