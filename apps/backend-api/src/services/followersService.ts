/**
 * Friends (T7.6). Kid-safe by design:
 * - The only way to find someone is their 6-character friend code. No search by name.
 * - Adding a friend sends a request; it becomes a friendship only when the other
 *   player accepts (then both edges are `accepted`).
 * - A block hides two players from each other both ways and ends any friendship.
 * - Presence is stored only for players who switched on `prefs.sharePresence`, and
 *   friends see just "online": no game, no activity, no last-seen.
 * Names, avatars and levels are joined from users at read time, never copied.
 */
import { getUserById } from "../repos/usersRepo.js";
import {
  acceptRequest,
  deleteEdgesBetween,
  deletePendingBetween,
  findUserIdByFriendCode,
  getEdgesBetween,
  insertRequest,
  listFriendRows,
  listRequestRows,
  type FriendRow,
} from "../repos/followsRepo.js";
import {
  deleteBlock,
  insertBlock,
  isBlockedEitherWay,
  listBlockedRows,
} from "../repos/blocksRepo.js";
import { deletePresence, upsertOnline } from "../repos/presenceRepo.js";
import { normalizeFriendCode } from "./friendCode.js";
import { awardFriendStickers } from "./achievements.js";

/** A rule broken by the request: the controller replies `status` with `{ error: code }`. */
export class FollowersError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
    this.name = "FollowersError";
  }
}

/** A friend as their friends see them. */
export type Friend = {
  userId: string;
  screenName: string;
  avatar: number;
  level: number;
  /** Only when they share presence and were seen in the last 2 minutes. */
  online: boolean;
  friendsSince: string;
};

/** A pending request, either way. */
export type FriendRequest = {
  userId: string;
  screenName: string;
  avatar: number;
  level: number;
  createdAt: string;
};

export type BlockedPlayer = { userId: string; screenName: string; avatar: number };

export type FriendsSummary = {
  /** The caller's own code, to share. */
  friendCode: string;
  friends: Friend[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
  blocked: BlockedPlayer[];
};

function toFriend(row: FriendRow): Friend {
  return {
    userId: row.userId,
    screenName: row.screenName,
    avatar: row.avatar,
    level: row.xpLevel,
    online: row.online,
    friendsSince: row.since.toISOString(),
  };
}

function toRequest(row: FriendRow): FriendRequest {
  return {
    userId: row.userId,
    screenName: row.screenName,
    avatar: row.avatar,
    level: row.xpLevel,
    createdAt: row.since.toISOString(),
  };
}

/** The caller's row, or a rule error when it is missing or disabled. */
async function activeUser(userId: string) {
  const user = await getUserById(userId);
  if (!user) throw new FollowersError("profile_not_found", 404);
  if (user.disabledAt) throw new FollowersError("account_disabled", 403);
  return user;
}

/** GET /followers/summary: everything the friends page shows. */
export async function getFriendsSummary(userId: string): Promise<FriendsSummary> {
  const me = await getUserById(userId);
  if (!me) throw new FollowersError("profile_not_found", 404);
  const [friends, incoming, outgoing, blocked] = await Promise.all([
    listFriendRows(userId),
    listRequestRows(userId, "incoming"),
    listRequestRows(userId, "outgoing"),
    listBlockedRows(userId),
  ]);
  return {
    friendCode: me.friendCode,
    friends: friends.map(toFriend),
    incoming: incoming.map(toRequest),
    outgoing: outgoing.map(toRequest),
    blocked: blocked.map((b) => ({ userId: b.userId, screenName: b.screenName, avatar: b.avatar })),
  };
}

/** GET /followers/requests: pending requests (the notifications page and badge). */
export async function listFriendRequests(
  userId: string,
): Promise<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }> {
  const [incoming, outgoing] = await Promise.all([
    listRequestRows(userId, "incoming"),
    listRequestRows(userId, "outgoing"),
  ]);
  return { incoming: incoming.map(toRequest), outgoing: outgoing.map(toRequest) };
}

/**
 * POST /followers/request { friendCode }. Sends a request, or, when the other player
 * already asked us, accepts theirs. A code that belongs to nobody, a guest, a
 * disabled account or someone in a block with us all look the same: not found.
 */
