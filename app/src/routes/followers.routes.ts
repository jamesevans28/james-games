import { Router } from "express";
import { requireAuth } from "../middleware/authGuards.js";

const router = Router();

// Placeholder endpoints for followers feature
router.get("/ping", requireAuth, (_req, res) => res.json({ ok: true }));

export default router;
