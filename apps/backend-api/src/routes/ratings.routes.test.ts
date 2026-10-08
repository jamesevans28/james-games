import { afterAll, beforeAll, expect, test } from "vitest";
import { startTestApp, type TestApp } from "../test/app.js";

let api: TestApp;

beforeAll(async () => {
  api = await startTestApp();
  await api.addUser({ id: "tilly" });
  await api.addUser({ id: "harvey" });
});
afterAll(() => api.close());

test("rating needs a signed-in player, a valid star count and a listed game", async () => {
  expect((await api.request("POST", "/ratings/test-game", { body: { rating: 5 } })).status).toBe(
    401,
  );
  for (const rating of [0, 6, "x", null, ""]) {
    const res = await api.request("POST", "/ratings/test-game", { as: "tilly", body: { rating } });
    expect(res).toEqual({ status: 400, body: { error: "invalid_rating" } });
  }
  expect(
    (await api.request("POST", "/ratings/old-game", { as: "tilly", body: { rating: 3 } })).status,
  ).toBe(404);
  expect(
    (await api.request("POST", "/ratings/nope", { as: "tilly", body: { rating: 3 } })).status,
  ).toBe(404);
});

test("upsert keeps one rating per player and the summary is a live aggregate", async () => {
  const first = await api.request("POST", "/ratings/test-game", {
    as: "tilly",
    body: { rating: 5 },
  });
  expect(first).toEqual({
    status: 200,
    body: { gameId: "test-game", ratingCount: 1, avgRating: 5, userRating: 5 },
  });

  await api.request("POST", "/ratings/test-game", { as: "harvey", body: { rating: 4 } });
  // Tilly changes her mind: still one rating from her.
  const changed = await api.request("POST", "/ratings/test-game", {
    as: "tilly",
    body: { rating: 2 },
  });
  expect(changed.body).toEqual({
    gameId: "test-game",
    ratingCount: 2,
    avgRating: 3,
    userRating: 2,
  });

  expect((await api.request("GET", "/ratings/test-game")).body).toEqual({
    gameId: "test-game",
    ratingCount: 2,
    avgRating: 3,
  });
  expect((await api.request("GET", "/ratings/test-game", { as: "harvey" })).body.userRating).toBe(
    4,
  );

  const list = await api.request("GET", "/ratings?ids=test-game,beta-game,test-game");
  expect(list.body).toEqual({
    summaries: [
      { gameId: "test-game", ratingCount: 2, avgRating: 3 },
      { gameId: "beta-game", ratingCount: 0, avgRating: 0 },
    ],
  });
  expect((await api.request("GET", "/ratings")).body).toEqual({ summaries: [] });
});