export async function sendFriendRequest(
  userId: string,
  rawCode: unknown,
): Promise<{ ok: true; status: "pending" | "friends" }> {
  const code = normalizeFriendCode(rawCode);
  if (!code) throw new FollowersError("invalid_code", 400);
  await activeUser(userId);
  const targetId = await findUserIdByFriendCode(code);
  if (targetId === userId) throw new FollowersError("cannot_friend_self", 400);
  const target = targetId ? await getUserById(targetId) : null;
  if (
    !target ||
    target.disabledAt ||
    target.accountType === "anonymous" ||
    (await isBlockedEitherWay(userId, target.id))
  ) {
    throw new FollowersError("code_not_found", 404);
  }

  const { outgoing, incoming } = await getEdgesBetween(userId, target.id);
  if (outgoing?.status === "accepted" && incoming?.status === "accepted") {
    throw new FollowersError("already_friends", 409);
  }
  if (incoming?.status === "pending") {
    await acceptRequest(userId, target.id);
    await awardFriendStickers(userId, target.id); // T11.4: mutual requests become friends here too
    return { ok: true, status: "friends" };
  }
  if (outgoing) throw new FollowersError("request_already_sent", 409);
  if (!(await insertRequest(userId, target.id))) {
    throw new FollowersError("request_already_sent", 409);
  }
  return { ok: true, status: "pending" };
}

/** POST /followers/requests/:userId/accept */
export async function acceptFriendRequest(
  userId: string,
  requesterId: string,
): Promise<{ ok: true }> {
  await activeUser(userId);
  if (!(await acceptRequest(userId, requesterId))) {
    throw new FollowersError("request_not_found", 404);
  }
  await awardFriendStickers(userId, requesterId); // T11.4
  return { ok: true };
}

/** DELETE /followers/requests/:userId: decline theirs or cancel ours (pending only). */
export async function declineFriendRequest(userId: string, otherId: string): Promise<{ ok: true }> {
  await deletePendingBetween(userId, otherId);
  return { ok: true };
}

/** DELETE /followers/friends/:userId: ends the friendship for both players. */
export async function removeFriend(userId: string, otherId: string): Promise<{ ok: true }> {
  await deleteEdgesBetween(userId, otherId);
  return { ok: true };
}

/** POST /followers/block/:userId */
export async function blockPlayer(userId: string, otherId: string): Promise<{ ok: true }> {
  if (userId === otherId) throw new FollowersError("cannot_block_self", 400);
  const [me, other] = await Promise.all([getUserById(userId), getUserById(otherId)]);
  if (!me) throw new FollowersError("profile_not_found", 404);
  if (!other) throw new FollowersError("user_not_found", 404);
  await insertBlock(userId, otherId);
  return { ok: true };
}

/** DELETE /followers/block/:userId. Unblocking does not bring a friendship back. */
export async function unblockPlayer(userId: string, otherId: string): Promise<{ ok: true }> {
  await deleteBlock(userId, otherId);
  return { ok: true };
}

/**
 * POST /followers/status. Records "online" only for players who switched on
 * `prefs.sharePresence`; for everyone else nothing is stored (and any old row goes).
 * The body is ignored: friends never see a game or an activity.
 */
export async function reportPresence(userId: string): Promise<void> {
  const user = await getUserById(userId);
  if (!user) return;
  if (user.prefs.sharePresence === true && !user.disabledAt) await upsertOnline(userId);
  else await deletePresence(userId);
}

export type Friendship = "friends" | "request_sent" | "request_received" | "none";

/** How `viewerId` and `otherId` are connected, for the profile page. */
export async function getFriendship(
  viewerId: string,
  otherId: string,
): Promise<{ friendship: Friendship; friendsSince: string | null }> {
  const { outgoing, incoming } = await getEdgesBetween(viewerId, otherId);
  if (outgoing?.status === "accepted" && incoming?.status === "accepted") {
    const since = outgoing.createdAt > incoming.createdAt ? outgoing.createdAt : incoming.createdAt;
    return { friendship: "friends", friendsSince: since.toISOString() };
  }
  if (outgoing?.status === "pending") return { friendship: "request_sent", friendsSince: null };
  if (incoming?.status === "pending") return { friendship: "request_received", friendsSince: null };
  return { friendship: "none", friendsSince: null };
}

export { isBlockedEitherWay };
