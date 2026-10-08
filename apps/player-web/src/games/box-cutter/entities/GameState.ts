export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Direction = "up" | "down" | "left" | "right";

export interface EnemyBall {
  x: number;
  y: number;
  /** Per-axis velocity in px/s (the ball always travels diagonally). */
  velocityX: number;
  velocityY: number;
  radius: number;
}

export interface PlayerBall {
  x: number;
  y: number;
  /** True while the player is away from the border, drawing a live line. */
  isDrawing: boolean;
}

export interface GameConfig {
  /** Enemy per-axis speed on level 1, px/s. */
  initialBallSpeed: number;
  ballSpeedIncrement: number;
  maxBallSpeed: number;
  /** Coverage (%) needed to clear level 1. */
  initialTargetCoverage: number;
  targetCoverageIncrement: number;
  maxTargetCoverage: number;
  baseAreaPoints: number;
  comboMultiplier: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  initialBallSpeed: 200,
  ballSpeedIncrement: 20,
  maxBallSpeed: 400,
  initialTargetCoverage: 75,
  targetCoverageIncrement: 2,
  maxTargetCoverage: 95,
  baseAreaPoints: 100,
  comboMultiplier: 1.5,
};
