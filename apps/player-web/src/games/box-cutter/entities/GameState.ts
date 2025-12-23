export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EnemyBall {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  radius: number;
  speed: number;
}

export interface PlayerBall {
  x: number;
  y: number;
  radius: number;
  isDrawing: boolean;
  direction: Direction | null;
}

export type Direction = "up" | "down" | "left" | "right";

export interface GameState {
  playerBall: PlayerBall;
  enemyBall: EnemyBall;
  playBounds: Bounds;
  currentPath: Point[];
  filledAreas: Bounds[];
  score: number;
  bestScore: number;
  coverage: number;
  targetCoverage: number;
  level: number;
  gameOver: boolean;
  levelComplete: boolean;
}

export interface GameConfig {
  initialBallSpeed: number;
  ballSpeedIncrement: number;
  initialTargetCoverage: number;
  targetCoverageIncrement: number;
  baseAreaPoints: number;
  comboMultiplier: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  initialBallSpeed: 200,
  ballSpeedIncrement: 20,
  initialTargetCoverage: 75,
  targetCoverageIncrement: 2,
  baseAreaPoints: 100,
  comboMultiplier: 1.5,
};
