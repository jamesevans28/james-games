/**
 * Remix mode helpers (T11.2), pure: a game's knobs (manifest `remix`) and the values a
 * remix gives them. The host serves `host.remix.get(key)` from these, so a game reads
 * a knob the same way whether it is a saved remix, slider values or the normal game.
 */
import type { RemixKnob } from "./sdk";

export type RemixValues = Record<string, number>;

/** Clamps to [min, max] and snaps to the knob's step grid. */
export function clampKnob(knob: RemixKnob, value: number): number {
  if (!Number.isFinite(value)) return knob.default;
  const clamped = Math.min(knob.max, Math.max(knob.min, value));
  const steps = Math.round((clamped - knob.min) / knob.step);
  return Number((knob.min + steps * knob.step).toFixed(6));
}

/** Every knob at its default: the normal game. */
export function defaultValues(knobs: readonly RemixKnob[]): RemixValues {
  return Object.fromEntries(knobs.map((k) => [k.key, k.default]));
}

/** A full, safe set of values: unknown keys dropped, missing ones defaulted, all clamped. */
export function resolveValues(
  knobs: readonly RemixKnob[],
  values: Readonly<Record<string, unknown>> | null | undefined,
): RemixValues {
  return Object.fromEntries(
    knobs.map((k) => {
      const raw = values?.[k.key];
      return [k.key, typeof raw === "number" ? clampKnob(k, raw) : k.default];
    }),
  );
}

/** True when the values change nothing (every knob at its default). */
export function isDefault(
  knobs: readonly RemixKnob[],
  values: Readonly<Record<string, unknown>> | null | undefined,
): boolean {
  const resolved = resolveValues(knobs, values);
  return knobs.every((k) => resolved[k.key] === k.default);
}

/** True when two value sets resolve to the same remix. */
export function sameValues(
  knobs: readonly RemixKnob[],
  a: Readonly<Record<string, unknown>> | null | undefined,
  b: Readonly<Record<string, unknown>> | null | undefined,
): boolean {
  const ra = resolveValues(knobs, a);
  const rb = resolveValues(knobs, b);
  return knobs.every((k) => ra[k.key] === rb[k.key]);
}

/**
 * The value a game sees for `key`: the remix's value, else the manifest default.
 * A key the manifest doesn't declare reads as 1, a harmless multiplier.
 */
export function remixValue(
  knobs: readonly RemixKnob[],
  values: Readonly<Record<string, unknown>> | null | undefined,
  key: string,
): number {
  const knob = knobs.find((k) => k.key === key);
  if (!knob) return 1;
  const raw = values?.[key];
  return typeof raw === "number" ? clampKnob(knob, raw) : knob.default;
}

/** Slider label text: "1.5×" for multipliers (default 1), a plain number otherwise. */
export function formatKnob(knob: RemixKnob, value: number): string {
  if (knob.default === 1 && knob.step < 1) return `${Number(value.toFixed(2))}×`;
  return String(Number(value.toFixed(2)));
}

/** Where a remix's device best is stored, apart from the normal game's best. */
export function remixBestId(gameId: string, remixId: string | null): string {
  return `${gameId}~remix${remixId ? `-${remixId}` : ""}`;
}
