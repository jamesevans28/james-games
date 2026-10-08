import { expect, test } from "vitest";
import { bounce, dropBlock, overlap, speedFor } from "./overlap";

test("overlap keeps the shared part of two spans", () => {
  expect(overlap({ x: 120, w: 100 }, { x: 100, w: 100 })).toEqual({ x: 120, w: 80 });
  expect(overlap({ x: 80, w: 100 }, { x: 100, w: 100 })).toEqual({ x: 100, w: 80 });
  expect(overlap({ x: 100, w: 100 }, { x: 100, w: 100 })).toEqual({ x: 100, w: 100 });
});

test("overlap is null when the spans miss or only touch edges", () => {
  expect(overlap({ x: 0, w: 50 }, { x: 100, w: 100 })).toBeNull();
  expect(overlap({ x: 200, w: 50 }, { x: 100, w: 100 })).toBeNull();
  expect(overlap({ x: 50, w: 50 }, { x: 100, w: 100 })).toBeNull();
});

test("dropBlock cuts the overhang on the right", () => {
  expect(dropBlock({ x: 130, w: 100 }, { x: 100, w: 100 })).toEqual({
    kept: { x: 130, w: 70 },
    cut: { x: 200, w: 30 },
    perfect: false,
  });
});

test("dropBlock cuts the overhang on the left", () => {
  expect(dropBlock({ x: 60, w: 100 }, { x: 100, w: 100 })).toEqual({
    kept: { x: 100, w: 60 },
    cut: { x: 60, w: 40 },
    perfect: false,
  });
});

test("dropBlock ends the run when nothing overlaps", () => {
  const moving = { x: 300, w: 80 };
  expect(dropBlock(moving, { x: 100, w: 100 })).toEqual({
    kept: null,
    cut: moving,
    perfect: false,
  });
});

test("dropBlock snaps a near miss to a perfect drop", () => {
  expect(dropBlock({ x: 104, w: 100 }, { x: 100, w: 100 }, 6)).toEqual({
    kept: { x: 100, w: 100 },
    cut: null,
    perfect: true,
  });
  expect(dropBlock({ x: 108, w: 100 }, { x: 100, w: 100 }, 6).perfect).toBe(false);
});

test("an exact drop with no snap keeps everything without a cut", () => {
  expect(dropBlock({ x: 100, w: 100 }, { x: 100, w: 100 })).toEqual({
    kept: { x: 100, w: 100 },
    cut: null,
    perfect: true,
  });
});

test("bounce moves and turns around at the edges", () => {
  expect(bounce(10, 1, 5, 0, 100)).toEqual({ x: 15, dir: 1 });
  expect(bounce(98, 1, 5, 0, 100)).toEqual({ x: 97, dir: -1 });
  expect(bounce(2, -1, 5, 0, 100)).toEqual({ x: 3, dir: 1 });
  expect(bounce(50, 1, 500, 0, 100)).toEqual({ x: 0, dir: -1 });
});

test("speedFor grows with each block and is capped", () => {
  expect(speedFor(0)).toBe(220);
  expect(speedFor(10)).toBe(340);
  expect(speedFor(1000)).toBe(520);
});
