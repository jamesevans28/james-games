import { Router } from "express";
import { requireAuth } from "../middleware/authGuards.js";
import {
	getRatingSummaryController,
	listRatingSummaries,
	submitRating,
} from "../controllers/ratingsController.js";

const router = Router();

router.get("/", listRatingSummaries);
router.get("/:gameId", getRatingSummaryController);
router.post("/:gameId", requireAuth, submitRating);

export default router;
