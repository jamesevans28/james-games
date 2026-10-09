import type { Request, Response } from "express";
import { config } from "../config/index.js";
import { buildMissingShareHtml, buildShareHtml, getShareCard } from "../services/shareCard.js";
import { renderSharePng } from "../services/shareCardImage.js";
import { sendServerError } from "../lib/http.js";

/**
 * Share cards (T11.5). Public, no sign-in. Mounted at /share and at /s (the
 * site's /s/* CloudFront behaviour forwards to the API unchanged; see
 * infra/cloudfront/README.md). Cards change only if a name changes, so they cache.
 */

const PAGE_CACHE = "public, max-age=3600";
const IMAGE_CACHE = "public, max-age=86400";
const MISSING_CACHE = "public, max-age=300";

function siteHost(): string {
  try {
    return new URL(config.publicSiteOrigin).host;
  } catch {
    return config.publicSiteOrigin;
  }
}

/** GET /share/:playId: the link-preview page; people are sent on to the game. */
export async function sharePage(req: Request, res: Response) {
  try {
    const card = await getShareCard(String(req.params.playId));
    res.type("html");
    if (!card) {
      return res
        .status(404)
        .set("Cache-Control", MISSING_CACHE)
        .send(buildMissingShareHtml(config.publicSiteOrigin));
    }
    res.set("Cache-Control", PAGE_CACHE).send(buildShareHtml(card, config.publicSiteOrigin));
  } catch (e) {
    sendServerError(res, "share_page_failed", e);
  }
}

/** GET /share/:playId.png: the 1200×630 card image. */
export async function shareImage(req: Request, res: Response) {
  try {
    const card = await getShareCard(String(req.params.playId));
    if (!card) {
      return res.status(404).set("Cache-Control", MISSING_CACHE).json({ error: "not_found" });
    }
    const png = await renderSharePng(card, siteHost());
    res.type("png").set("Cache-Control", IMAGE_CACHE).send(png);
  } catch (e) {
    sendServerError(res, "share_image_failed", e);
  }
}

/** GET /share/:playId.json: just the game, for the app's /s/:playId route. */
export async function shareInfo(req: Request, res: Response) {
  try {
    const card = await getShareCard(String(req.params.playId));
    if (!card) return res.status(404).json({ error: "not_found" });
    res.set("Cache-Control", PAGE_CACHE).json({ gameId: card.gameId });
  } catch (e) {
    sendServerError(res, "share_info_failed", e);
  }
}
