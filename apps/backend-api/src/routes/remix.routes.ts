import { Router } from "express";
import { requireAuth, requireRegisteredAccount } from "../middleware/authGuards.js";
import {
  createRemix,
  getRemix,
  listMine,
  listRemixScores,
} from "../controllers/remixController.js";

/** Remix mode (T11.2). Saving needs a registered account; a shared link is public. */
const router = Router();

router.post("/", requireRegisteredAccount, createRemix);
router.get("/mine", requireAuth, listMine);
router.get("/:id", getRemix);
router.get("/:id/scores", listRemixScores);

export default router;
