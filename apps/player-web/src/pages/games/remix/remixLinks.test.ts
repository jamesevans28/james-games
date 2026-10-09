import { test, expect } from "vitest";
import { remixBoardPath, remixPath, remixShareData } from "./remixLinks";
import { SITE_URL } from "../../../utils/seoKeywords";

const id = "6f1d2c3b-4a5e-4f60-9a7b-8c9d0e1f2a3b";

test("remix paths open the game and the board with the remix", () => {
  expect(remixPath("snapadile", id)).toBe(`/games/snapadile?remix=${id}`);
  expect(remixBoardPath("snapadile", id)).toBe(`/leaderboard/snapadile?remix=${id}`);
});

test("share data has the name and a full link", () => {
  const data = remixShareData({
    gameId: "snapadile",
    gameTitle: "Snapadile",
    remixId: id,
    name: "Tilly's super-fast crocs",
  });
  expect(data.url).toBe(`${SITE_URL}/games/snapadile?remix=${id}`);
  expect(data.title).toContain("Tilly's super-fast crocs");
  expect(data.text).toContain("Snapadile");
});
