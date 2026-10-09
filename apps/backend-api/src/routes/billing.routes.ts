import { Router } from "express";
import { mySupporterStatus, revenueCatWebhook } from "../controllers/billingController.js";
import { requireAuth } from "../middleware/authGuards.js";

// The Stripe webhook needs the raw body, so it's mounted in index.ts before express.json.
const router = Router();
router.get("/supporter", requireAuth, mySupporterStatus);
router.post("/revenuecat/webhook", (req, res) => void revenueCatWebhook(req, res));
export default router;
