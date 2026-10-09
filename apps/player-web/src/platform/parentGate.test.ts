import { expect, test } from "vitest";
import { isCorrect, makeChallenge } from "./parentGate";

test("challenges multiply two numbers from three to nine, written as words", () => {
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 200; i++) {
    const c = makeChallenge(random);
    expect(c.question).toMatch(/^What is [a-z]+ times [a-z]+\?$/);
    expect(c.answer).toBeGreaterThanOrEqual(9);
    expect(c.answer).toBeLessThanOrEqual(81);
  }
});

test("only the exact product passes", () => {
  const c = { question: "What is six times seven?", answer: 42 };
  expect(isCorrect(c, " 42 ")).toBe(true);
  expect(isCorrect(c, "43")).toBe(false);
  expect(isCorrect(c, "forty-two")).toBe(false);
  expect(isCorrect(c, "")).toBe(false);
});

test("a request waits for the modal's answer, and is refused without a modal", async () => {
  const { requestGrownUp, settleGrownUp, onGrownUpRequest } = await import("./parentGate");
  expect(await requestGrownUp()).toBe(false);
  const opened: boolean[] = [];
  const off = onGrownUpRequest((open) => opened.push(open));
  const answer = requestGrownUp();
  settleGrownUp(true);
  expect(await answer).toBe(true);
  expect(opened).toEqual([true, false]);
  off();
});
