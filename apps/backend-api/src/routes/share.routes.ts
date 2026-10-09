import { Router } from "express";
import { shareImage, shareInfo, sharePage } from "../controllers/shareController.js";

// Share cards (T11.5). Public. The suffixed routes come first: "/:playId" would
// otherwise match "<id>.png" too.
const router = Router();

router.get("/:playId.png", shareImage);
router.get("/:playId.json", shareInfo);
router.get("/:playId", sharePage);

export default router;
