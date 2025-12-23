import { Point, Bounds, GameConfig, DEFAULT_CONFIG } from "../entities/GameState";

export function calculateEnclosedArea(path: Point[], bounds: Bounds): Bounds | null {
  if (path.length < 3) return null;

  // Find bounding box of the path
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const point of path) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  // Clamp to play bounds
  minX = Math.max(bounds.x, minX);
  maxX = Math.min(bounds.x + bounds.width, maxX);
  minY = Math.max(bounds.y, minY);
  maxY = Math.min(bounds.y + bounds.height, maxY);

  const width = maxX - minX;
  const height = maxY - minY;

  if (width <= 0 || height <= 0) return null;

  return { x: minX, y: minY, width, height };
}

export function calculateCoverage(filledAreas: Bounds[], totalBounds: Bounds): number {
  const totalArea = totalBounds.width * totalBounds.height;
  if (totalArea === 0) return 0;

  let coveredArea = 0;
  for (const area of filledAreas) {
    coveredArea += area.width * area.height;
  }

  return (coveredArea / totalArea) * 100;
}

export function calculateScore(
  newArea: Bounds,
  totalBounds: Bounds,
  config: GameConfig = DEFAULT_CONFIG
): number {
  const areaSize = newArea.width * newArea.height;
  const totalArea = totalBounds.width * totalBounds.height;
  const areaPct = (areaSize / totalArea) * 100;

  // Reward larger enclosures with multiplier
  const multiplier = 1 + (areaPct / 100) * config.comboMultiplier;
  const points = Math.floor(areaPct * config.baseAreaPoints * multiplier);

  return points;
}

export function determineFilledArea(
  oldBounds: Bounds,
  enclosedArea: Bounds,
  enemyX: number,
  enemyY: number
): Bounds {
  // Determine which edge the enclosed area touches
  const touchesLeft = Math.abs(enclosedArea.x - oldBounds.x) < 5;
  const touchesRight =
    Math.abs(enclosedArea.x + enclosedArea.width - (oldBounds.x + oldBounds.width)) < 5;
  const touchesTop = Math.abs(enclosedArea.y - oldBounds.y) < 5;
  const touchesBottom =
    Math.abs(enclosedArea.y + enclosedArea.height - (oldBounds.y + oldBounds.height)) < 5;

  // Determine which side of the line the enemy is on and return the opposite side to fill
  let filledArea: Bounds;

  if (touchesLeft) {
    // Line from left edge - check if enemy is in left slice or right slice
    const enemyInLeftSlice = enemyX < enclosedArea.x + enclosedArea.width;

    if (enemyInLeftSlice) {
      // Enemy is in enclosed area on left, shade right side
      filledArea = {
        x: enclosedArea.x + enclosedArea.width,
        y: oldBounds.y,
        width: oldBounds.width - enclosedArea.width,
        height: oldBounds.height,
      };
    } else {
      // Enemy is in right area, shade left
      filledArea = {
        x: oldBounds.x,
        y: enclosedArea.y,
        width: enclosedArea.width,
        height: enclosedArea.height,
      };
    }
  } else if (touchesRight) {
    // Line from right edge
    const enemyInRightSlice = enemyX > enclosedArea.x;

    if (enemyInRightSlice) {
      // Enemy is in enclosed area on right, shade left side
      filledArea = {
        x: oldBounds.x,
        y: oldBounds.y,
        width: enclosedArea.x - oldBounds.x,
        height: oldBounds.height,
      };
    } else {
      // Enemy is in left area, shade right
      filledArea = {
        x: enclosedArea.x,
        y: enclosedArea.y,
        width: enclosedArea.width,
        height: enclosedArea.height,
      };
    }
  } else if (touchesTop) {
    // Line from top edge
    const enemyInTopSlice = enemyY < enclosedArea.y + enclosedArea.height;

    if (enemyInTopSlice) {
      // Enemy is in enclosed area on top, shade bottom
      filledArea = {
        x: oldBounds.x,
        y: enclosedArea.y + enclosedArea.height,
        width: oldBounds.width,
        height: oldBounds.height - enclosedArea.height,
      };
    } else {
      // Enemy is in bottom area, shade top
      filledArea = {
        x: enclosedArea.x,
        y: oldBounds.y,
        width: enclosedArea.width,
        height: enclosedArea.height,
      };
    }
  } else if (touchesBottom) {
    // Line from bottom edge
    const enemyInBottomSlice = enemyY > enclosedArea.y;

    if (enemyInBottomSlice) {
      // Enemy is in enclosed area on bottom, shade top
      filledArea = {
        x: oldBounds.x,
        y: oldBounds.y,
        width: oldBounds.width,
        height: enclosedArea.y - oldBounds.y,
      };
    } else {
      // Enemy is in top area, shade bottom
      filledArea = {
        x: enclosedArea.x,
        y: enclosedArea.y,
        width: enclosedArea.width,
        height: enclosedArea.height,
      };
    }
  } else {
    // No clear edge, default behavior
    filledArea = enclosedArea;
  }

  return filledArea;
}
