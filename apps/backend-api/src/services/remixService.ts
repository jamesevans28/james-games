/**
 * Remix mode (T11.2): save a game with its knobs turned, look one up by its shared
 * link, and its own board. Knob ranges come from the bundled manifests
 * (data/remixKnobs.ts); names go through the remix name filter (remixRules.ts).
 */
import { getDb, type Db } from "../db/client.js";
import { remixKnobsFor } from "../data/remixKnobs.js";
import {
  countRemixesByOwner,
  getRemixById,
  getRemixWithOwner,
  insertRemix,
  listRemixLeaderboard,
  listRemixesByOwner,
  type RemixRow,
} from "../repos/remixesRepo.js";
import { getGameById } from "../repos/playsRepo.js";
import { isValidGameId, ScoreRejected } from "./scoringRules.js";
import {
  checkRemixName,
  REMIX_NAME_MESSAGES,
  REMIXES_PER_PLAYER,
  validateKnobs,
  type KnobProblem,
} from "./remixRules.js";
import type { PublicScoreRow } from "./scoresService.js";

/** A refusal with a status, a code for the client and a friendly message. */
export class RemixError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RemixError";
  }
}

/** What anyone with the link may see. No owner id, only the public name and avatar. */
export type PublicRemix = {
  id: string;
  gameId: string;
  name: string;
  knobs: Record<string, number>;
  createdAt: string;
  owner: { screenName: string; avatar: number } | null;
  /** True when the viewer made it. */
  isMine: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A remix id from a URL or body, or null when malformed. */
export function parseRemixId(value: unknown): string | null {
  return typeof value === "string" && UUID.test(value) ? value.toLowerCase() : null;
}

const KNOB_MESSAGES: Record<KnobProblem, string> = {
  no_knobs: "This game can't be remixed yet.",
  bad_knobs: "Those remix settings don't look right.",
  unknown_knob: "Those remix settings don't look right.",
  out_of_range: "One of the sliders is out of range.",
  unchanged: "Move a slider first, then save your remix.",
};

const notFound = () => new RemixError(404, "remix_not_found", "We couldn't find that remix.");

function toPublic(
  row: RemixRow,
  owner: PublicRemix["owner"],
  viewerId: string | undefined,
): PublicRemix {
  return {
    id: row.id,
    gameId: row.gameId,
    name: row.name,
    knobs: row.knobs,
    createdAt: row.createdAt.toISOString(),
    owner,
    isMine: Boolean(viewerId) && row.ownerId === viewerId,
  };
}

/** POST /remixes: { gameId, name, knobs } from a registered player. */
export async function createRemix(
  ownerId: string,
  body: { gameId?: unknown; name?: unknown; knobs?: unknown },
): Promise<PublicRemix> {
  if (!isValidGameId(body.gameId)) {
    throw new RemixError(400, "game_invalid", "We couldn't find that game.");
  }
  const gameId = body.gameId;
  const name = checkRemixName(body.name);
  if (!name.ok)
    throw new RemixError(400, `name_${name.problem}`, REMIX_NAME_MESSAGES[name.problem]);
  const knobs = validateKnobs(remixKnobsFor(gameId), body.knobs);
  if (!knobs.ok) throw new RemixError(400, `knobs_${knobs.problem}`, KNOB_MESSAGES[knobs.problem]);

  return getDb().transaction(async (tx) => {
    const game = await getGameById(gameId, tx);
    if (!game || game.status === "inactive") {
      throw new RemixError(400, "game_invalid", "We couldn't find that game.");
    }
    if ((await countRemixesByOwner(tx, ownerId)) >= REMIXES_PER_PLAYER) {
      throw new RemixError(
        409,
        "remix_limit",
        `You've made ${REMIXES_PER_PLAYER} remixes. That's loads! Play one of those for now.`,
      );
    }
    const row = await insertRemix(tx, { ownerId, gameId, name: name.name, knobs: knobs.knobs });
    return toPublic(row, null, ownerId);
  });
}

/** GET /remixes/:id: public, for the shared link. */
export async function getRemix(id: string, viewerId?: string): Promise<PublicRemix> {
  const remixId = parseRemixId(id);
  if (!remixId) throw notFound();
  const row = await getRemixWithOwner(remixId);
  if (!row) throw notFound();
  return toPublic(row, { screenName: row.ownerScreenName, avatar: row.ownerAvatar }, viewerId);
}

/** GET /remixes/mine?gameId=: the player's own remixes, newest first. */
export async function listMyRemixes(ownerId: string, gameId?: unknown): Promise<PublicRemix[]> {
  const rows = await listRemixesByOwner(ownerId, {
    gameId: isValidGameId(gameId) ? gameId : undefined,
    limit: REMIXES_PER_PLAYER,
  });
  return rows.map((r) => toPublic(r, null, ownerId));
}

/** GET /remixes/:id/scores: best per player on this remix. */
export async function getRemixLeaderboard(id: string, limit: number): Promise<PublicScoreRow[]> {
  const remixId = parseRemixId(id);
  if (!remixId) throw notFound();
  if (!(await getRemixWithOwner(remixId))) throw notFound();
  const rows = await listRemixLeaderboard(remixId, limit);
  return rows.map((r) => ({
    userId: r.userId,
    screenName: r.screenName,
    avatar: r.avatar,
    score: r.score,
    createdAt: r.achievedAt.toISOString(),
    level: r.level,
  }));
}

/**
 * For POST /scores (inside its transaction): the remix a run was played on, or null
 * for a normal run. A remix id that is malformed, unknown or for another game is
 * refused rather than ignored, so a remix score never lands on the normal board.
 */
export async function remixForRun(tx: Db, raw: unknown, gameId: string): Promise<string | null> {
  if (raw === undefined || raw === null) return null;
  const remixId = parseRemixId(raw);
  const remix = remixId ? await getRemixById(remixId, tx) : null;
  if (!remix || remix.gameId !== gameId) throw new ScoreRejected("remix_invalid");
  return remix.id;
}
