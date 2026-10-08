import { describe, expect, test } from "vitest";
import {
  RULES,
  combineVerdicts,
  evaluateWindow,
  ipKey,
  loginChecks,
  pinKey,
  userKey,
  type Attempt,
  type ThrottleRule,
} from "./throttle.js";

const MIN = 60 * 1000;
const now = new Date("2026-10-09T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);
const fail = (msAgo: number): Attempt => ({ ok: false, at: ago(msAgo) });
const success = (msAgo: number): Attempt => ({ ok: true, at: ago(msAgo) });

const rule: ThrottleRule = { limit: 3, windowMs: 15 * MIN, resetOnSuccess: true };

describe("evaluateWindow", () => {
  test("allows while failures are under the limit", () => {
    expect(evaluateWindow([], rule, now)).toEqual({ allowed: true });
    expect(evaluateWindow([fail(MIN), fail(2 * MIN)], rule, now)).toEqual({ allowed: true });
  });

  test("blocks at the limit until the oldest counted failure ages out", () => {
    const verdict = evaluateWindow([fail(MIN), fail(2 * MIN), fail(10 * MIN)], rule, now);
    // The 10-minute-old failure leaves the 15-minute window in 5 minutes.
    expect(verdict).toEqual({ allowed: false, retryAfterSec: 5 * 60 });
  });

  test("failures older than the window don't count (sliding, not fixed)", () => {
    const attempts = [fail(MIN), fail(2 * MIN), fail(15 * MIN), fail(20 * MIN)];
    expect(evaluateWindow(attempts, rule, now)).toEqual({ allowed: true });
  });

  test("over the limit, waits until enough failures expire to drop below it", () => {
    // Five failures, limit three: the third newest (8 min old) must expire first.
    const attempts = [fail(MIN), fail(2 * MIN), fail(8 * MIN), fail(9 * MIN), fail(12 * MIN)];
    expect(evaluateWindow(attempts, rule, now)).toEqual({ allowed: false, retryAfterSec: 7 * 60 });
  });

  test("order of the input doesn't matter", () => {
    const attempts = [fail(10 * MIN), fail(MIN), fail(2 * MIN)];
    expect(evaluateWindow(attempts, rule, now)).toEqual({ allowed: false, retryAfterSec: 5 * 60 });
  });

  test("a success wipes earlier failures when the rule says so", () => {
    const attempts = [fail(MIN), success(2 * MIN), fail(3 * MIN), fail(4 * MIN), fail(5 * MIN)];
    expect(evaluateWindow(attempts, rule, now)).toEqual({ allowed: true });
    expect(evaluateWindow(attempts, { ...rule, resetOnSuccess: false }, now).allowed).toBe(false);
  });

  test("a success never counts as a failure", () => {
    const attempts = [success(MIN), success(2 * MIN), success(3 * MIN), success(4 * MIN)];
    expect(evaluateWindow(attempts, { ...rule, resetOnSuccess: false }, now)).toEqual({
      allowed: true,
    });
  });

  test("retryAfter is at least one second", () => {
    const attempts = [fail(MIN), fail(2 * MIN), fail(15 * MIN - 10)];
    expect(evaluateWindow(attempts, rule, now)).toEqual({ allowed: false, retryAfterSec: 1 });
  });
});

describe("combineVerdicts", () => {
  test("blocked if any is blocked, with the longest wait", () => {
    expect(combineVerdicts([{ allowed: true }, { allowed: true }])).toEqual({ allowed: true });
    expect(
      combineVerdicts([
        { allowed: false, retryAfterSec: 30 },
        { allowed: true },
        { allowed: false, retryAfterSec: 90 },
      ]),
    ).toEqual({ allowed: false, retryAfterSec: 90 });
  });
});

describe("keys", () => {
  test("usernames are lower-cased; uids kept as-is", () => {
    expect(userKey("Tilly_1")).toBe("user:tilly_1");
    expect(pinKey("abc")).toBe("pin:abc");
  });

  test("IPs are stored only as a SHA-256 hex digest", () => {
    const key = ipKey("203.0.113.7");
    expect(key).toMatch(/^ip:[0-9a-f]{64}$/);
    expect(key).not.toContain("203.0.113.7");
    expect(ipKey("203.0.113.7")).toBe(key);
    expect(ipKey("203.0.113.8")).not.toBe(key);
  });

  test("login checks: username and IP, with the IP rule never reset by a success", () => {
    const checks = loginChecks("Harvey", "198.51.100.1");
    expect(checks.map((c) => c.key)).toEqual(["user:harvey", ipKey("198.51.100.1")]);
    expect(checks[0]!.rule).toBe(RULES.loginUser);
    expect(checks[1]!.rule.resetOnSuccess).toBe(false);
    expect(loginChecks(null, "198.51.100.1")).toHaveLength(1);
    expect(loginChecks("harvey", undefined)).toHaveLength(1);
  });

  test("limits: 5 per username, 20 per IP, 5 PIN changes, each per 15 minutes", () => {
    expect(RULES.loginUser).toMatchObject({ limit: 5, windowMs: 15 * MIN });
    expect(RULES.loginIp).toMatchObject({ limit: 20, windowMs: 15 * MIN });
    expect(RULES.pinChange).toMatchObject({ limit: 5, windowMs: 15 * MIN });
  });
});
