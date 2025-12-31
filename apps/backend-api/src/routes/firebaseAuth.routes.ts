// Firebase Authentication Routes
import { Router } from "express";
import {
  registerWithUsername,
  loginWithUsername,
  registerAnonymous,
  linkProvider,
  changePin,
  getCurrentUser,
  addEmail,
  sendVerificationEmail,
  checkEmailVerifiedStatus,
} from "../controllers/firebaseAuthController.js";
import { attachUser, requireAuth, requireRegisteredAccount } from "../middleware/authGuards.js";

const router = Router();

// Public routes (no auth required)
router.post("/register-anonymous", registerAnonymous);
router.post("/register-username", registerWithUsername);
router.post("/login-username", loginWithUsername);

// Authenticated routes
router.use(attachUser);
router.get("/me", requireAuth, getCurrentUser);
router.post("/link-provider", requireAuth, linkProvider);
router.post("/change-pin", requireAuth, requireRegisteredAccount, changePin);
router.post("/add-email", requireAuth, addEmail);
router.post("/send-verification", requireAuth, sendVerificationEmail);
router.post("/check-email-verified", requireAuth, checkEmailVerifiedStatus);

export default router;
