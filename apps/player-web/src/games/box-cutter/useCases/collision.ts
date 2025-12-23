import { Point, EnemyBall } from "../entities/GameState";

export function checkLineSegmentCollision(ball: EnemyBall, p1: Point, p2: Point): boolean {
  // Check if ball collides with line segment from p1 to p2
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    // p1 and p2 are the same point
    const distSq = (ball.x - p1.x) ** 2 + (ball.y - p1.y) ** 2;
    return distSq <= ball.radius ** 2;
  }

  // Find closest point on line segment to ball
  const t = Math.max(0, Math.min(1, ((ball.x - p1.x) * dx + (ball.y - p1.y) * dy) / lengthSq));

  const closestX = p1.x + t * dx;
  const closestY = p1.y + t * dy;

  const distSq = (ball.x - closestX) ** 2 + (ball.y - closestY) ** 2;
  return distSq <= ball.radius ** 2;
}

export function checkPathCollision(ball: EnemyBall, path: Point[]): boolean {
  if (path.length < 2) return false;

  for (let i = 0; i < path.length - 1; i++) {
    if (checkLineSegmentCollision(ball, path[i], path[i + 1])) {
      return true;
    }
  }

  return false;
}
