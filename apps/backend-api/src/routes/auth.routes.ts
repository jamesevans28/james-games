// Auth routes (Supabase, Phase 14). attachUser runs globally (src/index.ts), so req.user is the
// verified bearer token's user wherever a route needs it.
import { Router } from "express";
import {
  registerWithUsername,
  loginWithUsername,
  registerAnonymous,
  linkProvider,
  changePin,
  adminResetUserPin,
} from "../controllers/authController.js";
import { me } from "../controllers/usersController.js";
import { requireAdmin, requireAuth, requireRegisteredAccount } from "../middleware/authGuards.js";

const router = Router();

// Public
router.post("/login-username", loginWithUsername);

// The caller's own account (bearer token required)
router.post("/register-anonymous", requireAuth, registerAnonymous);
router.post("/register-username", requireAuth, registerWithUsername);
router.get("/me", requireAuth, me); // same handler and shape as GET /me
router.post("/link-provider", requireAuth, linkProvider);
router.post("/change-pin", requireAuth, requireRegisteredAccount, changePin);

// Admin
router.post("/admin/reset-pin", requireAdmin, adminResetUserPin);

export default router;
