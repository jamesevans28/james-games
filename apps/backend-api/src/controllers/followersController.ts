import type { Request, Response } from "express";
import {
  FollowersError,
  acceptFriendRequest,
  blockPlayer,
  declineFriendRequest,
  getFriendsSummary,
  listFriendRequests,
  removeFriend,
  reportPresence,
  sendFriendRequest,
  unblockPlayer,
} from "../services/followersService.js";
import { sendServerError } from "../lib/http.js";

/** Wraps a handler: requires a signed-in user, sends the result as JSON, maps rule errors. */
function handler(fn: (req: Request, userId: string) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "unauthorized" });
    try {
      res.json(await fn(req, userId));
    } catch (err) {
      if (err instanceof FollowersError) return res.status(err.status).json({ error: err.code });
      sendServerError(res, "followers_request_failed", err);
    }
  };
}

const otherId = (req: Request) => String(req.params.userId);

export const getSummary = handler((_req, userId) => getFriendsSummary(userId));

export const getRequests = handler((_req, userId) => listFriendRequests(userId));

export const sendRequest = handler((req, userId) => {
  const body = (req.body ?? {}) as { friendCode?: unknown };
  return sendFriendRequest(userId, body.friendCode);
});

export const acceptRequest = handler((req, userId) => acceptFriendRequest(userId, otherId(req)));

export const declineRequest = handler((req, userId) => declineFriendRequest(userId, otherId(req)));

export const removeFriendHandler = handler((req, userId) => removeFriend(userId, otherId(req)));

export const blockHandler = handler((req, userId) => blockPlayer(userId, otherId(req)));

export const unblockHandler = handler((req, userId) => unblockPlayer(userId, otherId(req)));

/** POST /followers/status: always 204; stored only when the player shares presence. */
export async function reportPresenceHandler(req: Request, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "unauthorized" });
  try {
    await reportPresence(userId);
    res.status(204).end();
  } catch (err) {
    sendServerError(res, "presence_update_failed", err);
  }
}
