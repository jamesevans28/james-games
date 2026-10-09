import { test, expect } from "vitest";
import { gamesByMaker } from "./gamesByMaker";

const makers = ["James", "Tilly", "Harvey"];

test("groups by designer in maker order, skipping makers with no games", () => {
  const groups = gamesByMaker(
    [
      { id: "b", title: "Blocker", noteBy: "Harvey" },
      { id: "s", title: "Snapadile", noteBy: "Tilly" },
      { id: "a", title: "Apple", noteBy: "Harvey" },
    ],
    makers,
  );
  expect(groups.map((g) => g.maker)).toEqual(["Tilly", "Harvey"]);
  expect(groups[1].games.map((g) => g.id)).toEqual(["a", "b"]);
});

test("games with no or unknown designer go in a final everyone group", () => {
  const groups = gamesByMaker(
    [
      { id: "x", title: "X" },
      { id: "y", title: "Y", noteBy: "Someone" },
      { id: "t", title: "T", noteBy: "Tilly" },
    ],
    makers,
  );
  expect(groups.map((g) => g.maker)).toEqual(["Tilly", null]);
  expect(groups[1].games.map((g) => g.id)).toEqual(["x", "y"]);
});

test("empty list gives no groups", () => {
  expect(gamesByMaker([], makers)).toEqual([]);
});
