import {
  GameState,
  GameConfig,
  DEFAULT_CONFIG,
  Bounds,
  EnemyBall,
  PlayerBall,
} from "../entities/GameState";

export function createInitialState(
  playBounds: Bounds,
  config: GameConfig = DEFAULT_CONFIG
): GameState {
  const enemyBall: EnemyBall = {
    x: playBounds.x + playBounds.width / 2,
    y: playBounds.y + playBounds.height / 2,
    velocityX: config.initialBallSpeed,
    velocityY: config.initialBallSpeed,
    radius: 10,
    speed: config.initialBallSpeed,
  };

  const playerBall: PlayerBall = {
    x: playBounds.x,
    y: playBounds.y,
    radius: 8,
    isDrawing: false,
    direction: null,
  };

  return {
    playerBall,
    enemyBall,
    playBounds,
    currentPath: [],
    filledAreas: [],
    score: 0,
    bestScore: 0,
    coverage: 0,
    targetCoverage: config.initialTargetCoverage,
    level: 1,
    gameOver: false,
    levelComplete: false,
  };
}

export function advanceLevel(state: GameState, config: GameConfig = DEFAULT_CONFIG): GameState {
  const newSpeed = state.enemyBall.speed + config.ballSpeedIncrement;
  const newTarget = Math.min(95, state.targetCoverage + config.targetCoverageIncrement);

  return {
    ...state,
    level: state.level + 1,
    targetCoverage: newTarget,
    coverage: 0,
    filledAreas: [],
    currentPath: [],
    levelComplete: false,
    playBounds: state.playBounds,
    playerBall: {
      ...state.playerBall,
      x: state.playBounds.x,
      y: state.playBounds.y,
      isDrawing: false,
      direction: null,
    },
    enemyBall: {
      ...state.enemyBall,
      x: state.playBounds.x + state.playBounds.width / 2,
      y: state.playBounds.y + state.playBounds.height / 2,
      speed: newSpeed,
      velocityX: (state.enemyBall.velocityX / Math.abs(state.enemyBall.velocityX)) * newSpeed,
      velocityY: (state.enemyBall.velocityY / Math.abs(state.enemyBall.velocityY)) * newSpeed,
    },
  };
}
