/**
 * Family links (T11.7): a grown-up sees how much a kid plays.
 * - The grown-up makes a 6-character code (valid 15 minutes, one at a time) and the
 *   kid types it in on their own account. Both must be registered (the routes check).
 * - A kid can have at most two grown-ups. Only a grown-up can unlink.
 * - The grown-up sees the kid's screen name, avatar, and plays and play time per
 *   local day for the last 7 days. Nothing else about the kid is exposed here.
 * Wrong codes are throttled per kid, so codes can't be guessed.
 */
import crypto from "node:crypto";
import { getDb } from "../db/client.js";
import { getUserForUpdate } from "../repos/usersRepo.js";
import {
  deleteCode,
  deleteLink,
  findCode,
  getMember,
  insertLink,
  listGrownUps,
  listKids,
  listParentIds,
  playTimeByDay,
  replaceCode,
  type DayPlayRow,
  type FamilyMemberRow,
} from "../repos/familyRepo.js";
import { checkThrottle, recordAttempt, type ThrottleCheck } from "./throttle.js";
import { clampTzOffset, localDayFor } from "./streakRules.js";

const DAY_MS = 86_400_000;
export const FAMILY_CODE_TTL_MS = 15 * 60 * 1000;
export const MAX_GROWN_UPS = 2;
export const DASHBOARD_DAYS = 7;
/** No 0/O, 1/I/L or U/V, so a code read aloud is typed right. */
export const FAMILY_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTWXYZ";
export const FAMILY_CODE_LENGTH = 6;
const FAMILY_CODE_PATTERN = new RegExp(`^[${FAMILY_CODE_ALPHABET}]{${FAMILY_CODE_LENGTH}}$`);

/** 10 wrong codes per kid per 15 minutes. */
const JOIN_RULE = { limit: 10, windowMs: 15 * 60 * 1000, resetOnSuccess: true } as const;

export class FamilyError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
    this.name = "FamilyError";
  }
}

// ---- Pure rules ----

/** A random code from the alphabet. `randomInt` is injectable for tests. */
export function generateFamilyCode(
  randomInt: (max: number) => number = (max) => crypto.randomInt(max),
): string {
  let code = "";
  for (let i = 0; i < FAMILY_CODE_LENGTH; i++) {
    code += FAMILY_CODE_ALPHABET[randomInt(FAMILY_CODE_ALPHABET.length)];
  }
  return code;
}

/** The canonical code for what someone typed (any case, spaces and dashes ignored), or null. */
export function normalizeFamilyCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.replace(/[\s-]/g, "").toUpperCase();
  return FAMILY_CODE_PATTERN.test(code) ? code : null;
}

/** Can this kid join this grown-up? Returns an error code, or null when it's fine. */
export function joinProblem(
  childId: string,
  parentId: string,
  currentParents: readonly string[],
): string | null {
  if (childId === parentId) return "cant_link_self";
  if (currentParents.includes(parentId)) return null; // already linked: fine, nothing changes
  if (currentParents.length >= MAX_GROWN_UPS) return "too_many_grown_ups";
  return null;
}

/** The last `n` local days, oldest first, and the UTC instant the oldest one starts. */
export function lastLocalDays(
  nowMs: number,
  tzOffsetMinutes: number,
  n = DASHBOARD_DAYS,
): { days: string[]; fromUtc: Date } {
  const offset = clampTzOffset(tzOffsetMinutes);
  const todayMs = Date.parse(`${localDayFor(nowMs, offset)}T00:00:00.000Z`);
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    days.push(new Date(todayMs - i * DAY_MS).toISOString().slice(0, 10));
  }
  // Local midnight of the oldest day, as a UTC instant.
  return { days, fromUtc: new Date(todayMs - (n - 1) * DAY_MS - offset * 60_000) };
}

export type DayPlay = { day: string; plays: number; playMs: number };

/** One entry per day (zeros for days without plays) for one player. */
export function fillDays(days: readonly string[], rows: readonly DayPlayRow[]): DayPlay[] {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  return days.map((day) => {
    const r = byDay.get(day);
    return { day, plays: r?.plays ?? 0, playMs: r?.durationMs ?? 0 };
  });
}

// ---- Database-backed ----

export type FamilyMember = { userId: string; screenName: string; avatar: number };

export type KidSummary = FamilyMember & {
  linkedAt: string;
  days: DayPlay[];
  totalPlays: number;
  totalPlayMs: number;
};

