import { API_BASE_URL } from "../config/env";
import { ApiError, apiErrorFrom } from "./apiError";
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

/**
 * What a page reports to usePresenceReporter. Only "online" ever reaches friends
 * (T7.6); the status itself is not sent.
 */
export type PresenceStatus =
  | "looking_for_game"
  | "home"
  | "browsing_high_scores"
  | "browsing_leaderboard"
  | "game_lobby"
  | "playing"
  | "in_score_dialog";

/** A friend (T7.6): accepted both ways. `online` only when they chose to share it. */
export type Friend = {
  userId: string;
  screenName: string;
  avatar: number;
  level: number;
  online: boolean;
  friendsSince: string;
};

/** A pending friend request, either way. */
export type FriendRequest = {
  userId: string;
  screenName: string;
  avatar: number;
  level: number;
  createdAt: string;
};

export type BlockedPlayer = { userId: string; screenName: string; avatar: number };

/** GET /followers/summary: everything the friends page shows. */
export type FriendsSummary = {
  /** Your own code, to share. */
  friendCode: string;
  friends: Friend[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
  blocked: BlockedPlayer[];
};

export type FriendRequests = { incoming: FriendRequest[]; outgoing: FriendRequest[] };

export type ScoreEntry = {
  userId?: string;
  screenName: string;
  avatar: number;
  score: number;
  createdAt?: string;
  level?: number | null;
};

/** Body of mutations that only acknowledge success (friends, preferences). */
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

/** How the viewer and a profile's player are connected. */
export type Friendship = "self" | "friends" | "request_sent" | "request_received" | "none";

/**
 * GET /users/:id (T7.6): screen name, avatar, level and stickers. No friend lists,
 * counts or last-seen. 404 when either player has blocked the other.
 */
export interface ProfileResponse {
  profile: { userId: string; screenName: string; avatar: number; level: number };
  /** Sticker ids, newest first (max 20). */
  stickers: string[];
  isSelf: boolean;
  friendship: Friendship;
  /** Only when you are friends. */
  friendsSince: string | null;
  /** Only on your own profile. */
  friendCode?: string;
}

function emptySummary(gameId: string): RatingSummary {
  return { gameId, avgRating: 0, ratingCount: 0 };
}

export type EarnedSticker = { id: string; kind: "weekly" | "achievement" };

export type ScoreSubmissionResult = {
  ok: boolean;
  gameId: string;
  /** The saved play, for its share link (T11.5). Missing from older servers. */
  playId?: string;
  score: number;
  createdAt: string;
  awardedXp: number;
  summary: ExperienceSummary | null;
  /** True when this run beat the player's best for the game. */
  newBest?: boolean;
  /** Present only when the run levelled the player up. */
  newLevel?: number;
  streak?: StreakData & { extended: boolean; isNewStreak: boolean };
  /** The first sticker this run collected (T7.5); read `stickersEarned` instead. */
  stickerEarned?: EarnedSticker;
  /** Every sticker this run collected, the weekly one first (T11.4). */
  stickersEarned?: EarnedSticker[];
  /** Only for a run sent as today's challenge: whether it was the day's scored run (T11.3). */
  daily?: { day: string; counted: boolean };
  /** True when the server had already saved this play id (an offline-queue resend). */
  duplicate?: boolean;
};

const scoreSavedListeners = new Set<(result: ScoreSubmissionResult) => void>();

/**
 * Called after every saved run, whoever posted it (main.tsx uses it to refresh
 * leaderboards, ratings and the profile). Returns an unsubscribe function.
 */
export function onScoreSaved(fn: (result: ScoreSubmissionResult) => void): () => void {
  scoreSavedListeners.add(fn);
  return () => scoreSavedListeners.delete(fn);
}

/**
 * Saves a run. The server awards XP from its own game config and counts today's
 * streak; it gets only the device's UTC offset and decides the date itself.
 */
export async function postHighScore(args: {
  gameId: string;
  score: number;
  durationMs?: number;
  /** Idempotency key for the offline queue (T10.4). */
  playId?: string;
  /** Kept from when the run was played, for queued resends. */
  tzOffsetMinutes?: number;
  /** Played as today's challenge (T11.3); the server decides whether it counts. */
  daily?: boolean;
  /** The saved remix the run was played on (T11.2); its own board, not the game's. */
  remixId?: string;
}): Promise<ScoreSubmissionResult | undefined> {
  if (!API_BASE) return;
  const tzOffsetMinutes = args.tzOffsetMinutes ?? -new Date().getTimezoneOffset(); // minutes east of UTC
  const res = await fetchWithAuth(`${API_BASE}/scores`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...args, tzOffsetMinutes }),
  });
  if (!res.ok) {
    if (res.status === 401) return; // Not authenticated
    throw await apiErrorFrom(res, "Failed to submit score");
  }
  const result = (await res.json()) as ScoreSubmissionResult;
  scoreSavedListeners.forEach((fn) => fn(result));
  return result;
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
  if (!res.ok) throw await apiErrorFrom(res, "Failed to load leaderboard");
  return (await res.json()) as ScoreEntry[];
}

