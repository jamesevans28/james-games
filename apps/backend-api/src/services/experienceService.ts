import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from "../config/aws.js";
import { config } from "../config/index.js";
import {
  DEFAULT_EXPERIENCE_LEVELS,
  EXPERIENCE_MAX_LEVEL,
  type ExperienceLevelRow,
} from "../data/experienceLevels.js";
import { getUser } from "./dynamoService.js";
import { log } from "../lib/log.js";

const ddb = DynamoDBDocumentClient.from(dynamoClient);

export type ExperienceSummary = {
  level: number;
  progress: number;
  required: number;
  percent: number;
  remaining: number;
  total: number;
  lastUpdated?: string;
};

let cachedLevels: ExperienceLevelRow[] | null = null;
let lastLoadedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes is plenty for admin updates

async function loadExperienceLevels(): Promise<ExperienceLevelRow[]> {
  const now = Date.now();
  if (cachedLevels && now - lastLoadedAt < CACHE_TTL_MS) {
    return cachedLevels;
  }
  if (!config.tables.experienceLevels) {
    cachedLevels = DEFAULT_EXPERIENCE_LEVELS;
    lastLoadedAt = now;
    return cachedLevels;
  }
  try {
    const res = await ddb.send(
      new ScanCommand({
        TableName: config.tables.experienceLevels,
      })
    );
    const rows = ((res.Items || []) as Array<{ level: number; requiredXp: number }>).filter(
      (row) => typeof row.level === "number" && typeof row.requiredXp === "number"
    );
    if (rows.length) {
      rows.sort((a, b) => a.level - b.level);
      const normalized: ExperienceLevelRow[] = [];
      rows.forEach((row, index) => {
        const prev = normalized[index - 1];
        const fallback =
          DEFAULT_EXPERIENCE_LEVELS[Math.min(index, DEFAULT_EXPERIENCE_LEVELS.length - 1)];
        normalized.push({
          level: row.level,
          requiredXp: row.requiredXp,
          cumulativeXp: prev ? prev.cumulativeXp + row.requiredXp : row.requiredXp,
        });
      });
      cachedLevels = normalized;
      lastLoadedAt = now;
      return cachedLevels;
    }
  } catch (err) {
    log.warn("experience_levels_load_failed", undefined, err);
  }
  cachedLevels = DEFAULT_EXPERIENCE_LEVELS;
  lastLoadedAt = now;
  return cachedLevels;
}

function ensureRequirement(levels: ExperienceLevelRow[], level: number): ExperienceLevelRow {
  const clamped = Math.min(
    Math.max(level, 1),
    levels[levels.length - 1]?.level ?? EXPERIENCE_MAX_LEVEL
  );
  const found = levels.find((row) => row.level === clamped);
  if (found) return found;
  const last = levels[levels.length - 1];
  if (!last) throw new Error("experience_levels_empty");
  return last;
}

export async function getExperienceSummary(userId: string): Promise<ExperienceSummary | null> {
  const user = await getUser(userId);
  if (!user) return null;
  return buildSummary(user);
}

export function buildSummary(user: any): ExperienceSummary {
  const level = Math.min(Math.max(Number(user?.xpLevel ?? 1), 1), EXPERIENCE_MAX_LEVEL);
  const progress = Math.max(0, Number(user?.xpProgress ?? 0));
  const total = Math.max(0, Number(user?.xpTotal ?? 0));
  const levels = cachedLevels || DEFAULT_EXPERIENCE_LEVELS;
  const requirementRow = ensureRequirement(levels, level);
  // `requiredXp` represents how much XP must be banked at the current level before leveling up.
  const required = Math.max(1, Number(requirementRow?.requiredXp || 500));
  const clampedProgress = Math.min(progress, required);
  const percent = Math.min(1, clampedProgress / required);
  return {
    level,
    progress: clampedProgress,
    required,
    percent,
    remaining: Math.max(0, required - clampedProgress),
    total,
    lastUpdated: user?.xpUpdatedAt || user?.updatedAt,
  };
}

/** Pure level-up maths: apply `xpEarned` to a level/progress/total triple. */
export function addExperience(
  levels: ExperienceLevelRow[],
  start: { level: number; progress: number; total: number },
  xpEarned: number
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

const XP_WRITE_ATTEMPTS = 3;

/**
 * Add XP to a user. The write is conditional on xpUpdatedAt being unchanged since
 * the read, so two runs finishing together can't overwrite each other's XP.
 */
export async function applyExperienceToUser(userId: string, xpEarned: number) {
  if (xpEarned <= 0) {
    const summary = await getExperienceSummary(userId);
    if (!summary) throw new Error("user_not_found");
    return { summary, awarded: 0 };
  }
  const levels = await loadExperienceLevels();

  for (let attempt = 1; attempt <= XP_WRITE_ATTEMPTS; attempt++) {
    const user = await getUser(userId);
    if (!user) throw new Error("user_not_found");
    const prevStamp: string | undefined = user.xpUpdatedAt;
    const next = addExperience(
      levels,
      {
        level: Number(user.xpLevel ?? 1),
        progress: Number(user.xpProgress ?? 0),
        total: Number(user.xpTotal ?? 0),
      },
      xpEarned
    );
    const stamp = new Date().toISOString();
    try {
      await ddb.send(
        new UpdateCommand({
          TableName: config.tables.users,
          Key: { userId },
          UpdateExpression:
            "SET xpLevel = :lvl, xpProgress = :prog, xpTotal = :tot, xpUpdatedAt = :ts, updatedAt = :ts",
          ConditionExpression: prevStamp
            ? "attribute_exists(userId) AND xpUpdatedAt = :prev"
            : "attribute_exists(userId) AND attribute_not_exists(xpUpdatedAt)",
          ExpressionAttributeValues: {
            ":lvl": next.level,
            ":prog": next.progress,
            ":tot": next.total,
            ":ts": stamp,
            ...(prevStamp ? { ":prev": prevStamp } : {}),
          },
        })
      );
      const summary = buildSummary({
        xpLevel: next.level,
        xpProgress: next.progress,
        xpTotal: next.total,
        xpUpdatedAt: stamp,
      });
      return { summary, awarded: xpEarned };
    } catch (err: any) {
      if (err?.name !== "ConditionalCheckFailedException") throw err;
      // Someone else wrote first (or the user vanished): re-read and try again.
    }
  }
  throw new Error("xp_write_conflict");
}

export function invalidateExperienceCache() {
  cachedLevels = null;
  lastLoadedAt = 0;
}
