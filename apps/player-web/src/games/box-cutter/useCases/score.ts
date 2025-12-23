import type { GameConfig } from "../entities/GameState";

export function pointsForCapture(areaPct: number, config: GameConfig): number {
  // Bigger single captures are worth more (nonlinear multiplier).
  const multiplier = 1 + (areaPct / 100) * config.comboMultiplier;
  return Math.floor(areaPct * config.baseAreaPoints * multiplier);
}
