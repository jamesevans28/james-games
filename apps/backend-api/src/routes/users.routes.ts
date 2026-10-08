import { Router } from "express";
import {
  changeScreenName,
  checkScreenName,
  updatePreferences,
  updateSettings,
  getPublicProfile,
} from "../controllers/usersController.js";
import { recordStreakCheckin, getStreak } from "../controllers/streakController.js";
import { getMyStickers } from "../controllers/stickersController.js";
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
router.get("/stickers", requireAuth, getMyStickers); // weekly stickers, newest first (T7.5)

// Public profile summary
router.get("/:userId", getPublicProfile);

export default router;
