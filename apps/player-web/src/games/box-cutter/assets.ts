import Phaser from "phaser";

export const ASSETS = {
  PLAYER: "player_robot",
  ENEMY: "enemy_fireball",
  PARTICLE_CYAN: "particle_cyan",
  SPARK: "spark",
  PIXEL: "pixel_square",
};

export function preloadAssets(scene: Phaser.Scene) {
  scene.load.svg(ASSETS.PLAYER, "/assets/box-cutter/player-robot.svg", { width: 64, height: 64 });
  scene.load.svg(ASSETS.ENEMY, "/assets/box-cutter/enemy-fireball.svg", { width: 64, height: 64 });
  scene.load.svg(ASSETS.PARTICLE_CYAN, "/assets/box-cutter/particle-cyan.svg", {
    width: 16,
    height: 16,
  });
  scene.load.svg(ASSETS.SPARK, "/assets/box-cutter/spark.svg", { width: 16, height: 16 });
  scene.load.svg(ASSETS.PIXEL, "/assets/box-cutter/pixel-square.svg", { width: 8, height: 8 });
}

export function createBackground(scene: Phaser.Scene, width: number, height: number) {
  const g = scene.add.graphics();

  // Dark blue gradient background
  g.fillGradientStyle(0x001133, 0x001133, 0x000a1a, 0x000a1a, 1, 1, 1, 1);
  g.fillRect(0, 0, width, height);

  // Grid lines
  g.lineStyle(1, 0x0d2340, 0.6);
  const gridSize = 40;
  for (let x = 0; x < width; x += gridSize) {
    g.lineBetween(x, 0, x, height);
  }
  for (let y = 0; y < height; y += gridSize) {
    g.lineBetween(0, y, width, y);
  }

  // Circuit patterns
  g.lineStyle(2, 0x00aaff, 0.4);

  // Horizontal circuits
  for (let i = 0; i < 8; i++) {
    const y = 100 + i * 100;
    const startX = Math.random() * 100;
    const endX = width - Math.random() * 100;

    g.beginPath();
    g.moveTo(startX, y);
    g.lineTo(startX + 60, y);
    g.lineTo(startX + 80, y - 20);
    g.lineTo(startX + 120, y - 20);
    g.lineTo(startX + 140, y);
    g.lineTo(endX, y);
    g.strokePath();

    // Circuit nodes
    g.fillStyle(0x00ffff, 0.6);
    g.fillCircle(startX + 80, y - 20, 3);
    g.fillCircle(startX + 120, y - 20, 3);
  }

  // Vertical accent lines
  g.lineStyle(1, 0x00ccff, 0.3);
  for (let i = 0; i < 5; i++) {
    const x = 50 + i * 100 + Math.random() * 50;
    g.lineBetween(x, 0, x, height);
  }

  return g;
}
