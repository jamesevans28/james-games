import { test, expect } from "vitest";
import { scoreScrabbleWord, SCRABBLE_LETTER_SCORES } from "./scrabble";

test("every letter A–Z has a score", () => {
  expect(Object.keys(SCRABBLE_LETTER_SCORES)).toHaveLength(26);
});

test("scores words case-insensitively", () => {
  expect(scoreScrabbleWord("quiz")).toBe(22);
  expect(scoreScrabbleWord("QUIZ")).toBe(22);
  expect(scoreScrabbleWord("Games")).toBe(8);
});

test("non-letters score nothing", () => {
  expect(scoreScrabbleWord("")).toBe(0);
  expect(scoreScrabbleWord("a-b 1")).toBe(4);
});
