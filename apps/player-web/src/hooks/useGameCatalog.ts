/**
 * Game catalog: the bundled manifests (games/index.ts) plus the admin-managed extras
 * from GET /games/config (today only `betaOnly`). Display fields (title, copy, cover,
 * dates) always come from the manifests, so the catalog renders at once and works
 * with the API offline; the server data is a TanStack Query (T7.10), not a cache.
 */
import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { allGames, type GameMeta } from "../games";
import { API_BASE_URL } from "../config/env";
import { apiErrorFrom } from "../lib/apiError";
import { queryKeys } from "../lib/queryClient";

export type GameCatalogEntry = GameMeta & {
  /** Free-form admin metadata from the server's games row. */
  metadata?: Record<string, unknown> | null;
};

/** The parts of GET /games/config the client uses. */
export type GameConfig = {
  gameId: string;
  betaOnly?: boolean;
  metadata?: Record<string, unknown> | null;
};

async function fetchGameConfigs(): Promise<Record<string, GameConfig>> {
  const byId: Record<string, GameConfig> = {};
  if (!API_BASE_URL) return byId;
  let cursor: string | undefined;
  do {
    const url = new URL("/games/config", API_BASE_URL);
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("cursor", cursor);
    const res = await fetch(url.toString());
    if (!res.ok) throw await apiErrorFrom(res, "Failed to load games");
    const data = (await res.json()) as { items?: GameConfig[]; nextCursor?: string };
    for (const item of data.items ?? []) byId[item.gameId] = item;
    cursor = data.nextCursor;
  } while (cursor);
  return byId;
}

/** A manifest with the server's extras applied. Pure. */
export function mergeGameData(bundled: GameMeta, config?: GameConfig | null): GameCatalogEntry {
  if (!config) return { ...bundled, metadata: null };
  return {
    ...bundled,
    betaOnly: config.betaOnly ?? bundled.betaOnly,
    metadata: config.metadata ?? null,
  };
}

export type GameCatalogState = {
  /** Listable games (active + beta), instantly available from the manifests. */
  games: GameCatalogEntry[];
  /** True while the first server fetch is in flight. */
  isHydrating: boolean;
  error: Error | null;
  /** Any game by id, including inactive ones (direct links still resolve). */
  getGame: (id: string) => GameCatalogEntry | undefined;
};

export function useGameCatalog(): GameCatalogState {
  const {
    data: configs,
    isPending,
    error,
  } = useQuery({
    queryKey: queryKeys.catalog,
    queryFn: fetchGameConfigs,
    staleTime: 5 * 60_000,
  });

  const merged = useMemo(() => allGames.map((g) => mergeGameData(g, configs?.[g.id])), [configs]);
  const games = useMemo(() => merged.filter((g) => g.status !== "inactive"), [merged]);
  const getGame = useCallback((id: string) => merged.find((g) => g.id === id), [merged]);

  return { games, isHydrating: isPending, error, getGame };
}

/** Beta games only for beta testers. */
export function filterByBetaAccess(
  games: GameCatalogEntry[],
  isBetaTester: boolean,
): GameCatalogEntry[] {
  return isBetaTester ? games : games.filter((g) => !g.betaOnly);
}
