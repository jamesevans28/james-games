const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";

import { auth } from "./firebase";

type RequestOptions = RequestInit & { skipJson?: boolean };

export class ApiError extends Error {
  status: number;
  body: any;
  constructor(status: number, message: string, body?: any) {
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
    credentials: "include",
    headers,
    ...options,
  });

  if (!res.ok) {
    let body: any;
    try {
      body = await res.json();
    } catch (err) {
      /* swallow */
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
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type AdminUserDetail = AdminUserSummary & {
  emailVerified?: boolean;
  status?: string;
  enabled?: boolean;
  cognitoUsername?: string;
};

export type PaginatedResponse<T> = {
  items: T[];
  nextCursor?: string;
};

export type GameConfig = {
  gameId: string;
  title: string;
  description?: string | null;
  objective?: string | null;
  controls?: string | null;
  thumbnail?: string | null;
  xpMultiplier?: number;
  betaOnly?: boolean;
  metadata?: Record<string, any> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type DashboardMetrics = {
  timeframe: { since: string; days: number };
  totals: {
    users: number;
    betaTesters: number;
    admins: number;
    newUsers7d: number;
    gamesLive: number;
  };
  activity: {
    activeUsers7d: number;
    totalPlays7d: number;
    avgScore7d: number;
  };
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

export const adminApi = {
  signIn: (payload: { username: string; password: string }) =>
    request<{ ok: boolean }>("/auth/local-signin", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  signOut: async () => {
    await fetch(`${API_BASE}/auth/logout`, {
      method: "GET",
      credentials: "include",
      redirect: "manual",
    });
  },
  refresh: () =>
    request<{ ok: boolean }>("/auth/refresh", { method: "POST" }).catch(() => ({ ok: false })),
  fetchMe: () => request<{ user?: AdminAccount } | AdminAccount>("/me", { method: "GET" }),
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
  updateUser: (
    userId: string,
    payload: {
      email?: string;
      password?: string;
      betaTester?: boolean;
      admin?: boolean;
      username?: string;
    }
  ) =>
    request<AdminUserDetail>(`/admin/users/${userId}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listGames: (params: { cursor?: string; limit?: number }) => {
    const url = new URL(`${API_BASE}/admin/games`);
    if (params.cursor) url.searchParams.set("cursor", params.cursor);
    if (params.limit) url.searchParams.set("limit", String(params.limit));
    return request<PaginatedResponse<GameConfig>>(url.pathname + url.search, { method: "GET" });
  },
  getGame: (gameId: string) => request<GameConfig>(`/admin/games/${gameId}`),
  getGameStats: (gameId: string) => request<GameStats>(`/admin/games/${gameId}/stats`),
  createGame: (payload: GameConfig) =>
    request<GameConfig>(`/admin/games`, { method: "POST", body: JSON.stringify(payload) }),
  updateGame: (gameId: string, payload: Partial<GameConfig>) =>
    request<GameConfig>(`/admin/games/${gameId}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getDashboardMetrics: () => request<DashboardMetrics>(`/admin/metrics/dashboard`),
  resetUserPin: (userId: string, newPin: string) =>
    request<{ success: boolean; message: string }>(`/auth/firebase/admin/reset-pin`, {
      method: "POST",
      body: JSON.stringify({ userId, newPin }),
    }),
};

export function normalizeAccount(
  payload: { user?: AdminAccount } | AdminAccount | null | undefined
) {
  if (!payload) return null;
  const account = (payload as any).user ?? payload;
  if (!account?.userId) return null;
  return account as AdminAccount;
}
