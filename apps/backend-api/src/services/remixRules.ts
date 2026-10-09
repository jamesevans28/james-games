/**
 * Remix rules (T11.2), pure so they can be tested: the name a kid gives a remix and
 * the knob values, checked against the game's manifest ranges. Nothing here trusts
 * the client.
 */
import { englishDataset, englishRecommendedTransformers, RegExpMatcher } from "obscenity";
import type { RemixKnob } from "../data/remixKnobs.js";

export const REMIX_NAME_MIN = 3;
export const REMIX_NAME_MAX = 24;
/** How many remixes one player may keep. */
export const REMIXES_PER_PLAYER = 50;

export type RemixNameProblem = "too_short" | "too_long" | "bad_characters" | "not_allowed";

export type RemixNameCheck = { ok: true; name: string } | { ok: false; problem: RemixNameProblem };

// The same obscenity matcher and settings as screen names (services/screenNames.ts).
const matcher = new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers });

/**
 * A remix name is public on its shared link, so it gets the screen-name filter with
 * looser rules: up to 24 characters, apostrophes and ! ? allowed ("Tilly's super-fast
 * crocs!"), and the makers' names are fine. Still no @, dots or slashes (no emails or
 * links) and no long runs of digits (no phone numbers).
 */
export function checkRemixName(raw: unknown): RemixNameCheck {
  if (typeof raw !== "string") return { ok: false, problem: "too_short" };
  const name = raw.trim().replace(/\s+/g, " ").replace(/’/g, "'");
  if (name.length < REMIX_NAME_MIN) return { ok: false, problem: "too_short" };
  if (name.length > REMIX_NAME_MAX) return { ok: false, problem: "too_long" };
  if (!/^[\p{L}\p{N}][\p{L}\p{N} '!?-]*$/u.test(name)) {
    return { ok: false, problem: "bad_characters" };
  }
  if (/\d{5,}/.test(name.replace(/[\s-]/g, ""))) return { ok: false, problem: "bad_characters" };
  const squashed = name.toLowerCase().replace(/[\s'!?-]+/g, "");
  if (matcher.hasMatch(name) || matcher.hasMatch(squashed)) {
    return { ok: false, problem: "not_allowed" };
  }
  return { ok: true, name };
}

export const REMIX_NAME_MESSAGES: Record<RemixNameProblem, string> = {
  too_short: `Give your remix a name with at least ${REMIX_NAME_MIN} letters.`,
  too_long: `Remix names can be up to ${REMIX_NAME_MAX} letters.`,
  bad_characters: "Use letters, numbers, spaces, dashes, ' ! and ? only.",
  not_allowed: "That name isn't allowed here. Try another one.",
};

export type KnobProblem = "no_knobs" | "bad_knobs" | "unknown_knob" | "out_of_range" | "unchanged";

export type KnobCheck =
  { ok: true; knobs: Record<string, number> } | { ok: false; problem: KnobProblem; key?: string };

/** Floating-point slack when checking a value sits on the knob's step grid. */
const STEP_EPSILON = 1e-6;

function onStep(knob: RemixKnob, value: number): boolean {
  const steps = (value - knob.min) / knob.step;
  return Math.abs(steps - Math.round(steps)) < STEP_EPSILON;
}

/**
 * Checks remix knob values against the manifest. Every key must be one of the game's
 * knobs, every value a number inside [min, max] on the step grid. Knobs left out get
 * their default, so the stored remix always has every knob. A game without knobs, or
 * a remix that changes nothing, is refused (it would just be the normal game).
 */
export function validateKnobs(defs: readonly RemixKnob[], input: unknown): KnobCheck {
  if (defs.length === 0) return { ok: false, problem: "no_knobs" };
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, problem: "bad_knobs" };
  }
  const values = input as Record<string, unknown>;
  for (const key of Object.keys(values)) {
    if (!defs.some((d) => d.key === key)) return { ok: false, problem: "unknown_knob", key };
  }
  const knobs: Record<string, number> = {};
  let changed = false;
  for (const def of defs) {
    const raw = Object.hasOwn(values, def.key) ? values[def.key] : def.default;
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      return { ok: false, problem: "bad_knobs", key: def.key };
    }
    if (raw < def.min - STEP_EPSILON || raw > def.max + STEP_EPSILON || !onStep(def, raw)) {
      return { ok: false, problem: "out_of_range", key: def.key };
    }
    // Store the tidy grid value (0.30000000000000004 → 0.3).
    const tidy = Number((def.min + Math.round((raw - def.min) / def.step) * def.step).toFixed(6));
    knobs[def.key] = tidy;
    if (Math.abs(tidy - def.default) > STEP_EPSILON) changed = true;
  }
  return changed ? { ok: true, knobs } : { ok: false, problem: "unchanged" };
}
