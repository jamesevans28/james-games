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
  friendCode: "AB3C9H",
  disabledAt: null,
  prefs: { theme: "dark", sharePresence: true },
  createdAt: new Date("2025-11-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  lastSeenAt: new Date("2026-01-05T08:00:00.000Z"),
};

test("returns exactly screen name, avatar and level (plus the id)", () => {
  expect(toPublicProfile(full)).toEqual({
    userId: "uid-1",
    screenName: "BraveKoala",
    avatar: 3,
    level: 4,
  });
});

test("strips email, admin, prefs, username, friend code, dates and PIN data", () => {
  const json = JSON.stringify(toPublicProfile(full));
  for (const secret of [
    "kid@example.com",
    "admin",
    "prefs",
    "dark",
    "sharePresence",
    "tilly",
    "AB3C9H",
    "2025-11-01",
    "2026-01-05",
    "2026-01-01",
    "$2a$10$abc",
    "betaTester",
    "Streak",
  ]) {
    expect(json, `leaked ${secret}`).not.toContain(secret);
  }
});
