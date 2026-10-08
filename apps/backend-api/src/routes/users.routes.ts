import { Router } from "express";
import {
  changeScreenName,
  checkScreenName,
  updatePreferences,
  updateSettings,
  getPublicProfile,
} from "../controllers/usersController.js";
import { recordStreakCheckin, getStreak } from "../controllers/streakController.js";
import { requireAuth } from "../middleware/authGuards.js";

const router = Router();

// The caller's own account
router.get("/screen-name/check", requireAuth, checkScreenName);
router.post("/screen-name", requireAuth, changeScreenName);
router.post("/preferences", requireAuth, updatePreferences); // { avatar?, preferences? }
router.patch("/settings", requireAuth, updateSettings); // { screenName }

// Streak tracking
router.get("/streak", requireAuth, getStreak);
router.post("/streak/checkin", requireAuth, recordStreakCheckin);

// Public profile summary
router.get("/:userId", getPublicProfile);

export default router;
