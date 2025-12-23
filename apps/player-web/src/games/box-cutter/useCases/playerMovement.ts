import { PlayerBall, Direction, Bounds, Point } from "../entities/GameState";

const PLAYER_SPEED = 200; // pixels per second

export function isOnBorder(
  player: PlayerBall,
  bounds: Bounds,
  filledAreas: Bounds[] = [],
  tolerance: number = 2
): boolean {
  const { x, y } = player;
  const { x: bx, y: by, width, height } = bounds;

  // Check outer bounds
  const onLeft = Math.abs(x - bx) <= tolerance;
  const onRight = Math.abs(x - (bx + width)) <= tolerance;
  const onTop = Math.abs(y - by) <= tolerance;
  const onBottom = Math.abs(y - (by + height)) <= tolerance;

  if (onLeft || onRight || onTop || onBottom) return true;

  // Check edges of filled areas
  for (const area of filledAreas) {
    const onAreaLeft =
      Math.abs(x - area.x) <= tolerance &&
      y >= area.y - tolerance &&
      y <= area.y + area.height + tolerance;
    const onAreaRight =
      Math.abs(x - (area.x + area.width)) <= tolerance &&
      y >= area.y - tolerance &&
      y <= area.y + area.height + tolerance;
    const onAreaTop =
      Math.abs(y - area.y) <= tolerance &&
      x >= area.x - tolerance &&
      x <= area.x + area.width + tolerance;
    const onAreaBottom =
      Math.abs(y - (area.y + area.height)) <= tolerance &&
      x >= area.x - tolerance &&
      x <= area.x + area.width + tolerance;

    if (onAreaLeft || onAreaRight || onAreaTop || onAreaBottom) return true;
  }

  return false;
}

export function canMoveInDirection(
  player: PlayerBall,
  direction: Direction,
  bounds: Bounds,
  filledAreas: Bounds[] = [],
  tolerance: number = 2
): boolean {
  const { x, y } = player;
  const { x: bx, y: by, width, height } = bounds;

  // Helper to check if a position would be inside a filled area
  const isInsideFilledArea = (px: number, py: number): boolean => {
    for (const area of filledAreas) {
      if (px >= area.x && px <= area.x + area.width && py >= area.y && py <= area.y + area.height) {
        return true;
      }
    }
    return false;
  };

  const onLeft = Math.abs(x - bx) <= tolerance;
  const onRight = Math.abs(x - (bx + width)) <= tolerance;
  const onTop = Math.abs(y - by) <= tolerance;
  const onBottom = Math.abs(y - (by + height)) <= tolerance;

  // Check if on edge of any filled area
  let onFilledEdge = false;
  for (const area of filledAreas) {
    const onAreaLeft =
      Math.abs(x - area.x) <= tolerance &&
      y >= area.y - tolerance &&
      y <= area.y + area.height + tolerance;
    const onAreaRight =
      Math.abs(x - (area.x + area.width)) <= tolerance &&
      y >= area.y - tolerance &&
      y <= area.y + area.height + tolerance;
    const onAreaTop =
      Math.abs(y - area.y) <= tolerance &&
      x >= area.x - tolerance &&
      x <= area.x + area.width + tolerance;
    const onAreaBottom =
      Math.abs(y - (area.y + area.height)) <= tolerance &&
      x >= area.x - tolerance &&
      x <= area.x + area.width + tolerance;
    if (onAreaLeft || onAreaRight || onAreaTop || onAreaBottom) {
      onFilledEdge = true;
      break;
    }
  }

  // If currently drawing (away from border), can move in any direction within bounds and not into filled areas
  if (player.isDrawing) {
    let canMove = false;
    switch (direction) {
      case "up":
        canMove = y > by && !isInsideFilledArea(x, y - 5);
        break;
      case "down":
        canMove = y < by + height && !isInsideFilledArea(x, y + 5);
        break;
      case "left":
        canMove = x > bx && !isInsideFilledArea(x - 5, y);
        break;
      case "right":
        canMove = x < bx + width && !isInsideFilledArea(x + 5, y);
        break;
    }
    return canMove;
  }

  // If on border (outer or filled area edge), allow movement along edges or perpendicular away
  if (onFilledEdge || onLeft || onRight || onTop || onBottom) {
    switch (direction) {
      case "up":
        return y > by && !isInsideFilledArea(x, y - 5);
      case "down":
        return y < by + height && !isInsideFilledArea(x, y + 5);
      case "left":
        return x > bx && !isInsideFilledArea(x - 5, y);
      case "right":
        return x < bx + width && !isInsideFilledArea(x + 5, y);
      default:
        return false;
    }
  }

  return false;
}

export function movePlayer(
  player: PlayerBall,
  direction: Direction | null,
  bounds: Bounds,
  filledAreas: Bounds[],
  deltaSeconds: number
): PlayerBall {
  if (!direction) return player;

  const distance = PLAYER_SPEED * deltaSeconds;
  let newX = player.x;
  let newY = player.y;

  switch (direction) {
    case "up":
      newY = Math.max(bounds.y, player.y - distance);
      break;
    case "down":
      newY = Math.min(bounds.y + bounds.height, player.y + distance);
      break;
    case "left":
      newX = Math.max(bounds.x, player.x - distance);
      break;
    case "right":
      newX = Math.min(bounds.x + bounds.width, player.x + distance);
      break;
  }

  // Check if starting to draw (moving away from border)
  const wasOnBorder = isOnBorder(player, bounds, filledAreas);
  const isNowOnBorder = isOnBorder({ ...player, x: newX, y: newY }, bounds, filledAreas);

  let isDrawing = player.isDrawing;

  // Start drawing when leaving the border
  if (wasOnBorder && !isNowOnBorder && !player.isDrawing) {
    isDrawing = true;
  }

  // Note: Don't stop drawing here - let the scene handle completion when returning to border

  return {
    ...player,
    x: newX,
    y: newY,
    direction,
    isDrawing,
  };
}

export function getPlayerPathPoint(player: PlayerBall): Point {
  return { x: player.x, y: player.y };
}
