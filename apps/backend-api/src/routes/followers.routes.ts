import { Router } from "express";
import { requireAuth, requireRegisteredAccount } from "../middleware/authGuards.js";
import {
  acceptRequest,
  blockHandler,
  declineRequest,
  getRequests,
  getSummary,
  removeFriendHandler,
  reportPresenceHandler,
  sendRequest,
  unblockHandler,
} from "../controllers/followersController.js";

/** Friends (T7.6). There is deliberately no public list of anyone's friends. */
const router = Router();

router.get("/summary", requireAuth, getSummary);
router.get("/requests", requireAuth, getRequests);
// Guests can't make or accept friends: they need a username first.
router.post("/request", requireRegisteredAccount, sendRequest); // { friendCode }
router.post("/requests/:userId/accept", requireRegisteredAccount, acceptRequest);
router.delete("/requests/:userId", requireAuth, declineRequest);
router.delete("/friends/:userId", requireAuth, removeFriendHandler);
router.post("/block/:userId", requireAuth, blockHandler);
router.delete("/block/:userId", requireAuth, unblockHandler);
router.post("/status", requireAuth, reportPresenceHandler);

export default router;
