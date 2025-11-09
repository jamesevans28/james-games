import { Router } from "express";
import { signup, signin, loginRedirect, logout } from "../controllers/authController.js";

const router = Router();

// Public routes
router.post("/local-signup", signup);
router.post("/local-signin", signin);
router.get("/login", loginRedirect);
router.get("/logout", logout);

export default router;
