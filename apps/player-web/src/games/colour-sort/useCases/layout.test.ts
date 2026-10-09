import { expect, test } from "vitest";
import { ONE_ROW_TOP, TWO_ROW_TOPS, tubeLayout } from "./layout";

test("up to five tubes sit in one centred row", () => {
  const slots = tubeLayout(4, 540);
  expect(slots).toHaveLength(4);
  expect(slots.every((s) => s.top === ONE_ROW_TOP)).toBe(true);
  expect(slots.map((s) => s.x)).toEqual([90, 210, 330, 450]);
  expect(tubeLayout(5, 540)[0]?.spacing).toBe(108);
});

test("more than five tubes use two rows, the extra one on top", () => {
  const slots = tubeLayout(7, 540);
  expect(slots.filter((s) => s.top === TWO_ROW_TOPS[0])).toHaveLength(4);
  expect(slots.filter((s) => s.top === TWO_ROW_TOPS[1])).toHaveLength(3);
  expect(slots[4]?.x).toBe(150);
});

test("no tubes, no slots", () => {
  expect(tubeLayout(0, 540)).toEqual([]);
});
