export type ExperienceLevelRow = {
  level: number;
  requiredXp: number;
  targetMinutes: number;
  cumulativeXp: number;
};

const MAX_LEVEL = 100;
const XP_PER_MINUTE_TARGET = 48; // roughly 20 XP per 25 seconds of play time

function requirementFor(level: number) {
  // Smooth curve that keeps early levels quick while stretching long term goals
  return Math.round(110 + Math.pow(level, 1.35) * 14);
}

const rows: ExperienceLevelRow[] = [];
for (let level = 1; level <= MAX_LEVEL; level++) {
  const requiredXp = requirementFor(level);
  const targetMinutes = Math.max(1, Math.round(requiredXp / XP_PER_MINUTE_TARGET));
  const previous = rows[rows.length - 1];
  rows.push({
    level,
    requiredXp,
    targetMinutes,
    cumulativeXp: previous ? previous.cumulativeXp + requiredXp : requiredXp,
  });
}

export const DEFAULT_EXPERIENCE_LEVELS: ExperienceLevelRow[] = rows;
export const EXPERIENCE_MAX_LEVEL = MAX_LEVEL;

export function describeLevel(level: number) {
  const row = DEFAULT_EXPERIENCE_LEVELS.find((entry) => entry.level === level);
  if (!row) return null;
  return {
    ...row,
    approxHours: Number((row.cumulativeXp / (XP_PER_MINUTE_TARGET * 60)).toFixed(2)),
  };
}
