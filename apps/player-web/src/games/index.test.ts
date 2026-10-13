import { test, expect } from "vitest";
import { displayCover } from "./index";

test("a processed cover.png is shown as its WebP sibling", () => {
  expect(displayCover("/assets/snapadile/cover.png")).toBe("/assets/snapadile/cover.webp");
});

test("placeholder covers are shown as they are", () => {
  expect(displayCover("/assets/blocker/cover.svg")).toBe("/assets/blocker/cover.svg");
  expect(displayCover("/assets/hoop-city/hoop-city.png")).toBe("/assets/hoop-city/hoop-city.png");
});
