import { expect, test } from "vitest";
import type { User } from "../db/schema.js";
import { toPublicProfile } from "./publicProfile.js";

const full: User = {
  id: "uid-1",
  username: "tilly",
  screenName: "BraveKoala",
  screenNameSetByUser: true,
  avatar: 3,
  accountType: "username_pin",
  pinHash: "$2a$10$abc",
  email: "kid@example.com",
  emailVerified: true,
  admin: true,
  betaTester: true,
  xpTotal: 1510,
  xpLevel: 4,
  xpProgress: 10,
  streakCurrent: 2,
  streakLongest: 9,
  streakLastDay: "2026-01-05",
  disabledAt: null,
  prefs: { theme: "dark" },
  createdAt: new Date("2025-11-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  lastSeenAt: new Date("2026-01-05T08:00:00.000Z"),
};

test("returns exactly the whitelisted keys", () => {
  expect(Object.keys(toPublicProfile(full)).sort()).toEqual([
    "avatar",
    "createdAt",
    "currentStreak",
    "experience",
    "longestStreak",
    "screenName",
    "userId",
  ]);
});

test("strips email, admin, prefs, username, last seen and PIN data", () => {
  const json = JSON.stringify(toPublicProfile(full));
  for (const secret of [
    "kid@example.com",
    "admin",
    "prefs",
    "dark",
    "tilly",
    "2026-01-05",
    "2026-01-01",
    "$2a$10$abc",
    "betaTester",
    "lastUpdated",
  ]) {
    expect(json, `leaked ${secret}`).not.toContain(secret);
  }
});

test("keeps the fields the profile page needs", () => {
  const p = toPublicProfile(full);
  expect(p.screenName).toBe("BraveKoala");
  expect(p.avatar).toBe(3);
  expect(p.currentStreak).toBe(2);
  expect(p.longestStreak).toBe(9);
  expect(p.createdAt).toBe("2025-11-01T00:00:00.000Z");
  expect(p.experience.level).toBe(4);
  expect(p.experience.total).toBe(1510);
});
