import { Router } from "express";
import { requireAuth } from "../middleware/authGuards.js";
import { getExperienceSummaryHandler, recordGameExperience } from "../controllers/experienceController.js";

const router = Router();

router.get("/summary", requireAuth, getExperienceSummaryHandler);
router.post("/runs", requireAuth, recordGameExperience);

export default router;
