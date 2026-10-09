import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchDaily, type DailyBoardEntry } from "../../lib/api";
import { queryKeys } from "../../lib/queryClient";
import { allGames, type GameMeta } from "../../games";
import { useAuth } from "../../context/FirebaseAuthProvider";
import { dailyGameFor, localDay } from "./dailyRules";

export type DailyView = {
  day: string;
  game: GameMeta | undefined;
  myRun?: { score: number };
  board: DailyBoardEntry[];
  /** True once the server answered (the board and your run come from there). */
  online: boolean;
  isLoading: boolean;
};

const ACTIVE_IDS = allGames.filter((g) => g.status === "active").map((g) => g.id);

/**
 * Today's challenge (T11.3): GET /daily, or the same rotation worked out on the
 * device when the server can't be reached (then there is no board).
 */
export function useDaily(): DailyView {
  const { user } = useAuth();
  const query = useQuery({
    // The day is part of the key, so the board resets at local midnight.
    queryKey: [...queryKeys.daily, localDay(), user?.userId ?? null],
    queryFn: fetchDaily,
    staleTime: 30_000,
  });
  const data = query.data ?? null;
  return useMemo(() => {
    const day = data?.day ?? localDay();
    const gameId = data ? data.gameId : dailyGameFor(day, ACTIVE_IDS);
    return {
      day,
      game: gameId ? allGames.find((g) => g.id === gameId) : undefined,
      myRun: data?.myRun,
      board: data?.board ?? [],
      online: Boolean(data),
      isLoading: query.isPending && query.fetchStatus === "fetching",
    };
  }, [data, query.isPending, query.fetchStatus]);
}
