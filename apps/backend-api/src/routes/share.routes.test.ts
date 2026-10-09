import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { plays, remixes } from "../db/schema.js";
import { startTestApp, type TestApp } from "../test/app.js";

// Test games (src/test/db.ts): test-game active, beta-game beta, old-game inactive.

let api: TestApp;
const ids: Record<string, string> = {};

async function addPlay(key: string, values: typeof plays.$inferInsert) {
  const [play] = await api.db.insert(plays).values(values).returning();
  ids[key] = play!.id;
}

beforeAll(async () => {
  api = await startTestApp();
  await api.addUser({ id: "tilly", username: "tilly-login", screenName: "Tilly <3" });
  await api.addUser({ id: "gone", screenName: "Hidden", disabledAt: new Date() });
  await addPlay("normal", { userId: "tilly", gameId: "test-game", score: 12000 });
  await addPlay("anon", { userId: null, gameId: "test-game", score: 40 });
  await addPlay("disabled", { userId: "gone", gameId: "test-game", score: 41 });
  await addPlay("inactive", { userId: "tilly", gameId: "old-game", score: 50 });
  const [remix] = await api.db
    .insert(remixes)
    .values({ ownerId: "tilly", gameId: "test-game", name: "Super-fast crocs", knobs: {} })
    .returning();
  await addPlay("remix", { userId: "tilly", gameId: "test-game", score: 77, remixId: remix!.id });
});
afterAll(() => api.close());

async function raw(path: string) {
  const res = await fetch(api.base + path);
  return { res, bytes: new Uint8Array(await res.arrayBuffer()) };
}

const ogTitle = (html: string) => html.match(/<meta property="og:title" content="([^"]*)">/)?.[1];

describe("GET /share/:playId", () => {
  test("the preview page names the player by screen name, never username", async () => {
    const res = await api.request("GET", `/share/${ids.normal}`);
    expect(res.status).toBe(200);
    const html = String(res.body);
    expect(ogTitle(html)).toBe("Tilly &lt;3 scored 12,000 on Test Game!");
    expect(html).not.toContain("tilly-login");
    expect(html).toContain(`/s/${ids.normal}.png`);
    expect(html).toContain('location.replace("https://games4james.com/games/test-game")');
  });

  test("deleted and disabled players are 'A player'; remixes are named", async () => {
    const anon = await api.request("GET", `/share/${ids.anon}`);
    expect(ogTitle(String(anon.body))).toBe("A player scored 40 on Test Game!");
    const disabled = await api.request("GET", `/share/${ids.disabled}`);
    expect(ogTitle(String(disabled.body))).toBe("A player scored 41 on Test Game!");
    expect(String(disabled.body)).not.toContain("Hidden");
    const remix = await api.request("GET", `/share/${ids.remix}`);
    expect(ogTitle(String(remix.body))).toBe(
      "Tilly &lt;3 scored 77 on Super-fast crocs, a Test Game remix!",
    );
  });

  test("the /s alias (the site's CloudFront behaviour) serves the same page", async () => {
    const { res } = await raw(`/s/${ids.normal}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^text\/html/);
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
  });

  test("unknown ids, bad ids and inactive games are 404", async () => {
    for (const id of ["00000000-0000-4000-8000-000000000000", "not-a-uuid", ids.inactive]) {
      const res = await api.request("GET", `/share/${id}`);
      expect(res.status).toBe(404);
      expect(String(res.body)).toContain("location.replace");
    }
  });
});

describe("POST /scores → share link", () => {
  test("the score response carries the play id the card is made from", async () => {
    const saved = await api.request("POST", "/scores", {
      as: "tilly",
      body: { gameId: "test-game", score: 40, durationMs: 10_000, tzOffsetMinutes: 0 },
    });
    expect(saved.status).toBe(200);
    expect(saved.body.playId).toMatch(/^[0-9a-f-]{36}$/);
    const page = await api.request("GET", `/s/${saved.body.playId}`);
    expect(ogTitle(String(page.body))).toBe("Tilly &lt;3 scored 40 on Test Game!");
  });
});

describe("GET /share/:playId.json", () => {
  test("gives only the game, for the app's /s route", async () => {
    const res = await api.request("GET", `/share/${ids.normal}.json`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ gameId: "test-game" });
    expect((await api.request("GET", `/share/${ids.inactive}.json`)).status).toBe(404);
  });
});

describe("GET /share/:playId.png", () => {
  test("is a cached 1200×630 PNG", async () => {
    const { res, bytes } = await raw(`/s/${ids.normal}.png`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toBe("public, max-age=86400");
    // PNG signature, then the IHDR chunk: width and height as big-endian uint32.
    expect(Array.from(bytes.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(new TextDecoder().decode(bytes.slice(12, 16))).toBe("IHDR");
    const view = new DataView(bytes.buffer, bytes.byteOffset);
    expect(view.getUint32(16)).toBe(1200);
    expect(view.getUint32(20)).toBe(630);
  });

  test("renders for deleted players and remixes too", async () => {
    for (const key of ["anon", "remix"]) {
      const { res } = await raw(`/share/${ids[key]}.png`);
      expect(res.status).toBe(200);
    }
  });

  test("is 404 for unknown plays and inactive games", async () => {
    expect((await raw(`/share/${ids.inactive}.png`)).res.status).toBe(404);
    expect((await raw("/share/nope.png")).res.status).toBe(404);
  });
});
