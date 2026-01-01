import { Router } from "express";
import { list as listConfigs, show as getConfig } from "../controllers/gamesConfigController.js";
import { getFeed, getPersonalizedFeed } from "../controllers/feedController.js";
import { requireAuth } from "../middleware/authGuards.js";

const router = Router();

router.get("/config", listConfigs);
router.get("/config/:gameId", getConfig);

// Feed routes
router.get("/feed", getFeed);
router.get("/feed/personalized", requireAuth, getPersonalizedFeed);

export default router;
