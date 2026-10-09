import { Router } from "express";
import { requireAuth, requireRegisteredAccount } from "../middleware/authGuards.js";
import {
  createCodeHandler,
  getFamilyHandler,
  joinHandler,
  unlinkHandler,
} from "../controllers/familyController.js";

/** Family links (T11.7): a grown-up sees a linked kid's play time. */
const router = Router();

router.get("/", requireAuth, getFamilyHandler);
// Both sides need a username account: a guest account can vanish.
router.post("/codes", requireRegisteredAccount, createCodeHandler);
router.post("/join", requireRegisteredAccount, joinHandler); // { code }
router.delete("/kids/:childId", requireAuth, unlinkHandler);

export default router;
