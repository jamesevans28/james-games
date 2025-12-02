export type ExperienceLevelRow = {
  level: number;
  requiredXp: number;
  cumulativeXp: number;
};

const MAX_LEVEL = 100;
const BASE_REQUIREMENT = 1100; // Level 1 starts close to a single good run
const GROWTH_FACTOR = 140; // Each level grows by this scaled power value
const CURVE = 1.35; // Non-linear growth that stays gentle early on

function requirementFor(level: number) {
  // XP follows a softened power curve so later levels feel meaningful without being unreachable
  const scaledGrowth = Math.pow(level, CURVE) * GROWTH_FACTOR;
  return Math.round(BASE_REQUIREMENT + scaledGrowth);
}

const rows: ExperienceLevelRow[] = [];
for (let level = 1; level <= MAX_LEVEL; level++) {
  const requiredXp = requirementFor(level);
  const previous = rows[rows.length - 1];
  rows.push({
    level,
    requiredXp,
    // Store the running total so UI/API calls can answer "total XP to reach level N" instantly.
    cumulativeXp: previous ? previous.cumulativeXp + requiredXp : requiredXp,
  });
}

export const DEFAULT_EXPERIENCE_LEVELS: ExperienceLevelRow[] = rows;
export const EXPERIENCE_MAX_LEVEL = MAX_LEVEL;

export function describeLevel(level: number) {
  const row = DEFAULT_EXPERIENCE_LEVELS.find((entry) => entry.level === level);
  if (!row) return null;
  return { ...row };
}
