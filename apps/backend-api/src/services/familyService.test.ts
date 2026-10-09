import { describe, expect, it } from "vitest";
import {
  FAMILY_CODE_ALPHABET,
  fillDays,
  generateFamilyCode,
  joinProblem,
  lastLocalDays,
  normalizeFamilyCode,
} from "./familyService.js";

describe("family codes", () => {
  it("are 6 characters from the easy-to-read alphabet", () => {
    let i = 0;
    const code = generateFamilyCode(() => i++ % FAMILY_CODE_ALPHABET.length);
    expect(code).toBe("234567");
    for (let n = 0; n < 50; n++) expect(normalizeFamilyCode(generateFamilyCode())).not.toBeNull();
  });

  it("forgive case, spaces and dashes, and refuse anything else", () => {
    expect(normalizeFamilyCode(" ab-c 234 ")).toBe("ABC234");
    expect(normalizeFamilyCode("ABC23")).toBeNull();
    expect(normalizeFamilyCode("ABC2340")).toBeNull();
    expect(normalizeFamilyCode("ABCO23")).toBeNull(); // O isn't in the alphabet
    expect(normalizeFamilyCode(123456)).toBeNull();
  });
});

describe("joinProblem", () => {
  it("allows up to two grown-ups, and re-joining the same one", () => {
    expect(joinProblem("kid", "mum", [])).toBeNull();
    expect(joinProblem("kid", "dad", ["mum"])).toBeNull();
    expect(joinProblem("kid", "gran", ["mum", "dad"])).toBe("too_many_grown_ups");
    expect(joinProblem("kid", "dad", ["mum", "dad"])).toBeNull();
  });

  it("refuses linking to yourself", () => {
    expect(joinProblem("kid", "kid", [])).toBe("cant_link_self");
  });
});

describe("lastLocalDays", () => {
  // 2026-10-09 23:30 UTC = 2026-10-10 10:30 in Sydney (+600), 2026-10-09 16:30 in LA (-420).
  const now = Date.parse("2026-10-09T23:30:00Z");

  it("ends on the viewer's local today, oldest first", () => {
    const sydney = lastLocalDays(now, 600);
    expect(sydney.days).toHaveLength(7);
    expect(sydney.days[6]).toBe("2026-10-10");
    expect(sydney.days[0]).toBe("2026-10-04");
    // Local midnight on 4 Oct in Sydney is 14:00 UTC on 3 Oct.
    expect(sydney.fromUtc.toISOString()).toBe("2026-10-03T14:00:00.000Z");

    const la = lastLocalDays(now, -420);
    expect(la.days[6]).toBe("2026-10-09");
    expect(la.fromUtc.toISOString()).toBe("2026-10-03T07:00:00.000Z");
  });

  it("clamps silly offsets", () => {
    expect(lastLocalDays(now, 99_999).days[6]).toBe("2026-10-10");
  });
});

it("fillDays puts zeros on days without plays", () => {
  const days = ["2026-10-08", "2026-10-09"];
  expect(
    fillDays(days, [{ userId: "k", day: "2026-10-09", plays: 3, durationMs: 90_000 }]),
  ).toEqual([
    { day: "2026-10-08", plays: 0, playMs: 0 },
    { day: "2026-10-09", plays: 3, playMs: 90_000 },
  ]);
});
