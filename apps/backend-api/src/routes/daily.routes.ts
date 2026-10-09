import { Router } from "express";
import { getDaily } from "../controllers/dailyController.js";

const router = Router();

// Today's challenge and its board (T11.3). Daily runs are saved by POST /scores { daily: true }.
router.get("/", getDaily);

export default router;
