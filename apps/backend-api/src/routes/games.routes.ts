import { Router } from "express";
import { list as listConfigs, show as getConfig } from "../controllers/gamesConfigController.js";

const router = Router();

router.get("/config", listConfigs);
router.get("/config/:gameId", getConfig);

export default router;
