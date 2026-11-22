/**
 * Bringing the prototype's players and high scores across (DECISIONS 2026-10-27, which
 * reverses the 9 Oct "no migration" rule at James's request). Pure planning only: the
 * script `scripts/migrate-prototype.ts` reads DynamoDB, calls planImport, and writes.
 *
 * Who comes across:
 * - every username + PIN account (kind "pin"): they can sign in with their old username
 *   and PIN, because the hashes are bcrypt like ours;
 * - every other account that has at least one usable score (kind "guest"): their scores
 *   and screen names appear on leaderboards, but nobody can sign in to them.
 * Scores without an account, on games that no longer exist, or above the game's limit
 * are left out. Emails, admin flags and streaks are never copied.
 */

export type DynamoItem = Record<string, Record<string, unknown>>;

/** DynamoDB's typed JSON to plain values (only the types the prototype used). */
export function unmarshall(item: DynamoItem): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, typed] of Object.entries(item)) {
    if ("S" in typed) out[key] = typed.S;
    else if ("N" in typed) out[key] = Number(typed.N);
    else if ("BOOL" in typed) out[key] = typed.BOOL;
    else if ("NULL" in typed) out[key] = null;
    else out[key] = undefined;
  }
  return out;
}

export type LegacyUser = {
  userId: string;
  accountType?: string;
  username?: string;
  pinHash?: string;
  screenName?: string;
  avatar?: number;
  xpTotal?: number;
  createdAt?: string;
};

export type LegacyScore = { userId?: string; gameId: string; score: number; createdAt?: string };

export type LegacyStat = {
  userId: string;
  gameId: string;
  bestScore?: number;
  lastScore?: number;
  lastPlayedAt?: string;
};

/** A game that exists in the new database, with its highest believable score. */
export type GameLimit = { id: string; maxScore: number };

export type PlannedBest = {
  gameId: string;
  score: number;
  achievedAt: string;
  plays: number;
  lastScore: number;
  lastPlayedAt: string;
};

export type PlannedPlayer = {
  legacyId: string;
  kind: "pin" | "guest";
  username: string | null;
  pinHash: string | null;
  /** The old screen name as it was; the script checks it against today's rules. */
  screenName: string | null;
  avatar: number;
  xpTotal: number;
  createdAt: string;
  bests: PlannedBest[];
};

export type ImportPlan = {
  players: PlannedPlayer[];
  skipped: {
    scoresWithoutAccount: number;
    scoresOnUnknownGames: number;
    scoresOverLimit: number;
    accountsWithoutScores: number;
  };
};

const USERNAME = /^[a-zA-Z0-9_]{3,20}$/;
const BCRYPT = /^\$2[aby]\$\d{2}\$/;
/** Gold avatars (101+) are supporter perks, so imports keep only the free set. */
const FREE_AVATAR_MAX = 100;

function isoOr(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const t = Date.parse(value);
  return Number.isNaN(t) ? fallback : new Date(t).toISOString();
}

export function planImport(
  users: LegacyUser[],
  scores: LegacyScore[],
  stats: LegacyStat[],
  games: GameLimit[],
  now: Date = new Date(),
): ImportPlan {
  const nowIso = now.toISOString();
  const limit = new Map(games.map((g) => [g.id, g.maxScore]));
  const skipped = {
    scoresWithoutAccount: 0,
    scoresOnUnknownGames: 0,
    scoresOverLimit: 0,
    accountsWithoutScores: 0,
  };
  const known = new Set(users.map((u) => u.userId));

  type Row = { score: number; at: string; counts: boolean };
  const rows = new Map<string, Map<string, Row[]>>();
  const add = (
    userId: string | undefined,
    gameId: string,
    score: unknown,
    at: unknown,
    counts: boolean,
  ) => {
    if (!userId || !known.has(userId)) {
      skipped.scoresWithoutAccount++;
      return;
    }
    const max = limit.get(gameId);
    if (max === undefined) {
      skipped.scoresOnUnknownGames++;
      return;
    }
    if (typeof score !== "number" || !Number.isInteger(score) || score < 0 || score > max) {
      skipped.scoresOverLimit++;
      return;
    }
    const byGame = rows.get(userId) ?? new Map<string, Row[]>();
    rows.set(userId, byGame);
    const list = byGame.get(gameId) ?? [];
    byGame.set(gameId, list);
    list.push({ score, at: isoOr(at, nowIso), counts });
  };
  for (const s of scores) add(s.userId, s.gameId, s.score, s.createdAt, true);
  // Stats rows hold a best that may predate the score tables; they don't count as a play.
  for (const s of stats) add(s.userId, s.gameId, s.bestScore, s.lastPlayedAt, false);

  const players: PlannedPlayer[] = [];
  for (const u of users) {
    const bests: PlannedBest[] = [];
    for (const [gameId, list] of rows.get(u.userId) ?? []) {
      const top = list.reduce((a, b) =>
        b.score > a.score || (b.score === a.score && b.at < a.at) ? b : a,
      );
      const last = list.reduce((a, b) => (b.at > a.at ? b : a));
      bests.push({
        gameId,
        score: top.score,
        achievedAt: top.at,
        plays: Math.max(1, list.filter((r) => r.counts).length),
        lastScore: last.score,
        lastPlayedAt: last.at,
      });
    }
    bests.sort((a, b) => a.gameId.localeCompare(b.gameId));
    const canSignIn =
      typeof u.username === "string" &&
      USERNAME.test(u.username) &&
      typeof u.pinHash === "string" &&
      BCRYPT.test(u.pinHash);
    if (!canSignIn && bests.length === 0) {
      skipped.accountsWithoutScores++;
      continue;
    }
    const avatar =
      Number.isInteger(u.avatar) && u.avatar! >= 1 && u.avatar! <= FREE_AVATAR_MAX ? u.avatar! : 1;
    players.push({
      legacyId: u.userId,
      kind: canSignIn ? "pin" : "guest",
      username: canSignIn ? u.username!.toLowerCase() : null,
      pinHash: canSignIn ? u.pinHash! : null,
      screenName:
        typeof u.screenName === "string" && u.screenName.trim() ? u.screenName.trim() : null,
      avatar,
      xpTotal: Number.isFinite(u.xpTotal) ? Math.max(0, Math.floor(u.xpTotal!)) : 0,
      createdAt: isoOr(u.createdAt, nowIso),
      bests,
    });
  }
  return { players, skipped };
}

/** The id an imported player gets in `users` when there is no sign-in behind it. */
export function guestId(legacyId: string): string {
  return `legacy-${legacyId}`;
}
