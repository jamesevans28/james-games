import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { familyCodes, familyLinks, plays } from "../db/schema.js";
import { startTestApp, type TestApp } from "../test/app.js";

describe("/family (T11.7)", () => {
  let api: TestApp;

  const makeCode = async (as: string) => {
    const res = await api.request("POST", "/family/codes", { as });
    expect(res.status).toBe(200);
    return res.body.code as string;
  };
  const join = (as: string, code: unknown) =>
    api.request("POST", "/family/join", { as, body: { code } });

  beforeAll(async () => {
    api = await startTestApp();
    for (const id of ["mum", "dad", "gran", "tilly", "harvey", "rando"]) {
      await api.addUser({ id, screenName: `${id}-name`, email: `${id}@example.com` });
    }
    await api.addUser({ id: "guest", accountType: "anonymous" });
  });
  afterAll(() => api.close());

  it("needs sign-in, and a username account to make or use a code", async () => {
    expect((await api.request("GET", "/family")).status).toBe(401);
    expect((await api.request("POST", "/family/codes")).status).toBe(401);
    const guestCode = await api.request("POST", "/family/codes", {
      as: "guest",
      accountType: "anonymous",
    });
    expect(guestCode).toMatchObject({ status: 403, body: { error: "account_upgrade_required" } });
    const guestJoin = await api.request("POST", "/family/join", {
      as: "guest",
      accountType: "anonymous",
      body: { code: "ABC234" },
    });
    expect(guestJoin.status).toBe(403);
  });

  it("makes a 6-character code valid for 15 minutes; a new one replaces the old", async () => {
    const before = Date.now();
    const res = await api.request("POST", "/family/codes", { as: "mum" });
    expect(res.body.code).toMatch(/^[2-9A-Z]{6}$/);
    const ttl = Date.parse(res.body.expiresAt) - before;
    expect(ttl).toBeGreaterThan(14 * 60_000);
    expect(ttl).toBeLessThanOrEqual(15 * 60_000 + 1000);
    const again = await makeCode("mum");
    const rows = await api.db.select().from(familyCodes).where(eq(familyCodes.parentUserId, "mum"));
    expect(rows.map((r) => r.code)).toEqual([again]);
    expect((await join("tilly", res.body.code)).body).toEqual({ error: "code_not_found" });
  });

  it("links a kid with a code, once, and the code is used up", async () => {
    const code = await makeCode("mum");
    const res = await join("tilly", code.toLowerCase());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ grownUp: { userId: "mum", screenName: "mum-name", avatar: 1 } });
    expect(JSON.stringify(res.body)).not.toContain("@example.com");
    expect((await join("harvey", code)).status).toBe(404);
  });

  it("refuses an expired code", async () => {
    const code = await makeCode("dad");
    await api.db
      .update(familyCodes)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(familyCodes.code, code));
    expect(await join("tilly", code)).toMatchObject({
      status: 410,
      body: { error: "code_expired" },
    });
  });

  it("refuses linking to yourself", async () => {
    const code = await makeCode("rando");
    expect(await join("rando", code)).toMatchObject({
      status: 400,
      body: { error: "cant_link_self" },
    });
  });

  it("allows at most two grown-ups per kid", async () => {
    expect((await join("tilly", await makeCode("dad"))).status).toBe(200);
    expect(await join("tilly", await makeCode("gran"))).toMatchObject({
      status: 409,
      body: { error: "too_many_grown_ups" },
    });
    // Typing a code from a grown-up you already have is fine.
    expect((await join("tilly", await makeCode("mum"))).status).toBe(200);
    const links = await api.db
      .select()
      .from(familyLinks)
      .where(eq(familyLinks.childUserId, "tilly"));
    expect(links.map((l) => l.parentUserId).sort()).toEqual(["dad", "mum"]);
  });

  it("shows the grown-up each kid's plays and play time per local day", async () => {
    expect((await join("harvey", await makeCode("mum"))).status).toBe(200);
    const now = Date.now();
    await api.db.insert(plays).values([
      { userId: "tilly", gameId: "test-game", score: 5, durationMs: 60_000 },
      { userId: "tilly", gameId: "test-game", score: 7, durationMs: 30_000 },
      { userId: "tilly", gameId: "test-game", score: 1, durationMs: null },
      // Too old for the week.
      {
        userId: "tilly",
        gameId: "test-game",
        score: 9,
        durationMs: 99_000,
        createdAt: new Date(now - 10 * 86_400_000),
      },
      // Not mum's kid.
      { userId: "rando", gameId: "test-game", score: 9, durationMs: 99_000 },
    ]);

    const res = await api.request("GET", "/family?tzOffsetMinutes=600", { as: "mum" });
    expect(res.status).toBe(200);
    expect(res.body.grownUps).toEqual([]);
    expect(res.body.kids.map((k: { userId: string }) => k.userId)).toEqual(["tilly", "harvey"]);
    const tilly = res.body.kids[0];
    expect(tilly.days).toHaveLength(7);
    expect(tilly.days[6]).toMatchObject({ plays: 3, playMs: 90_000 });
    expect(tilly).toMatchObject({ screenName: "tilly-name", totalPlays: 3, totalPlayMs: 90_000 });
    expect(res.body.kids[1]).toMatchObject({ totalPlays: 0, totalPlayMs: 0 });
    expect(JSON.stringify(res.body)).not.toContain("@example.com");

    // The kid sees their grown-ups, but no one's play time.
    const kidView = await api.request("GET", "/family", { as: "tilly" });
    expect(kidView.body.kids).toEqual([]);
    expect(kidView.body.grownUps.map((g: { userId: string }) => g.userId).sort()).toEqual([
      "dad",
      "mum",
    ]);
  });

  it("only a linked grown-up can unlink", async () => {
    expect((await api.request("DELETE", "/family/kids/tilly", { as: "rando" })).status).toBe(404);
    // The kid can't remove their grown-up from this route (it's keyed by the grown-up).
    expect((await api.request("DELETE", "/family/kids/mum", { as: "tilly" })).status).toBe(404);
    const res = await api.request("DELETE", "/family/kids/tilly", { as: "dad" });
    expect(res).toMatchObject({ status: 200, body: { ok: true } });
    const dadView = await api.request("GET", "/family", { as: "dad" });
    expect(dadView.body.kids).toEqual([]);
    // With a free slot again, gran can now be linked.
    expect((await join("tilly", await makeCode("gran"))).status).toBe(200);
  });

  it("throttles wrong codes", async () => {
    for (let i = 0; i < 10; i++) {
      expect((await join("harvey", "ZZZZZZ")).status).toBe(404);
    }
    expect(await join("harvey", "ZZZZZZ")).toMatchObject({
      status: 429,
      body: { error: "too_many_tries" },
    });
  });
});
