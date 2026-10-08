/**
 * Sign-in throttling (T7.7). Every username+PIN login and PIN change is recorded in
 * Postgres (`auth_attempts`), so the count survives Lambda cold starts. The window
 * maths is pure (`evaluateWindow`); `checkThrottle` and `recordAttempt` wrap it with
 * the database.
 *
 * Keys never hold a raw IP: "ip:<sha256 hex>". "user:<lower username>" and
 * "pin:<uid>" rows are removed by daily housekeeping and on account deletion.
 */
import crypto from "node:crypto";
import { insertAttempts, listAttempts, type AttemptRow } from "../repos/authAttemptsRepo.js";
import { normalizeUsername } from "./usernamePolicy.js";

export type ThrottleRule = {
  /** Failed attempts allowed inside the window; the next one is refused. */
  limit: number;
  windowMs: number;
  /**
   * A success wipes earlier failures. True for keys only the account owner can
   * succeed on (a username, a uid); false for an IP, so an attacker can't reset
   * the IP count by signing in to their own account between guesses.
   */
  resetOnSuccess: boolean;
};

const FIFTEEN_MINUTES = 15 * 60 * 1000;

export const RULES = {
  loginUser: { limit: 5, windowMs: FIFTEEN_MINUTES, resetOnSuccess: true },
  loginIp: { limit: 20, windowMs: FIFTEEN_MINUTES, resetOnSuccess: false },
  pinChange: { limit: 5, windowMs: FIFTEEN_MINUTES, resetOnSuccess: true },
} as const satisfies Record<string, ThrottleRule>;

export type Attempt = { ok: boolean; at: Date };
export type ThrottleVerdict = { allowed: true } | { allowed: false; retryAfterSec: number };

/**
 * Sliding window: counts failures newer than `now - windowMs` (after the last
 * success, when the rule resets on success). At `limit` failures the key is
 * blocked until enough of them age out to drop below the limit.
 */
export function evaluateWindow(
  attempts: Attempt[],
  rule: ThrottleRule,
  now: Date,
): ThrottleVerdict {
  const since = now.getTime() - rule.windowMs;
  let from = since;
  if (rule.resetOnSuccess) {
    for (const a of attempts) {
      if (a.ok && a.at.getTime() > from) from = a.at.getTime();
    }
  }
  const failures = attempts
    .filter((a) => !a.ok && a.at.getTime() > from)
    .map((a) => a.at.getTime())
    .sort((a, b) => a - b);
  if (failures.length < rule.limit) return { allowed: true };
  // The failure whose expiry brings the count back under the limit.
  const freeing = failures[failures.length - rule.limit]!;
  const waitMs = freeing + rule.windowMs - now.getTime();
  return { allowed: false, retryAfterSec: Math.max(1, Math.ceil(waitMs / 1000)) };
}

/** The strictest verdict: blocked if any is blocked, with the longest wait. */
export function combineVerdicts(verdicts: ThrottleVerdict[]): ThrottleVerdict {
  let wait = 0;
  for (const v of verdicts) if (!v.allowed) wait = Math.max(wait, v.retryAfterSec);
  return wait > 0 ? { allowed: false, retryAfterSec: wait } : { allowed: true };
}

export function userKey(username: string): string {
  return `user:${normalizeUsername(username)}`;
}

/** Never stores the IP itself, only its SHA-256. */
export function ipKey(ip: string): string {
  return `ip:${crypto.createHash("sha256").update(ip).digest("hex")}`;
}

export function pinKey(uid: string): string {
  return `pin:${uid}`;
}

export type ThrottleCheck = { key: string; rule: ThrottleRule };

/**
 * The login checks: per username, plus per IP when the request has one. A string
 * that can't be a username (null here) is counted against the IP only, so junk
 * input never becomes a stored key.
 */
export function loginChecks(username: string | null, ip: string | undefined): ThrottleCheck[] {
  const checks: ThrottleCheck[] = [];
  if (username) checks.push({ key: userKey(username), rule: RULES.loginUser });
  if (ip) checks.push({ key: ipKey(ip), rule: RULES.loginIp });
  return checks;
}

function groupByKey(rows: AttemptRow[]): Map<string, Attempt[]> {
  const byKey = new Map<string, Attempt[]>();
  for (const r of rows) {
    const list = byKey.get(r.key) ?? [];
    list.push({ ok: r.ok, at: r.attemptedAt });
    byKey.set(r.key, list);
  }
  return byKey;
}

/** Reads the recent attempts for every key and decides. */
export async function checkThrottle(
  checks: ThrottleCheck[],
  now = new Date(),
): Promise<ThrottleVerdict> {
  if (checks.length === 0) return { allowed: true };
  const longest = Math.max(...checks.map((c) => c.rule.windowMs));
  const rows = await listAttempts(
    checks.map((c) => c.key),
    new Date(now.getTime() - longest),
  );
  const byKey = groupByKey(rows);
  return combineVerdicts(checks.map((c) => evaluateWindow(byKey.get(c.key) ?? [], c.rule, now)));
}

export async function recordAttempt(
  checks: ThrottleCheck[],
  ok: boolean,
  now = new Date(),
): Promise<void> {
  await insertAttempts(
    checks.map((c) => c.key),
    ok,
    now,
  );
}
