import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/authGuards.js";
import {
  index as listUsers,
  show as getUser,
  update as updateUser,
} from "../controllers/adminUsersController.js";
import {
  list as listGames,
  create as createGame,
  show as getGame,
  update as updateGame,
} from "../controllers/gamesConfigController.js";
import { show as getGameStats } from "../controllers/adminGameStatsController.js";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/users", listUsers);
router.get("/users/:userId", getUser);
router.patch("/users/:userId", updateUser);

router.get("/games", listGames);
router.post("/games", createGame);
router.get("/games/:gameId", getGame);
router.get("/games/:gameId/stats", getGameStats);
router.patch("/games/:gameId", updateGame);

export default router;
