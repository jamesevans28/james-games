/**
 * Admin console: user search, user detail and moderation (T6.3, T6.8).
 * Admin responses may include email; logs never do.
 */
import { randomInt } from "node:crypto";
import { getDb } from "../db/client.js";
import type { User } from "../db/schema.js";
import { getUserById, updateUser } from "../repos/usersRepo.js";
import {
  bestPlayFor,
  deleteBestScore,
  deletePlayRow,
  deleteStats,
  getUserForUpdate,
  isScreenNameTaken,
  latestPlayFor,
  listRecentPlays,
  listUserGameStats,
  listUsersPage,
  putBestScore,
  setDisabledAt,
  setScreenName,
  updateStatsAfterRemoval,
} from "../repos/adminRepo.js";
import { generatePlayfulName } from "./userService.js";

const RECENT_PLAYS = 20;

/** A 4xx outcome; the controller turns it into `{ error: code }` with this status. */
export class AdminError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
    this.name = "AdminError";
  }
}

export type AdminUserSummary = {
  userId: string;
  username: string | null;
  screenName: string;
  email: string | null;
  emailProvided: boolean;
  validated: boolean;
  accountType: User["accountType"];
  betaTester: boolean;
  admin: boolean;
  enabled: boolean;
  disabledAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string | null;
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);

function toSummary(user: User): AdminUserSummary {
  return {
    userId: user.id,
    username: user.username,
    screenName: user.screenName,
    email: user.email,
    emailProvided: Boolean(user.email),
    validated: user.emailVerified,
    accountType: user.accountType,
    betaTester: user.betaTester,
    admin: user.admin,
    enabled: !user.disabledAt,
    disabledAt: iso(user.disabledAt),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    lastSeenAt: iso(user.lastSeenAt),
  };
}

/** Offset pagination; the cursor is the opaque next offset. */
export async function listUsers(opts: { limit?: number; cursor?: string; search?: string }) {
  const limit = Math.min(Math.max(Math.trunc(Number(opts.limit)) || 25, 5), 100);
  const parsed = Number(opts.cursor);
  const offset = Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
  const rows = await listUsersPage({ search: opts.search, limit, offset });
  return {
    items: rows.slice(0, limit).map(toSummary),
    nextCursor: rows.length > limit ? String(offset + limit) : undefined,
  };
}

export async function getAdminUser(userId: string) {
  const user = await getUserById(userId);
  if (!user) throw new AdminError(404, "user_not_found");
  const [gameStats, recentPlays] = await Promise.all([
    listUserGameStats(userId),
    listRecentPlays(userId, RECENT_PLAYS),
  ]);
  return {
    ...toSummary(user),
    emailVerified: user.emailVerified,
    avatar: user.avatar,
    xp: { total: user.xpTotal, level: user.xpLevel, progress: user.xpProgress },
    streak: { current: user.streakCurrent, longest: user.streakLongest },
    gameStats: gameStats.map((s) => ({ ...s, lastPlayedAt: s.lastPlayedAt.toISOString() })),
    recentPlays: recentPlays.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })),
  };
}

/** Only the access flags are editable here; names and email belong to the player. */
export async function updateAdminUser(
  actorId: string,
  userId: string,
  changes: { betaTester?: unknown; admin?: unknown },
) {
  const patch: { betaTester?: boolean; admin?: boolean } = {};
  for (const key of ["betaTester", "admin"] as const) {
    const value = changes[key];
    if (value === undefined) continue;
    if (typeof value !== "boolean") throw new AdminError(400, "invalid_flag");
    patch[key] = value;
  }
  if (!Object.keys(patch).length) throw new AdminError(400, "no_changes_provided");
  if (actorId === userId && patch.admin === false) {
    throw new AdminError(400, "cannot_remove_own_admin");
  }
  const updated = await updateUser(userId, patch);
  if (!updated) throw new AdminError(404, "user_not_found");
  return getAdminUser(userId);
}

const NAME_ATTEMPTS = 8;

/** A generated name nobody else has: the plain name first, then with 2-4 digits. */
function candidateName(attempt: number): string {
  const base = generatePlayfulName();
  if (attempt < 2) return base;
  const digits = attempt < 5 ? randomInt(10, 100) : randomInt(1000, 10000);
  return `${base}${digits}`;
}

/** Replaces the player's screen name with a generated one (they can pick again later). */
export async function resetScreenName(userId: string) {
  const updated = await getDb().transaction(async (tx) => {
    const user = await getUserForUpdate(tx, userId);
    if (!user) throw new AdminError(404, "user_not_found");
    for (let attempt = 0; attempt < NAME_ATTEMPTS; attempt++) {
      const name = candidateName(attempt);
      if (name.toLowerCase() === user.screenName.toLowerCase()) continue;
      if (await isScreenNameTaken(tx, name, userId)) continue;
      return setScreenName(tx, user, name);
    }
    throw new Error("screen_name_generation_exhausted");
  });
  if (!updated) throw new AdminError(404, "user_not_found");
  return getAdminUser(userId);
}

export async function setUserDisabled(actorId: string, userId: string, disabled: boolean) {
  if (disabled && actorId === userId) throw new AdminError(400, "cannot_disable_self");
  const user = await getUserById(userId);
  if (!user) throw new AdminError(404, "user_not_found");
  // Keep the original timestamp when disabling twice.
  const next = disabled ? (user.disabledAt ?? new Date()) : null;
  const updated = await setDisabledAt(userId, next);
  if (!updated) throw new AdminError(404, "user_not_found");
  return getAdminUser(userId);
}

/**
 * Deletes one play and, in the same transaction, rebuilds that player's best
 * score and stats for the game from the plays that remain. XP already awarded
 * is left as it is.
 */
export async function deletePlay(playId: string) {
  return getDb().transaction(async (tx) => {
    const play = await deletePlayRow(tx, playId);
    if (!play) throw new AdminError(404, "play_not_found");
    const { userId, gameId } = play;
    if (!userId) return { deleted: true, playId, gameId, userId: null, bestScore: null };

    const best = await bestPlayFor(tx, userId, gameId);
    const latest = best ? await latestPlayFor(tx, userId, gameId) : null;
    if (best && latest) {
      await putBestScore(tx, { ...best, userId });
      await updateStatsAfterRemoval(tx, userId, gameId, { best, latest });
    } else {
      await deleteBestScore(tx, userId, gameId);
      await deleteStats(tx, userId, gameId);
    }
    return { deleted: true, playId, gameId, userId, bestScore: best?.score ?? null };
  });
}
