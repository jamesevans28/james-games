import {
  DEFAULT_EXPERIENCE_LEVELS,
  EXPERIENCE_MAX_LEVEL,
  type ExperienceLevelRow,
} from "../data/experienceLevels.js";
import type { Db } from "../db/client.js";
import type { User } from "../db/schema.js";
import { getUserById } from "../repos/usersRepo.js";
import { listExperienceLevels } from "../repos/statsRepo.js";
import { log } from "../lib/log.js";

export type ExperienceSummary = {
  level: number;
  progress: number;
  required: number;
  percent: number;
  remaining: number;
  total: number;
  lastUpdated?: string;
};

/** The users-row fields a summary is built from. */
export type ExperienceSource = Pick<User, "xpLevel" | "xpProgress" | "xpTotal"> & {
  updatedAt?: Date | string | null;
};

let cachedLevels: ExperienceLevelRow[] | null = null;
let lastLoadedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

/** The XP curve from experience_levels (cached 5 minutes per container), or the default curve. */
export async function loadExperienceLevels(db?: Db): Promise<ExperienceLevelRow[]> {
  const now = Date.now();
  if (cachedLevels && now - lastLoadedAt < CACHE_TTL_MS) return cachedLevels;
  let levels = DEFAULT_EXPERIENCE_LEVELS;
  try {
    const rows = await listExperienceLevels(db);
    if (rows.length) levels = rows;
  } catch (err) {
    log.warn("experience_levels_load_failed", undefined, err);
  }
  cachedLevels = levels;
  lastLoadedAt = now;
  return levels;
}

function ensureRequirement(levels: ExperienceLevelRow[], level: number): ExperienceLevelRow {
  const clamped = Math.min(
    Math.max(level, 1),
    levels[levels.length - 1]?.level ?? EXPERIENCE_MAX_LEVEL,
  );
  const found = levels.find((row) => row.level === clamped);
  if (found) return found;
  const last = levels[levels.length - 1];
  if (!last) throw new Error("experience_levels_empty");
  return last;
}

export async function getExperienceSummary(userId: string): Promise<ExperienceSummary | null> {
  const [user] = await Promise.all([getUserById(userId), loadExperienceLevels()]);
  return user ? buildSummary(user) : null;
}

/** Summary for a users row. Synchronous: uses the cached curve (or the default one). */
export function buildSummary(user: ExperienceSource): ExperienceSummary {
  const level = Math.min(Math.max(Number(user.xpLevel ?? 1), 1), EXPERIENCE_MAX_LEVEL);
  const progress = Math.max(0, Number(user.xpProgress ?? 0));
  const total = Math.max(0, Number(user.xpTotal ?? 0));
  const levels = cachedLevels || DEFAULT_EXPERIENCE_LEVELS;
  const requirementRow = ensureRequirement(levels, level);
  // `requiredXp` is how much XP must be banked at the current level before levelling up.
  const required = Math.max(1, Number(requirementRow.requiredXp || 500));
  const clampedProgress = Math.min(progress, required);
  const percent = Math.min(1, clampedProgress / required);
  const updatedAt = user.updatedAt;
  return {
    level,
    progress: clampedProgress,
    required,
    percent,
    remaining: Math.max(0, required - clampedProgress),
    total,
    lastUpdated: updatedAt instanceof Date ? updatedAt.toISOString() : (updatedAt ?? undefined),
  };
}

/** Pure level-up maths: apply `xpEarned` to a level/progress/total triple. */
export function addExperience(
  levels: ExperienceLevelRow[],
  start: { level: number; progress: number; total: number },
  xpEarned: number,
) {
  const maxLevel = levels[levels.length - 1]?.level ?? EXPERIENCE_MAX_LEVEL;
  let level = Math.min(Math.max(start.level, 1), maxLevel);
  let progress = Math.max(0, start.progress);
  let remainingGain = xpEarned;
  while (remainingGain > 0) {
    const requirement = ensureRequirement(levels, level).requiredXp;
    if (level >= maxLevel) {
      progress = Math.min(requirement, progress + remainingGain);
      break;
    }
    const needed = requirement - progress;
    if (remainingGain >= needed) {
      remainingGain -= needed;
      level += 1;
      progress = 0;
    } else {
      progress += remainingGain;
      remainingGain = 0;
    }
  }
  return { level, progress, total: Math.max(0, start.total) + xpEarned };
}

export function invalidateExperienceCache() {
  cachedLevels = null;
  lastLoadedAt = 0;
}
