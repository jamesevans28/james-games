import { Router } from "express";
import authRoutes from "./auth.routes.js";
import usersRoutes from "./users.routes.js";
import scoresRoutes from "./scores.routes.js";
import followersRoutes from "./followers.routes.js";
import rewardsRoutes from "./rewards.routes.js";
import shopRoutes from "./shop.routes.js";
import ratingsRoutes from "./ratings.routes.js";
import experienceRoutes from "./experience.routes.js";
import { requireAuth } from "../middleware/authGuards.js";
import { me } from "../controllers/usersController.js";

const router = Router();

// Mount feature route modules
// Backwards-compatible top-level /me route (keeps SPA calls working)
router.get("/me", requireAuth, me);

router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/scores", scoresRoutes);
router.use("/followers", followersRoutes);
router.use("/rewards", rewardsRoutes);
router.use("/shop", shopRoutes);
router.use("/ratings", ratingsRoutes);
router.use("/experience", experienceRoutes);

export default router;
