import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchRatingSummary, submitRating, type RatingSummary } from "../lib/api";
import { isSigninRequired } from "../lib/apiError";
import { queryKeys } from "../lib/queryClient";
import { useAuth } from "../context/FirebaseAuthProvider";

function validRating(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * One game's rating summary plus the player's own rating, and a way to rate (T7.10).
 * The summary includes `userRating` for the signed-in player, so the viewer is part of the key.
 */
export function useGameRatings(gameId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = [...queryKeys.ratings(gameId ?? ""), user?.userId ?? "anon"];

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchRatingSummary(gameId ?? ""),
    enabled: Boolean(gameId),
  });

  const mutation = useMutation({
    mutationFn: (value: number) => submitRating(gameId ?? "", value),
    onSuccess: (summary: RatingSummary, value) =>
      queryClient.setQueryData<RatingSummary>(key, {
        ...summary,
        userRating: summary.userRating ?? value,
      }),
  });

  const submitError = mutation.error
    ? isSigninRequired(mutation.error)
      ? "Sign in to rate this game."
      : "That didn't save. Try again in a bit."
    : null;

  return {
    summary: query.data ?? null,
    userRating: validRating(query.data?.userRating),
    /** True once we know whether this player has rated (the summary loaded). */
    isReady: query.isSuccess,
    rate: (value: number) => mutation.mutateAsync(value).then(() => undefined),
    isSubmitting: mutation.isPending,
    submitError,
  };
}
