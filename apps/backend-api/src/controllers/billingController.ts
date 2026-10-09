import type { Request, Response } from "express";
import { config } from "../config/index.js";
import { log } from "../lib/log.js";
import { sendServerError } from "../lib/http.js";
import {
  handleStripeEvent,
  supporterStatus,
  verifyStripeSignature,
} from "../services/supporterService.js";

/**
 * POST /billing/stripe/webhook (raw body, mounted before express.json). Answers 400
 * for a bad signature so Stripe shows it as failed; 200 for everything else so it
 * doesn't retry events we chose to ignore.
 */
export async function stripeWebhook(req: Request, res: Response) {
  const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
  if (!verifyStripeSignature(raw, req.header("stripe-signature"), config.stripeWebhookSecret)) {
    log.warn("stripe_webhook_bad_signature");
    return res.status(400).json({ error: "bad_signature" });
  }
  try {
    const outcome = await handleStripeEvent(
      JSON.parse(raw) as Parameters<typeof handleStripeEvent>[0],
    );
    log.info("stripe_webhook", { outcome });
    return res.json({ received: true });
  } catch (e) {
    return sendServerError(res, "stripe_webhook_failed", e);
  }
}

/** GET /billing/supporter: is this player (or their family) a supporter? */
export async function mySupporterStatus(req: Request, res: Response) {
  const uid = req.user?.userId;
  if (!uid) return res.status(401).json({ error: "unauthorized" });
  try {
    return res.json(await supporterStatus(uid));
  } catch (e) {
    return sendServerError(res, "supporter_status_failed", e);
  }
}
