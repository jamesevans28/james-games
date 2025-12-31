import { Router } from "express";
import {
  me,
  changeScreenName,
  updatePreferences,
  updateSettings,
  getPublicProfile,
} from "../controllers/usersController.js";
import { requireAuth } from "../middleware/authGuards.js";

const router = Router();

// Logged-in protected
router.get("/me", requireAuth, me);
// Note: Email update/verification is now handled through Firebase Auth linked providers.
router.post("/screen-name", requireAuth, changeScreenName);
router.post("/preferences", requireAuth, updatePreferences);
router.patch("/settings", requireAuth, updateSettings); // unified settings endpoint (screenName for now)

// Public profile summary
router.get("/:userId", getPublicProfile);

export default router;
