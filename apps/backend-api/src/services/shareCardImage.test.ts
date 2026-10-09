import { expect, test } from "vitest";
import { buildShareSvg, canDraw, loadCardFonts, textWidth } from "./shareCardImage.js";
import type { ShareCard } from "./shareCard.js";

const fonts = loadCardFonts();

const card: ShareCard = {
  playId: "3f2b8c1e-7a4d-4c6b-9e2f-1a2b3c4d5e6f",
  gameId: "snapadile",
  gameTitle: "Snapadile",
  score: 120,
  playerName: "Tilly",
  remixName: null,
};

test("text becomes paths: no <text>, no fonts needed, no NaN", () => {
  const svg = buildShareSvg(card, fonts, "games4james.com");
  expect(svg).toMatch(/^<svg [^>]*width="1200" height="630"/);
  expect(svg).not.toContain("<text");
  expect(svg).not.toContain("NaN");
  // Player text never reaches the SVG as text, so it can't break the markup.
  expect(buildShareSvg({ ...card, playerName: '<"&>' }, fonts, "x")).not.toContain('<"&>');
});

test("names the fonts can't draw fall back to plain words", () => {
  expect(canDraw("Tilly-42", fonts.body)).toBe(true);
  expect(canDraw("Zoë", fonts.body)).toBe(true);
  expect(canDraw("Тилли", fonts.body)).toBe(false);
  const svg = buildShareSvg({ ...card, playerName: "Тилли" }, fonts, "games4james.com");
  expect(svg).toBe(buildShareSvg({ ...card, playerName: null }, fonts, "games4james.com"));
});

test("long titles shrink to fit", () => {
  const long = { ...card, gameTitle: "The Extremely Long Name Of A Very Silly Game" };
  expect(textWidth(long.gameTitle, fonts.display, 96)).toBeGreaterThan(960);
  expect(buildShareSvg(long, fonts, "games4james.com")).not.toContain("NaN");
});
