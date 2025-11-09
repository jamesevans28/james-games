import { Router } from "express";
import { requireAuth } from "../middleware/authGuards.js";

const router = Router();

// Placeholder for ratings feature
router.get("/ping", requireAuth, (_req, res) => res.json({ ok: true }));

export default router;
