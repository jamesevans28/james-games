import { Router } from "express";
import firebaseAuthRoutes from "./firebaseAuth.routes.js";
import usersRoutes from "./users.routes.js";
import scoresRoutes from "./scores.routes.js";
import followersRoutes from "./followers.routes.js";
import ratingsRoutes from "./ratings.routes.js";
import experienceRoutes from "./experience.routes.js";
import adminRoutes from "./admin.routes.js";
import gamesRoutes from "./games.routes.js";
import familyRoutes from "./family.routes.js";
import remixRoutes from "./remix.routes.js";
import dailyRoutes from "./daily.routes.js";
import shareRoutes from "./share.routes.js";
import { requireAuth } from "../middleware/authGuards.js";
import { changeScreenName, me } from "../controllers/usersController.js";
import { deleteMe } from "../controllers/firebaseAuthController.js";

const router = Router();

// The signed-in user's own account. GET /auth/firebase/me is the same handler.
router.get("/me", requireAuth, me);
router.patch("/me/screen-name", requireAuth, changeScreenName);
router.delete("/me", requireAuth, deleteMe); // T7.8 account deletion

// Firebase auth routes
router.use("/auth/firebase", firebaseAuthRoutes);

router.use("/users", usersRoutes);
router.use("/scores", scoresRoutes);
router.use("/followers", followersRoutes);
router.use("/ratings", ratingsRoutes);
router.use("/experience", experienceRoutes);
router.use("/admin", adminRoutes);
router.use("/games", gamesRoutes);
router.use("/family", familyRoutes); // T11.7
router.use("/remixes", remixRoutes); // T11.2
router.use("/daily", dailyRoutes); // T11.3
// T11.5 share cards; /s is the same, for the site's /s/* CloudFront behaviour.
router.use("/share", shareRoutes);
router.use("/s", shareRoutes);

export default router;
