import { test } from "vitest";
import assert from "node:assert/strict";
import { addExperience } from "./experienceService.js";
import { DEFAULT_EXPERIENCE_LEVELS, EXPERIENCE_MAX_LEVEL } from "../data/experienceLevels.js";

const levels = DEFAULT_EXPERIENCE_LEVELS;
const need = (lvl: number) => levels.find((l) => l.level === lvl)!.requiredXp;

test("adds progress within a level", () => {
  assert.deepEqual(addExperience(levels, { level: 1, progress: 0, total: 0 }, 10), {
    level: 1,
    progress: 10,
    total: 10,
  });
});

test("levels up exactly at the requirement and carries the remainder", () => {
  const r = addExperience(levels, { level: 1, progress: 0, total: 0 }, need(1) + 5);
  assert.deepEqual(r, { level: 2, progress: 5, total: need(1) + 5 });
});

test("can cross several levels in one award", () => {
  const r = addExperience(levels, { level: 1, progress: 0, total: 0 }, need(1) + need(2) + need(3));
  assert.equal(r.level, 4);
  assert.equal(r.progress, 0);
});

test("stops at the max level with progress capped", () => {
  const r = addExperience(
    levels,
    { level: EXPERIENCE_MAX_LEVEL, progress: 0, total: 1 },
    10_000_000,
  );
  assert.equal(r.level, EXPERIENCE_MAX_LEVEL);
  assert.ok(r.progress <= need(EXPERIENCE_MAX_LEVEL));
});