/** The friendly message from a `{ error, code }` body, or a generic one. */
async function errorFrom(res: Response, fallback: string): Promise<ApiError> {
  return apiErrorFrom(res, fallback);
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
  if (!res.ok) throw await apiErrorFrom(res, "Failed to load rating");
  return (await res.json()) as RatingSummary;
}

export async function fetchRatingSummaries(gameIds: string[]): Promise<RatingSummary[]> {
  const ids = Array.from(new Set(gameIds.filter(Boolean)));
  if (!ids.length) return [];
  if (!API_BASE) return ids.map((id) => emptySummary(id));
  const url = new URL(`${API_BASE}/ratings`);
  url.searchParams.set("ids", ids.join(","));
  const res = await fetchWithAuth(url.toString());
  if (!res.ok) throw await apiErrorFrom(res, "Failed to load ratings");
  const body = (await res.json()) as { summaries?: RatingSummary[] };
  if (!body.summaries) return ids.map((id) => emptySummary(id));
  return body.summaries;
}

export async function submitRating(gameId: string, rating: number): Promise<RatingSummary> {
  if (!gameId) throw new Error("gameId required");
  if (!API_BASE) throw new ApiError(0, "api_unavailable", "Rating API unavailable");
  const res = await fetchWithAuth(`${API_BASE}/ratings/${encodeURIComponent(gameId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rating }),
  });
  if (!res.ok) throw await apiErrorFrom(res, "Failed to submit rating");
  return (await res.json()) as RatingSummary;
}

// ============================================================================
// Friends (T7.6). Errors are ApiErrors whose message is the server's code
// (for example "code_not_found"); utils/friends.ts turns them into kind words.
// ============================================================================

const EMPTY_FRIENDS: FriendsSummary = {
  friendCode: "",
  friends: [],
  incoming: [],
  outgoing: [],
  blocked: [],
};

export async function fetchFriendsSummary(): Promise<FriendsSummary> {
  if (!API_BASE) return EMPTY_FRIENDS;
  const res = await fetchWithAuth(`${API_BASE}/followers/summary`);
  if (!res.ok) throw await apiErrorFrom(res, "Failed to load friends");
  return (await res.json()) as FriendsSummary;
}

export async function fetchFriendRequests(): Promise<FriendRequests> {
  if (!API_BASE) return { incoming: [], outgoing: [] };
  const res = await fetchWithAuth(`${API_BASE}/followers/requests`);
  if (res.status === 401) return { incoming: [], outgoing: [] };
  if (!res.ok) throw await apiErrorFrom(res, "Failed to load friend requests");
  return (await res.json()) as FriendRequests;
}

async function friendsCall<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!API_BASE) throw new ApiError(0, "api_unavailable", "api_unavailable");
  const res = await fetchWithAuth(`${API_BASE}/followers${path}`, {
    method,
    ...(body === undefined
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  if (!res.ok) throw await apiErrorFrom(res, "Friends request failed");
  return (await res.json()) as T;
}

/** Sends a request to the player with this code ("friends" when they had already asked you). */
export function sendFriendRequest(
  friendCode: string,
): Promise<{ ok: boolean; status: "pending" | "friends" }> {
  return friendsCall("POST", "/request", { friendCode });
}

export function acceptFriendRequest(userId: string): Promise<OkResponse> {
  return friendsCall("POST", `/requests/${encodeURIComponent(userId)}/accept`);
}

/** Declines their request, or cancels yours. */
export function declineFriendRequest(userId: string): Promise<OkResponse> {
  return friendsCall("DELETE", `/requests/${encodeURIComponent(userId)}`);
}

export function removeFriend(userId: string): Promise<OkResponse> {
  return friendsCall("DELETE", `/friends/${encodeURIComponent(userId)}`);
}

export function blockPlayer(userId: string): Promise<OkResponse> {
  return friendsCall("POST", `/block/${encodeURIComponent(userId)}`);
}

export function unblockPlayer(userId: string): Promise<OkResponse> {
  return friendsCall("DELETE", `/block/${encodeURIComponent(userId)}`);
}

/**
 * Tells the server you're online. It stores this only if you switched on
 * "Show friends when I'm online"; no game or activity is ever sent.
 */
export async function reportPresence(): Promise<void> {
  if (!API_BASE) return;
  const res = await fetchWithAuth(`${API_BASE}/followers/status`, { method: "POST" });
  if (!res.ok) throw await apiErrorFrom(res, "Failed to update presence");
}

/** The game a shared score was played on (T11.5), or null when the link has no card. */
export async function fetchSharedPlay(playId: string): Promise<{ gameId: string } | null> {
  if (!API_BASE) return null;
  const res = await fetch(`${API_BASE}/share/${encodeURIComponent(playId)}.json`);
  if (res.status === 404) return null;
  if (!res.ok) throw await apiErrorFrom(res, "Failed to load shared score");
  return (await res.json()) as { gameId: string };
}

/** A public profile, or null when there is no such player (or a block between you). */
export async function fetchUserProfile(userId: string): Promise<ProfileResponse | null> {
  if (!API_BASE) return null;
  const res = await fetchWithAuth(`${API_BASE}/users/${encodeURIComponent(userId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw await apiErrorFrom(res, "Failed to load profile");
  return (await res.json()) as ProfileResponse;
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

// ============================================================================
// Daily challenge (T11.3)
// ============================================================================

export type DailyBoardEntry = {
  userId: string;
  screenName: string;
  avatar: number;
  level: number;
  score: number;
};

export type DailyChallenge = {
  /** The player's local day (YYYY-MM-DD). */
  day: string;
  gameId: string | null;
  seed: number;
  /** Your scored run today, when signed in and played. */
  myRun?: { score: number };
  board: DailyBoardEntry[];
};

/** GET /daily: today's game and board for this device's day. Null without an API. */
export async function fetchDaily(): Promise<DailyChallenge | null> {
  if (!API_BASE) return null;
  const tz = -new Date().getTimezoneOffset(); // minutes east of UTC
  const res = await fetchWithAuth(`${API_BASE}/daily?tz=${tz}`);
  if (!res.ok) throw await apiErrorFrom(res, "Failed to load today's challenge");
  return (await res.json()) as DailyChallenge;
}

// ============================================================================
// Stickers (T7.5)
// ============================================================================

export type CollectedSticker = { id: string; earnedAt: string };

/** GET /users/stickers: the signed-in player's stickers, newest first. */
export async function fetchMyStickers(): Promise<CollectedSticker[]> {
  if (!API_BASE) return [];
  const res = await fetchWithAuth(`${API_BASE}/users/stickers`);
  if (res.status === 401) return [];
  if (!res.ok) throw new Error(`Failed to load stickers: ${res.status}`);
  const body = (await res.json()) as { stickers?: CollectedSticker[] };
  return body.stickers ?? [];
}

// ============================================================================
// Family (T11.7): a grown-up links to a kid's account with a code
// ============================================================================

export type FamilyMember = { userId: string; screenName: string; avatar: number };
export type FamilyDay = { day: string; plays: number; playMs: number };
export type FamilyKid = FamilyMember & {
  linkedAt: string;
  /** The last 7 days in the viewer's time zone, oldest first. */
  days: FamilyDay[];
  totalPlays: number;
  totalPlayMs: number;
};
export type FamilySummary = {
  kids: FamilyKid[];
  grownUps: (FamilyMember & { linkedAt: string })[];
};

async function familyCall<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!API_BASE) throw new ApiError(0, "api_unavailable", "api_unavailable");
  const res = await fetchWithAuth(`${API_BASE}/family${path}`, {
    method,
    ...(body === undefined
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  // The server's `{ error }` code (e.g. code_expired) becomes the ApiError message.
  if (!res.ok) throw await apiErrorFrom(res, "Family request failed");
  return (await res.json()) as T;
}

/** GET /family: your kids' last 7 days (in this device's time zone) and your grown-ups. */
export function fetchFamily(): Promise<FamilySummary> {
  const tzOffsetMinutes = -new Date().getTimezoneOffset(); // minutes east of UTC
  return familyCall("GET", `?tzOffsetMinutes=${tzOffsetMinutes}`);
}

/** A grown-up's 6-character code, valid 15 minutes; making a new one cancels the old. */
export function createFamilyCode(): Promise<{ code: string; expiresAt: string }> {
  return familyCall("POST", "/codes");
}

/** The kid's account joins the grown-up who made this code. */
export function joinFamily(code: string): Promise<{ grownUp: FamilyMember }> {
  return familyCall("POST", "/join", { code });
}

export function unlinkFamilyKid(childId: string): Promise<{ ok: true }> {
  return familyCall("DELETE", `/kids/${encodeURIComponent(childId)}`);
}

// ============================================================================
// Remixes (T11.2): a game with its knobs turned, saved and shared by link
// ============================================================================

export type Remix = {
  id: string;
  gameId: string;
  name: string;
  knobs: Record<string, number>;
  createdAt: string;
  /** The maker's public name (null on your own just-saved remix and your list). */
  owner: { screenName: string; avatar: number } | null;
  isMine: boolean;
};

/** GET /remixes/:id (public, for shared links); null when there's no such remix. */
export async function fetchRemix(id: string): Promise<Remix | null> {
  if (!API_BASE) return null;
  const res = await fetchWithAuth(`${API_BASE}/remixes/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw await apiErrorFrom(res, "Failed to load remix");
  return ((await res.json()) as { remix: Remix }).remix;
}

/** POST /remixes (registered accounts). Throws an ApiError with a friendly message. */
export async function saveRemix(body: {
  gameId: string;
  name: string;
  knobs: Record<string, number>;
}): Promise<Remix> {
  if (!API_BASE) throw new ApiError(0, "api_unavailable", "Saving remixes needs the internet.");
  const res = await fetchWithAuth(`${API_BASE}/remixes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await apiErrorFrom(res, "Couldn't save your remix");
  return ((await res.json()) as { remix: Remix }).remix;
}

/** GET /remixes/mine?gameId=: your own remixes, newest first. */
export async function fetchMyRemixes(gameId: string): Promise<Remix[]> {
  if (!API_BASE) return [];
  const res = await fetchWithAuth(`${API_BASE}/remixes/mine?gameId=${encodeURIComponent(gameId)}`);
  if (!res.ok) throw await apiErrorFrom(res, "Failed to load your remixes");
  return ((await res.json()) as { remixes: Remix[] }).remixes;
}

/** GET /remixes/:id/scores: best per player on a remix, same rows as a game's board. */
export async function getRemixScores(remixId: string, limit = 10): Promise<ScoreEntry[]> {
  if (!API_BASE) return [];
  const res = await fetch(
    `${API_BASE}/remixes/${encodeURIComponent(remixId)}/scores?limit=${limit}`,
  );
  if (!res.ok) throw await apiErrorFrom(res, "Failed to load the remix board");
  return (await res.json()) as ScoreEntry[];
}
