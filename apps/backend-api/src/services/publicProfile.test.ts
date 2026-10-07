import { test } from "node:test";
import assert from "node:assert/strict";
import { toPublicProfile } from "./publicProfile.js";

const full = {
  userId: "uid-1",
  screenName: "BraveKoala",
  email: "kid@example.com",
  emailProvided: true,
  avatar: 3,
  preferences: { theme: "dark" },
  validated: true,
  betaTester: true,
  admin: true,
  createdAt: "2025-11-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  experience: { level: 4, progress: 10, required: 500, percent: 0.02, remaining: 490, total: 1510 },
  currentStreak: 2,
  longestStreak: 9,
  lastLoginDate: "2026-01-05",
  pinHash: "$2a$10$abc",
};

test("returns exactly the whitelisted keys", () => {
  assert.deepEqual(Object.keys(toPublicProfile(full)).sort(), [
    "avatar", "createdAt", "currentStreak", "experience", "longestStreak", "screenName", "userId",
  ]);
});

test("strips email, admin, preferences, last login and PIN data", () => {
  const json = JSON.stringify(toPublicProfile(full));
  for (const secret of ["kid@example.com", "admin", "preferences", "lastLoginDate", "2026-01-05", "pinHash", "betaTester"]) {
    assert.ok(!json.includes(secret), `leaked ${secret}`);
  }
});

test("keeps the fields the profile page needs", () => {
  const p = toPublicProfile(full);
  assert.equal(p.screenName, "BraveKoala");
  assert.equal(p.avatar, 3);
  assert.equal(p.currentStreak, 2);
  assert.deepEqual(p.experience, full.experience);
});

test("fills safe defaults for a sparse row", () => {
  assert.deepEqual(toPublicProfile({ userId: "uid-2" }), {
    userId: "uid-2", screenName: null, avatar: null, createdAt: null,
    experience: null, currentStreak: 0, longestStreak: 0,
  });
});
