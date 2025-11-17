import { Router } from "express";
import { requireAuth } from "../middleware/authGuards.js";
import {
	followUserHandler,
	unfollowUserHandler,
	getFollowersSummary,
	getFollowingList,
	getFollowersList,
	updatePresenceHandler,
	getFollowingActivity,
	getFollowingIdsHandler,
	getFollowNotifications,
} from "../controllers/followersController.js";

const router = Router();

router.get("/summary", requireAuth, getFollowersSummary);
router.get("/following", requireAuth, getFollowingList);
router.get("/followers", requireAuth, getFollowersList);
router.get("/activity", requireAuth, getFollowingActivity);
router.get("/ids", requireAuth, getFollowingIdsHandler);
router.get("/notifications", requireAuth, getFollowNotifications);
router.post("/status", requireAuth, updatePresenceHandler);
router.post("/:targetUserId", requireAuth, followUserHandler);
router.delete("/:targetUserId", requireAuth, unfollowUserHandler);

export default router;
