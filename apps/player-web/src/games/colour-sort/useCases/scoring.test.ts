import { expect, test } from "vitest";
import { LAST_LEVEL, MAX_SCORE, isLastLevel, levelScore, moveBonus } from "./scoring";

test("the bonus is full at or under par and drops 5 a move over", () => {
  expect(moveBonus(6, 8)).toBe(50);
  expect(moveBonus(8, 8)).toBe(50);
  expect(moveBonus(9, 8)).toBe(45);
  expect(moveBonus(17, 8)).toBe(5);
  expect(moveBonus(18, 8)).toBe(0);
  expect(moveBonus(99, 8)).toBe(0);
});

test("a level is worth 100 plus the bonus", () => {
  expect(levelScore(5, 8)).toBe(150);
  expect(levelScore(12, 8)).toBe(130);
  expect(levelScore(40, 8)).toBe(100);
});

test("a run ends after level 20, and can score at most 3,000", () => {
  expect(LAST_LEVEL).toBe(20);
  expect(isLastLevel(19)).toBe(false);
  expect(isLastLevel(20)).toBe(true);
  expect(MAX_SCORE).toBe(3_000);
});
