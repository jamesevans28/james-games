import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchFriendRequests, fetchFriendsSummary, fetchMe, updatePreferences } from "../lib/api";
import { queryKeys } from "../lib/queryClient";
import { useAuth } from "../context/FirebaseAuthProvider";

/**
 * Friends server state (T7.6). Every friends query key starts with queryKeys.friends,
 * so one invalidation after an action refreshes the page, the requests badge and profiles.
 */

const FRIENDS_REFRESH_MS = 60_000;

/** True for a signed-in player with a username (guests can't have friends). */
function useRegisteredUserId(): string | null {
  const { user } = useAuth();
  return user && !user.isAnonymous && user.accountType !== "anonymous" ? user.userId : null;
}

/** The friends page: your code, friends, requests both ways, blocked players. Refreshes every 60 s. */
export function useFriendsSummary() {
  const userId = useRegisteredUserId();
  return useQuery({
    queryKey: [...queryKeys.friends, "summary", userId],
    queryFn: fetchFriendsSummary,
    enabled: Boolean(userId),
    refetchInterval: FRIENDS_REFRESH_MS,
  });
}

/** Pending requests (notifications page and the header dot). Refetched when the window regains focus. */
export function useFriendRequests() {
  const userId = useRegisteredUserId();
  return useQuery({
    queryKey: [...queryKeys.friends, "requests", userId],
    queryFn: fetchFriendRequests,
    enabled: Boolean(userId),
    refetchOnWindowFocus: true,
  });
}

/**
 * Runs a friends action (send, accept, decline, remove, block, unblock) and then
 * refreshes friends and profiles. `run` rejects with the API error, for the caller's message.
 */
export function useFriendAction() {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSettled: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.friends }),
        client.invalidateQueries({ queryKey: queryKeys.profile() }),
      ]);
    },
  });
  return {
    run: <T>(action: () => Promise<T>) => mutation.mutateAsync(action) as Promise<T>,
    busy: mutation.isPending,
  };
}

/** The signed-in player's own preferences (GET /me), for the presence switch. */
function useMyPrefs() {
  const userId = useRegisteredUserId();
  const query = useQuery({
    queryKey: [...queryKeys.me, userId],
    queryFn: fetchMe,
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
  });
  return { userId, prefs: query.data?.user?.preferences ?? null, loaded: query.isSuccess };
}

/**
 * "Show friends when I'm online" (T7.6). Off unless the player switched it on
 * (`prefs.sharePresence === true`); `setSharePresence` saves it with the other prefs.
 */
export function useSharePresence() {
  const client = useQueryClient();
  const { userId, prefs, loaded } = useMyPrefs();
  const mutation = useMutation({
    mutationFn: async (next: boolean) => {
      // POST /users/preferences replaces the whole object: keep the other prefs.
      const current = await client.fetchQuery({
        queryKey: [...queryKeys.me, userId],
        queryFn: fetchMe,
      });
      await updatePreferences({
        preferences: { ...(current.user?.preferences ?? {}), sharePresence: next },
      });
    },
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.me }),
  });
  return {
    sharePresence: prefs?.sharePresence === true,
    loaded,
    saving: mutation.isPending,
    setSharePresence: (next: boolean) => mutation.mutateAsync(next),
  };
}
