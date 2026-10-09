import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { startTestApp, type TestApp } from "../test/app.js";
import { config } from "../config/index.js";
import { familyLinks, supporters, userStickers } from "../db/schema.js";
import { verifyStripeSignature } from "../services/supporterService.js";

const SECRET = "whsec_test_secret";
let api: TestApp;

beforeAll(async () => {
  (config as { stripeWebhookSecret: string }).stripeWebhookSecret = SECRET;
  api = await startTestApp();
});
afterAll(() => api.close());

function signed(body: object, secret = SECRET, t = Math.floor(Date.now() / 1000)) {
  const raw = JSON.stringify(body);
  const sig = createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  return { raw, header: `t=${t},v1=${sig}` };
}

async function postWebhook(raw: string, header: string) {
  const res = await fetch(`${api.base}/billing/stripe/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": header },
    body: raw,
  });
  return res.status;
}

const checkout = (userId: string, id = "cs_test_1") => ({
  type: "checkout.session.completed",
  data: { object: { id, client_reference_id: userId, payment_status: "paid" } },
});

describe("Stripe supporter webhook (T12.2)", () => {
  test("signature check: tampered, wrong secret and stale signatures fail", () => {
    const { raw, header } = signed({ a: 1 });
    expect(verifyStripeSignature(raw, header, SECRET)).toBe(true);
    expect(verifyStripeSignature(raw + " ", header, SECRET)).toBe(false);
    expect(verifyStripeSignature(raw, header, "whsec_other")).toBe(false);
    const old = signed({ a: 1 }, SECRET, Math.floor(Date.now() / 1000) - 3600);
    expect(verifyStripeSignature(old.raw, old.header, SECRET)).toBe(false);
    expect(verifyStripeSignature(raw, undefined, SECRET)).toBe(false);
  });

  test("a bad signature is rejected and grants nothing", async () => {
    await api.addUser({ id: "mum" });
    const { raw } = signed(checkout("mum"));
    expect(await postWebhook(raw, "t=1,v1=00")).toBe(400);
    expect(await api.db.select().from(supporters)).toHaveLength(0);
  });

  test("a paid checkout makes a supporter once, with the sticker; the family gets gold avatars", async () => {
    await api.addUser({ id: "kid" });
    await api.db.insert(familyLinks).values({ parentUserId: "mum", childUserId: "kid" });
    const { raw, header } = signed(checkout("mum"));
    expect(await postWebhook(raw, header)).toBe(200);
    expect(await postWebhook(raw, header)).toBe(200); // Stripe retries: still one row
    expect(await api.db.select().from(supporters)).toHaveLength(1);
    const stickers = await api.db.select().from(userStickers).where(eq(userStickers.userId, "mum"));
    expect(stickers.map((s) => s.stickerId)).toContain("supporter");

    const status = await api.request("GET", "/billing/supporter", { as: "kid" });
    expect(status.body).toEqual({ supporter: true });
    const gold = await api.request("POST", "/users/preferences", {
      as: "kid",
      body: { avatar: 101 },
    });
    expect(gold.status).toBe(200);
  });

  test("non-supporters can't pick gold avatars", async () => {
    await api.addUser({ id: "stranger" });
    const res = await api.request("POST", "/users/preferences", {
      as: "stranger",
      body: { avatar: 101 },
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("supporter_only");
  });

  test("admins grant and revoke by hand", async () => {
    await api.addUser({ id: "boss", admin: true });
    await api.addUser({ id: "kofi-fan" });
    const granted = await api.request("POST", "/admin/users/kofi-fan/supporter", { as: "boss" });
    expect(granted.body).toMatchObject({ ok: true, outcome: "granted" });
    const revoked = await api.request("DELETE", "/admin/users/kofi-fan/supporter", { as: "boss" });
    expect(revoked.body).toEqual({ ok: true });
    expect(
      (await api.request("POST", "/admin/users/kofi-fan/supporter", { as: "kofi-fan" })).status,
    ).toBe(403);
  });
});
