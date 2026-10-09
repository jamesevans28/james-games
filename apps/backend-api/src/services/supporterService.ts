/**
 * Family supporters (T12.2). A grown-up buys once through a Stripe Payment Link
 * (a hosted page; no Stripe SDK); Stripe calls our webhook; we record the supporter
 * and give the "supporter" sticker. Perks are cosmetic only: gold avatars, the
 * sticker, a gold name on leaderboards. Ko-fi supporters are granted by an admin.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { getDb } from "../db/client.js";
import { grantSupporter, isSupporter } from "../repos/supportersRepo.js";
import { awardSticker } from "../repos/stickersRepo.js";
import { getUserById } from "../repos/usersRepo.js";

/** Avatars from this id up are the supporters' gold set (apps/player-web/src/config/avatars.ts). */
export const SUPPORTER_AVATAR_MIN = 101;
export const SUPPORTER_STICKER = "supporter";

/** Stripe signs `${timestamp}.${rawBody}` with the endpoint secret (HMAC-SHA256). */
export function verifyStripeSignature(
  rawBody: string,
  header: string | undefined,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
): boolean {
  if (!header || !secret) return false;
  const parts = header.split(",").map((p) => p.trim().split("="));
  const timestamp = Number(parts.find(([k]) => k === "t")?.[1]);
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v ?? "");
  if (!Number.isFinite(timestamp) || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest();
  return signatures.some((sig) => {
    const given = Buffer.from(sig, "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

type StripeEvent = {
  type?: string;
  data?: { object?: { id?: string; client_reference_id?: string | null; payment_status?: string } };
};

/** What the webhook did, for the log (no ids). */
export type WebhookOutcome = "granted" | "duplicate" | "ignored" | "unknown_user";

export async function handleStripeEvent(event: StripeEvent): Promise<WebhookOutcome> {
  if (event.type !== "checkout.session.completed") return "ignored";
  const session = event.data?.object;
  const userId = session?.client_reference_id ?? undefined;
  if (!session?.id || !userId || session.payment_status === "unpaid") return "ignored";
  if (!(await getUserById(userId))) return "unknown_user";
  return grant(userId, "stripe", session.id);
}

export async function grant(
  userId: string,
  source: "stripe" | "apple" | "google" | "manual",
  externalId: string,
): Promise<"granted" | "duplicate"> {
  return getDb().transaction(async (tx) => {
    const added = await grantSupporter(tx, { userId, source, externalId });
    await awardSticker(tx, { userId, stickerId: SUPPORTER_STICKER, earnedAt: new Date() });
    return added ? "granted" : "duplicate";
  });
}

export async function supporterStatus(userId: string): Promise<{ supporter: boolean }> {
  return { supporter: await isSupporter(userId) };
}

/** Gold avatars are for supporters' families only. */
export async function canUseAvatar(userId: string, avatar: number): Promise<boolean> {
  return avatar < SUPPORTER_AVATAR_MIN || isSupporter(userId);
}

type RevenueCatEvent = {
  event?: {
    type?: string;
    app_user_id?: string;
    product_id?: string;
    store?: string;
    transaction_id?: string;
  };
};

const RC_PURCHASES = new Set(["INITIAL_PURCHASE", "NON_RENEWING_PURCHASE"]);
export const SUPPORTER_PRODUCT_ID = "family_supporter";

/**
 * RevenueCat's webhook (T12.3): a store purchase of the supporter product. The app
 * sets RevenueCat's app user id to our Firebase uid, so app_user_id is the player.
 */
export async function handleRevenueCatEvent(body: RevenueCatEvent): Promise<WebhookOutcome> {
  const e = body.event;
  if (!e?.type || !RC_PURCHASES.has(e.type) || e.product_id !== SUPPORTER_PRODUCT_ID) {
    return "ignored";
  }
  const source = e.store === "APP_STORE" ? "apple" : e.store === "PLAY_STORE" ? "google" : null;
  if (!source || !e.app_user_id || !e.transaction_id) return "ignored";
  if (!(await getUserById(e.app_user_id))) return "unknown_user";
  return grant(e.app_user_id, source, e.transaction_id);
}

/** RevenueCat sends the Authorization header we configure in its dashboard. */
export function revenueCatAuthorized(header: string | undefined, secret: string): boolean {
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}
