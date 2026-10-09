import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/authGuards.js";
import {
  index as listUsers,
  show as getUser,
  update as updateUser,
  resetName as resetScreenName,
  nameChanges as listNameChanges,
  grantSupport,
  revokeSupport,
  disable as disableUser,
  enable as enableUser,
  removePlay as deletePlay,
} from "../controllers/adminUsersController.js";
import {
  adminList as listGames,
  adminShow as getGame,
  adminUpdate as updateGame,
} from "../controllers/gamesConfigController.js";
import { show as getGameStats } from "../controllers/adminGameStatsController.js";
import { dashboard as getDashboardMetrics } from "../controllers/adminMetricsController.js";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/users", listUsers);
router.get("/users/:userId", getUser);
router.patch("/users/:userId", updateUser);
router.put("/users/:userId", updateUser);
router.post("/users/:userId", updateUser);
router.post("/users/:userId/reset-screen-name", resetScreenName);
router.get("/screen-names", listNameChanges);
router.post("/users/:userId/supporter", grantSupport);
router.delete("/users/:userId/supporter", revokeSupport);
router.post("/users/:userId/disable", disableUser);
router.post("/users/:userId/enable", enableUser);
router.delete("/plays/:playId", deletePlay);

router.get("/games", listGames);
router.get("/games/:gameId", getGame);
router.get("/games/:gameId/stats", getGameStats);
router.patch("/games/:gameId", updateGame);
router.put("/games/:gameId", updateGame);
router.post("/games/:gameId", updateGame);
router.get("/metrics/dashboard", getDashboardMetrics);

export default router;
