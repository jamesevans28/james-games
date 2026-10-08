import { describe, expect, it } from "vitest";
import { checkScreenName, generateScreenName, SCREEN_NAME_MAX } from "./screenNames.js";

describe("generateScreenName", () => {
  it("makes adjective-animal-NN names that always pass the rules", () => {
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < 2000; i++) {
      const name = generateScreenName(random);
      expect(name).toMatch(/^[a-z]+-[a-z]+-\d{2}$/);
      expect(name.length).toBeLessThanOrEqual(SCREEN_NAME_MAX);
      expect(checkScreenName(name)).toEqual({ ok: true, name });
    }
  });
});

describe("checkScreenName", () => {
  it.each(["Rocket Kid", "  zoom   zoom  ", "Ninja-7", "Zoë", "abc"])("accepts %j", (raw) => {
    expect(checkScreenName(raw).ok).toBe(true);
  });

  it("stores the trimmed, single-spaced form", () => {
    expect(checkScreenName("  zoom   zoom  ")).toEqual({ ok: true, name: "zoom zoom" });
  });

  it.each([
    ["ab", "too_short"],
    ["a".repeat(17), "too_long"],
    ["me@home", "bad_characters"],
    ["cool.kid", "bad_characters"],
    ["-dash", "bad_characters"],
    ["12345", "all_digits"],
    ["shit lord", "not_allowed"],
    ["sh1t", "not_allowed"],
    ["f u c k", "not_allowed"],
    ["Tilly 2", "reserved"],
    ["the-admin", "reserved"],
  ])("rejects %j as %s", (raw, problem) => {
    expect(checkScreenName(raw)).toEqual({ ok: false, problem });
  });
});
