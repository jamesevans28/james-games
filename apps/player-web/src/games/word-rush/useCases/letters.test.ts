import { test, expect } from "vitest";
import { CONSONANTS, PICKS, VOWELS, isVowel, picksComplete, togglePick } from "./letters";

test("the alphabet splits into 5 vowels and 21 consonants", () => {
  expect(VOWELS).toHaveLength(5);
  expect(CONSONANTS).toHaveLength(21);
  expect(isVowel("E")).toBe(true);
  expect(isVowel("Y")).toBe(false);
});

test("picking 4 consonants and 2 vowels, no more", () => {
  let picks: string[] = [];
  for (const l of ["R", "S", "T", "L", "E", "A"]) {
    const next = togglePick(picks, l);
    expect(next.ok).toBe(true);
    picks = next.picks;
  }
  expect(picksComplete(picks)).toBe(true);
  expect(togglePick(picks, "N")).toEqual({ picks, ok: false });
  expect(togglePick(picks, "O")).toEqual({ picks, ok: false });
  expect(PICKS).toEqual({ consonants: 4, vowels: 2 });
});

test("tapping a picked letter unpicks it", () => {
  const { picks, ok } = togglePick(["R", "E"], "R");
  expect(ok).toBe(true);
  expect(picks).toEqual(["E"]);
  expect(picksComplete(picks)).toBe(false);
});
