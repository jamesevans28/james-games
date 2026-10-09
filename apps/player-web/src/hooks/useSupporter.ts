import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/FirebaseAuthProvider";
import { fetchSupporterStatus } from "../lib/api";
import { queryKeys } from "../lib/queryClient";

/** True when this player (or a grown-up linked to them) is a family supporter (T12.2). */
export function useSupporter(): boolean {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: [...queryKeys.supporter, user?.userId ?? "guest"],
    queryFn: fetchSupporterStatus,
    enabled: Boolean(user && !user.isAnonymous),
  });
  return Boolean(data?.supporter);
}
