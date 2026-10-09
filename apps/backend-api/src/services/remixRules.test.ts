import { describe, expect, it } from "vitest";
import { checkRemixName, REMIX_NAME_MAX, validateKnobs } from "./remixRules.js";
import { remixKnobsFor, type RemixKnob } from "../data/remixKnobs.js";

describe("checkRemixName", () => {
  it.each(["Tilly's super-fast crocs", "Floaty hoops!", "Tiny tray?", "abc", "Zoë’s crocs"])(
    "accepts %j",
    (raw) => {
      expect(checkRemixName(raw).ok).toBe(true);
    },
  );

  it("tidies spaces and curly apostrophes", () => {
    expect(checkRemixName("  Zoë’s   crocs ")).toEqual({ ok: true, name: "Zoë's crocs" });
  });

  it.each([
    ["ab", "too_short"],
    ["x".repeat(REMIX_NAME_MAX + 1), "too_long"],
    ["me@example.com", "bad_characters"],
    ["go to site.com", "bad_characters"],
    ["call 0412 345 678", "bad_characters"],
    ["-dash first", "bad_characters"],
    ["fuck crocs", "not_allowed"],
    ["s h i t", "not_allowed"],
  ])("refuses %j (%s)", (raw, problem) => {
    expect(checkRemixName(raw)).toEqual({ ok: false, problem });
  });

  it("refuses a non-string", () => {
    expect(checkRemixName(42).ok).toBe(false);
  });
});

const speed: RemixKnob = {
  key: "speed",
  label: "Speed",
  min: 0.5,
  max: 2.5,
  step: 0.25,
  default: 1,
};
const size: RemixKnob = { key: "size", label: "Size", min: 0.6, max: 1.4, step: 0.1, default: 1 };
const defs = [speed, size];

describe("validateKnobs", () => {
  it("fills defaults and tidies float noise", () => {
    expect(validateKnobs(defs, { speed: 2.5 })).toEqual({
      ok: true,
      knobs: { speed: 2.5, size: 1 },
    });
    expect(validateKnobs(defs, { size: 0.1 + 0.2 + 0.4 })).toEqual({
      ok: true,
      knobs: { speed: 1, size: 0.7 },
    });
  });

  it("refuses out-of-range and off-grid values", () => {
    expect(validateKnobs(defs, { speed: 3 })).toMatchObject({ ok: false, problem: "out_of_range" });
    expect(validateKnobs(defs, { speed: 0.25 })).toMatchObject({ problem: "out_of_range" });
    expect(validateKnobs(defs, { speed: 1.1 })).toMatchObject({ problem: "out_of_range" });
  });

  it("refuses unknown keys, non-numbers and bad shapes", () => {
    expect(validateKnobs(defs, { speed: 2, xp: 9 })).toMatchObject({ problem: "unknown_knob" });
    expect(validateKnobs(defs, { speed: "2" })).toMatchObject({ problem: "bad_knobs" });
    expect(validateKnobs(defs, { speed: Number.POSITIVE_INFINITY })).toMatchObject({
      problem: "bad_knobs",
    });
    expect(validateKnobs(defs, [2])).toMatchObject({ problem: "bad_knobs" });
    expect(validateKnobs(defs, null)).toMatchObject({ problem: "bad_knobs" });
  });

  it("refuses a remix that changes nothing, or a game without knobs", () => {
    expect(validateKnobs(defs, {})).toEqual({ ok: false, problem: "unchanged" });
    expect(validateKnobs(defs, { speed: 1 })).toEqual({ ok: false, problem: "unchanged" });
    expect(validateKnobs([], { speed: 2 })).toEqual({ ok: false, problem: "no_knobs" });
  });
});

describe("remixKnobsFor (bundled game-meta.json)", () => {
  it("has the manifests' knobs", () => {
    expect(remixKnobsFor("snapadile").map((k) => k.key)).toEqual(["speed", "lives", "crocSize"]);
    expect(remixKnobsFor("hoop-city").map((k) => k.key)).toEqual(["gravity", "ringGap"]);
    expect(remixKnobsFor("blocker").map((k) => k.key)).toEqual(["traySize"]);
    expect(remixKnobsFor("no-such-game")).toEqual([]);
  });
});
