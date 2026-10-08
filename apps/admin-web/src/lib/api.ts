const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";

import { auth } from "./firebase";

type RequestOptions = RequestInit & { skipJson?: boolean };

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  // Get Firebase token if available
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options,
  });

  if (!res.ok) {
    let body: { error?: string } | undefined;
    try {
      body = (await res.json()) as { error?: string };
    } catch {
      // non-JSON error body: fall back to the status text
    }
    throw new ApiError(res.status, body?.error || res.statusText, body);
  }

  if (options.skipJson || res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export type AdminAccount = {
  userId: string;
  username?: string | null;
  screenName?: string | null;
  email?: string | null;
  emailProvided?: boolean;
  betaTester?: boolean;
  admin?: boolean;
  validated?: boolean;
};

export type AdminUserSummary = AdminAccount & {
  accountType?: string;
  enabled?: boolean;
  disabledAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastSeenAt?: string | null;
};

export type AdminUserDetail = AdminUserSummary & {
  emailVerified?: boolean;
  avatar?: number;
  xp?: { total: number; level: number; progress: number };
  streak?: { current: number; longest: number };
  gameStats?: Array<{
    gameId: string;
    title: string;
    plays: number;
    bestScore: number;
    lastScore: number;
    lastPlayedAt: string;
  }>;
  recentPlays?: Array<{
    playId: string;
    gameId: string;
    title: string;
    score: number;
    durationMs: number | null;
    xpAwarded: number;
    createdAt: string;
  }>;
};

export type PaginatedResponse<T> = {
  items: T[];
  nextCursor?: string;
};

/** Seeded from the game manifests on deploy; admins edit only `metadata`. */
export type GameConfig = {
  gameId: string;
  title: string;
  description: string | null;
  status: "active" | "beta" | "inactive";
  betaOnly: boolean;
  xpMultiplier: number;
  maxScore: number;
  maxScorePerSecond: number;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type DashboardMetrics = {
  timeframe: { since: string; days: number };
  totals: {
    users: number;
    betaTesters: number;
    admins: number;
    disabled: number;
    newUsers7d: number;
    gamesLive: number;
  };
  activity: {
    activeUsers7d: number;
    totalPlays7d: number;
    avgScore7d: number;
  };
  daily: Array<{ day: string; plays: number; activeUsers: number; newUsers: number }>;
  topGames: Array<{
    gameId: string;
    title: string;
    thumbnail?: string | null;
    plays7d: number;
    share: number;
  }>;
  recommendations: string[];
};

export type GameStats = {
  gameId: string;
  totalPlays: number;
  averageScore: number;
  uniquePlayers: number;
  weeklyBreakdown: Array<{
    start: string;
    end: string;
    label: string;
    count: number;
  }>;
  since: string;
};

export type NameChange = {
  userId: string;
  oldName: string;
  newName: string;
  currentName: string;
  changedAt: string;
};

export const adminApi = {
  /** GET /me: `{ user }`, the same shape as the player app's (backend userService.CurrentUser). */
  fetchMe: () => request<{ user: AdminAccount | null }>("/me", { method: "GET" }),
  listUsers: (params: { cursor?: string; search?: string; limit?: number }) => {
    const url = new URL(`${API_BASE}/admin/users`);
    if (params.cursor) url.searchParams.set("cursor", params.cursor);
    if (params.search) url.searchParams.set("search", params.search);
    if (params.limit) url.searchParams.set("limit", String(params.limit));
    return request<PaginatedResponse<AdminUserSummary>>(url.pathname + url.search, {
      method: "GET",
    });
  },
  getUser: (userId: string) => request<AdminUserDetail>(`/admin/users/${userId}`),
  updateUser: (userId: string, payload: { betaTester?: boolean; admin?: boolean }) =>
    request<AdminUserDetail>(`/admin/users/${userId}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  resetScreenName: (userId: string) =>
    request<AdminUserDetail>(`/admin/users/${userId}/reset-screen-name`, { method: "POST" }),
  setUserEnabled: (userId: string, enabled: boolean) =>
    request<AdminUserDetail>(`/admin/users/${userId}/${enabled ? "enable" : "disable"}`, {
      method: "POST",
    }),
  deletePlay: (playId: string) =>
    request<{ deleted: boolean; bestScore: number | null }>(`/admin/plays/${playId}`, {
      method: "DELETE",
    }),
  listGames: (params: { cursor?: string; limit?: number }) => {
    const url = new URL(`${API_BASE}/admin/games`);
    if (params.cursor) url.searchParams.set("cursor", params.cursor);
    if (params.limit) url.searchParams.set("limit", String(params.limit));
    return request<PaginatedResponse<GameConfig>>(url.pathname + url.search, { method: "GET" });
  },
  getGame: (gameId: string) => request<GameConfig>(`/admin/games/${gameId}`),
  getGameStats: (gameId: string) => request<GameStats>(`/admin/games/${gameId}/stats`),
  updateGameMetadata: (gameId: string, metadata: Record<string, unknown> | null) =>
    request<GameConfig>(`/admin/games/${gameId}`, {
      method: "PATCH",
      body: JSON.stringify({ metadata }),
    }),
  getDashboardMetrics: () => request<DashboardMetrics>(`/admin/metrics/dashboard`),
  /** Latest screen-name changes, newest first (T6.7 moderation). */
  listNameChanges: (limit = 50) =>
    request<{ items: NameChange[] }>(`/admin/screen-names?limit=${limit}`, { method: "GET" }),
  resetUserPin: (userId: string, newPin: string) =>
    request<{ success: boolean; message: string }>(`/auth/firebase/admin/reset-pin`, {
      method: "POST",
      body: JSON.stringify({ userId, newPin }),
    }),
};

export function normalizeAccount(payload: { user: AdminAccount | null } | null | undefined) {
  const account = payload?.user;
  if (!account?.userId) return null;
  return account;
}
