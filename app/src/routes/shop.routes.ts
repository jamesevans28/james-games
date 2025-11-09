import { Router } from "express";
import { requireValidatedEmail } from "../middleware/authGuards.js";

const router = Router();

// Placeholder for shop (requires validated email)
router.get("/ping", requireValidatedEmail, (_req, res) => res.json({ ok: true }));

export default router;
