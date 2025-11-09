import { Router } from "express";
import {
  me,
  startEmailUpdate,
  verifyEmail,
  changeScreenName,
  updatePreferences,
  updateSettings,
} from "../controllers/usersController.js";
import { requireAuth } from "../middleware/authGuards.js";

const router = Router();

// Logged-in protected
router.get("/me", requireAuth, me);
router.post("/email", requireAuth, startEmailUpdate);
router.post("/email/verify", requireAuth, verifyEmail);
router.post("/screen-name", requireAuth, changeScreenName);
router.patch("/preferences", requireAuth, updatePreferences);
router.patch("/settings", requireAuth, updateSettings); // unified settings endpoint (screenName for now)

// Public minimal profile by id
router.get("/:userId", async (req, res) => {
  // Keep minimal public route available via controller in the future
  res.status(501).json({ error: "not_implemented" });
});

export default router;
