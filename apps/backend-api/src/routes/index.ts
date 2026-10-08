import { Router } from "express";
import firebaseAuthRoutes from "./firebaseAuth.routes.js";
import usersRoutes from "./users.routes.js";
import scoresRoutes from "./scores.routes.js";
import followersRoutes from "./followers.routes.js";
import ratingsRoutes from "./ratings.routes.js";
import experienceRoutes from "./experience.routes.js";
import adminRoutes from "./admin.routes.js";
import gamesRoutes from "./games.routes.js";
import { requireAuth } from "../middleware/authGuards.js";
import { changeScreenName, me } from "../controllers/usersController.js";

const router = Router();

// The signed-in user's own account. GET /auth/firebase/me is the same handler.
router.get("/me", requireAuth, me);
router.patch("/me/screen-name", requireAuth, changeScreenName);

// Firebase auth routes
router.use("/auth/firebase", firebaseAuthRoutes);

router.use("/users", usersRoutes);
router.use("/scores", scoresRoutes);
router.use("/followers", followersRoutes);
router.use("/ratings", ratingsRoutes);
router.use("/experience", experienceRoutes);
router.use("/admin", adminRoutes);
router.use("/games", gamesRoutes);

export default router;
