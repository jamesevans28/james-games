import { EnemyBall, Bounds } from "../entities/GameState";

export function updateEnemyBall(
  enemy: EnemyBall,
  bounds: Bounds,
  filledAreas: Bounds[],
  deltaSeconds: number
): EnemyBall {
  let newX = enemy.x + enemy.velocityX * deltaSeconds;
  let newY = enemy.y + enemy.velocityY * deltaSeconds;
  let newVelocityX = enemy.velocityX;
  let newVelocityY = enemy.velocityY;

  // Bounce off outer bounds
  if (newX - enemy.radius <= bounds.x) {
    newX = bounds.x + enemy.radius;
    newVelocityX = Math.abs(enemy.velocityX);
  } else if (newX + enemy.radius >= bounds.x + bounds.width) {
    newX = bounds.x + bounds.width - enemy.radius;
    newVelocityX = -Math.abs(enemy.velocityX);
  }

  if (newY - enemy.radius <= bounds.y) {
    newY = bounds.y + enemy.radius;
    newVelocityY = Math.abs(enemy.velocityY);
  } else if (newY + enemy.radius >= bounds.y + bounds.height) {
    newY = bounds.y + bounds.height - enemy.radius;
    newVelocityY = -Math.abs(enemy.velocityY);
  }

  // Check collision with filled areas
  for (const area of filledAreas) {
    // Check if ball overlaps with filled area
    const closestX = Math.max(area.x, Math.min(newX, area.x + area.width));
    const closestY = Math.max(area.y, Math.min(newY, area.y + area.height));

    const distX = newX - closestX;
    const distY = newY - closestY;
    const distSq = distX * distX + distY * distY;

    if (distSq < enemy.radius * enemy.radius) {
      // Collision detected - bounce off the filled area
      // Determine which edge was hit
      const fromLeft = newX < area.x;
      const fromRight = newX > area.x + area.width;
      const fromTop = newY < area.y;
      const fromBottom = newY > area.y + area.height;

      if (fromLeft || fromRight) {
        newVelocityX = -newVelocityX;
        newX = fromLeft ? area.x - enemy.radius : area.x + area.width + enemy.radius;
      }
      if (fromTop || fromBottom) {
        newVelocityY = -newVelocityY;
        newY = fromTop ? area.y - enemy.radius : area.y + area.height + enemy.radius;
      }
    }
  }

  return {
    ...enemy,
    x: newX,
    y: newY,
    velocityX: newVelocityX,
    velocityY: newVelocityY,
  };
}