export type FamilySummary = {
  /** Kids this account is a grown-up for, with their week. */
  kids: KidSummary[];
  /** Grown-ups linked to this account (when it's a kid's). */
  grownUps: (FamilyMember & { linkedAt: string })[];
};

const member = (r: Pick<FamilyMemberRow, "userId" | "screenName" | "avatar">): FamilyMember => ({
  userId: r.userId,
  screenName: r.screenName,
  avatar: r.avatar,
});

/** POST /family/codes: a fresh code for this grown-up; any earlier one stops working. */
export async function createFamilyCode(
  parentId: string,
  now = new Date(),
  makeCode: () => string = () => generateFamilyCode(),
): Promise<{ code: string; expiresAt: string }> {
  const expiresAt = new Date(now.getTime() + FAMILY_CODE_TTL_MS);
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeCode();
    const saved = await getDb().transaction((tx) => replaceCode(tx, parentId, code, expiresAt));
    if (saved) return { code, expiresAt: expiresAt.toISOString() };
  }
  throw new Error("family_code_collision");
}

/** POST /family/join {code}: links the caller (the kid) to the code's grown-up. */
export async function joinFamily(
  childId: string,
  rawCode: unknown,
  now = new Date(),
): Promise<{ grownUp: FamilyMember }> {
  const checks: ThrottleCheck[] = [{ key: `family:${childId}`, rule: JOIN_RULE }];
  const verdict = await checkThrottle(checks, now);
  if (!verdict.allowed) throw new FamilyError("too_many_tries", 429);

  const code = normalizeFamilyCode(rawCode);
  type Outcome = { error: string; status: number } | { grownUp: FamilyMember };
  const outcome = await getDb().transaction(async (tx): Promise<Outcome> => {
    const found = code ? await findCode(tx, code) : null;
    if (!found) return { error: "code_not_found", status: 404 };
    if (found.expiresAt.getTime() <= now.getTime()) return { error: "code_expired", status: 410 };
    // Locks the kid's row, so two codes typed at once can't both pass the cap.
    if (!(await getUserForUpdate(tx, childId))) throw new FamilyError("not_found", 404);
    const parents = await listParentIds(tx, childId);
    const problem = joinProblem(childId, found.parentUserId, parents);
    if (problem) throw new FamilyError(problem, problem === "cant_link_self" ? 400 : 409);
    await insertLink(tx, found.parentUserId, childId);
    await deleteCode(tx, code!);
    const grownUp = await getMember(tx, found.parentUserId);
    if (!grownUp) throw new FamilyError("code_not_found", 404);
    return { grownUp: member(grownUp) };
  });

  if ("error" in outcome) {
    await recordAttempt(checks, false, now);
    throw new FamilyError(outcome.error, outcome.status);
  }
  await recordAttempt(checks, true, now);
  return outcome;
}

/** DELETE /family/kids/:childId: the grown-up unlinks a kid. */
export async function unlinkKid(parentId: string, childId: string): Promise<{ ok: true }> {
  if (!(await deleteLink(parentId, childId))) throw new FamilyError("not_found", 404);
  return { ok: true };
}

/** GET /family: the caller's kids (with their last 7 local days) and grown-ups. */
export async function getFamily(
  userId: string,
  tzOffsetMinutes: unknown,
  nowMs = Date.now(),
): Promise<FamilySummary> {
  const offset = clampTzOffset(tzOffsetMinutes);
  // One after another: the Lambda has a single database connection.
  const kidRows = await listKids(userId);
  const grownUpRows = await listGrownUps(userId);
  const { days, fromUtc } = lastLocalDays(nowMs, offset);
  const playRows = await playTimeByDay(
    kidRows.map((k) => k.userId),
    fromUtc,
    offset,
  );
  const kids = kidRows.map((k) => {
    const filled = fillDays(
      days,
      playRows.filter((r) => r.userId === k.userId),
    );
    return {
      ...member(k),
      linkedAt: k.since.toISOString(),
      days: filled,
      totalPlays: filled.reduce((n, d) => n + d.plays, 0),
      totalPlayMs: filled.reduce((n, d) => n + d.playMs, 0),
    };
  });
  return {
    kids,
    grownUps: grownUpRows.map((g) => ({ ...member(g), linkedAt: g.since.toISOString() })),
  };
}
