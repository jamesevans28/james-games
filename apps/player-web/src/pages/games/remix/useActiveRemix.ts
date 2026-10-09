import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchRemix, type Remix } from "../../../lib/api";
import { queryKeys } from "../../../lib/queryClient";
import { getManifest } from "../../../platform/registry";
import { isDefault, resolveValues, sameValues, type RemixValues } from "../../../platform/remix";
import type { RemixKnob } from "../../../platform/sdk";

/** The remix the next run plays: a saved one (from `?remix=<id>`) or slider values. */
export type ActiveRemix = {
  /** The saved remix's id, or null for slider values that aren't saved. */
  id: string | null;
  name: string | null;
  values: RemixValues;
};

const NO_KNOBS: readonly RemixKnob[] = [];

/**
 * Remix state for a game page (T11.2). `/games/:id?remix=<id>` loads that saved
 * remix; sliders make an unsaved one; `clear()` goes back to the normal game.
 */
export function useActiveRemix(gameId: string | undefined) {
  const queryClient = useQueryClient();
  const knobs = useMemo(
    () => (gameId ? (getManifest(gameId)?.remix ?? NO_KNOBS) : NO_KNOBS),
    [gameId],
  );
  const [params, setParams] = useSearchParams();
  const remixParam = knobs.length > 0 ? params.get("remix") : null;
  const query = useQuery({
    queryKey: queryKeys.remix(remixParam ?? ""),
    queryFn: () => fetchRemix(remixParam ?? ""),
    enabled: Boolean(remixParam),
  });
  const [custom, setCustom] = useState<RemixValues | null>(null);

  const data = query.data ?? null;
  const saved: Remix | null = remixParam && data?.gameId === gameId ? data : null;

  const active = useMemo<ActiveRemix | null>(() => {
    if (custom) return { id: null, name: null, values: custom };
    if (saved) return { id: saved.id, name: saved.name, values: resolveValues(knobs, saved.knobs) };
    return null;
  }, [custom, saved, knobs]);

  const dropParam = useCallback(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("remix");
        return next;
      },
      { replace: true },
    );
  }, [setParams]);

  /** Play these slider values next. Defaults mean the normal game. */
  const playValues = useCallback(
    (values: RemixValues) => {
      if (isDefault(knobs, values)) {
        setCustom(null);
        dropParam();
      } else if (saved && sameValues(knobs, saved.knobs, values)) {
        setCustom(null); // unchanged: keep playing the saved remix and its board
      } else {
        setCustom(resolveValues(knobs, values));
        if (remixParam) dropParam();
      }
    },
    [knobs, saved, remixParam, dropParam],
  );

  /** A remix was just saved: play it, with its board and share link. */
  const adoptSaved = useCallback(
    (remix: Remix) => {
      queryClient.setQueryData(queryKeys.remix(remix.id), remix);
      setCustom(null);
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("remix", remix.id);
          return next;
        },
        { replace: true },
      );
    },
    [queryClient, setParams],
  );

  const clear = useCallback(() => {
    setCustom(null);
    dropParam();
  }, [dropParam]);

  return {
    knobs,
    active,
    saved,
    loading: Boolean(remixParam) && query.isPending,
    /** The link's remix doesn't exist (or is for another game). */
    missing: Boolean(remixParam) && query.isSuccess && !saved,
    failed: Boolean(remixParam) && query.isError,
    playValues,
    adoptSaved,
    clear,
  };
}

export type ActiveRemixState = ReturnType<typeof useActiveRemix>;
