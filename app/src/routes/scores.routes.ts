import { Router } from "express";
import { createScore, listScores } from "../controllers/scoresController.js";
import { requireAuth } from "../middleware/authGuards.js";

const router = Router();

// Public list top scores
router.get("/:gameId", listScores);

// Logged in required to post
router.post("/", requireAuth, createScore);

export default router;
