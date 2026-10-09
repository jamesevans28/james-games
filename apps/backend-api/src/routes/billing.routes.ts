import { Router } from "express";
import { mySupporterStatus } from "../controllers/billingController.js";
import { requireAuth } from "../middleware/authGuards.js";

// The Stripe webhook needs the raw body, so it's mounted in index.ts before express.json.
const router = Router();
router.get("/supporter", requireAuth, mySupporterStatus);
export default router;
