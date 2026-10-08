import { test, expect, vi } from "vitest";
import { createRunEnder } from "./runEnder";

function fakeClock() {
  const timers: Array<{ at: number; fn: () => void; live: boolean }> = [];
  let now = 0;
  return {
    schedule: (ms: number, fn: () => void) => {
      const t = { at: now + ms, fn, live: true };
      timers.push(t);
      return () => (t.live = false);
    },
    advance(ms: number) {
      now += ms;
      timers.filter((t) => t.live && t.at <= now).forEach((t) => ((t.live = false), t.fn()));
    },
  };
}

test("reports after the delay, not before", () => {
  const clock = fakeClock();
  const report = vi.fn();
  const ender = createRunEnder(900, clock.schedule);
  expect(ender.end(report)).toBe(true);
  expect(ender.ended).toBe(true);
  clock.advance(899);
  expect(report).not.toHaveBeenCalled();
  clock.advance(1);
  expect(report).toHaveBeenCalledTimes(1);
});

test("ending twice reports once", () => {
  const clock = fakeClock();
  const report = vi.fn();
  const ender = createRunEnder(100, clock.schedule);
  ender.end(report);
  expect(ender.end(report)).toBe(false);
  clock.advance(500);
  expect(report).toHaveBeenCalledTimes(1);
});

test("reset cancels a pending report and allows a new run to end", () => {
  const clock = fakeClock();
  const first = vi.fn();
  const second = vi.fn();
  const ender = createRunEnder(100, clock.schedule);
  ender.end(first);
  ender.reset();
  clock.advance(500);
  expect(first).not.toHaveBeenCalled();
  expect(ender.end(second)).toBe(true);
  clock.advance(100);
  expect(second).toHaveBeenCalledTimes(1);
});

test("a negative delay reports straight away", () => {
  const clock = fakeClock();
  const report = vi.fn();
  createRunEnder(-5, clock.schedule).end(report);
  clock.advance(0);
  expect(report).toHaveBeenCalledTimes(1);
});
