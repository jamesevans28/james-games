import Phaser from "phaser";
import { ASSETS, preloadAssets, createBackground } from "../assets";
import { GameState, Direction, DEFAULT_CONFIG } from "../entities/GameState";
import { createInitialState, advanceLevel } from "../useCases/stateManager";
import {
  createGrid,
  worldToCell,
  cellToWorldCenter,
  type Grid,
  type Cell,
  idx,
} from "../useCases/grid";
import { rasterizePolyline } from "../useCases/rasterize";
import { applyCapture } from "../useCases/captureFill";
import { computeBorderMask } from "../useCases/borderMask";
import { pointsForCapture } from "../useCases/score";
import { createDPad, type DPadDirection, type DPadInstance } from "../../../game/ui/dpad";
import { dispatchGameOver } from "../../../utils/gameEvents";

const GAME_WIDTH = 540;
const GAME_HEIGHT = 960;
const UI_HEIGHT = 100;
const DPAD_HEIGHT = 200;
const PLAY_AREA_HEIGHT = GAME_HEIGHT - UI_HEIGHT - DPAD_HEIGHT;

export class MainScene extends Phaser.Scene {
  private state!: GameState;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private enemySprite!: Phaser.GameObjects.Sprite;
  private borderGraphics!: Phaser.GameObjects.Graphics;
  private pathGraphics!: Phaser.GameObjects.Graphics;
  private filledGraphics!: Phaser.GameObjects.Graphics;
  private currentDirection: Direction | null = null;
  private playerStepCarrySeconds = 0;
  private particles!: Phaser.GameObjects.Particles.ParticleEmitter;

  private grid!: Grid;
  private filledMask!: Uint8Array; // 1 = out of play
  private wallMask!: Uint8Array; // 1 = current drawing line
  private borderMask!: Uint8Array; // 1 = empty cell adjacent to filled or outer boundary
  private pathCells: Cell[] = [];

  private staticGraphicsDirty = true;

  // UI elements
  private levelText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private bestScoreText!: Phaser.GameObjects.Text;
  private coverageText!: Phaser.GameObjects.Text;
  private targetText!: Phaser.GameObjects.Text;
  private gameOverText!: Phaser.GameObjects.Text;
  private levelCompleteText!: Phaser.GameObjects.Text;
  private levelBannerText?: Phaser.GameObjects.Text;

  private gameOverAwaitingTap = false;

  private dpad!: DPadInstance;

  private gameWidth!: number;
  private gameHeight!: number;

  constructor() {
    super({ key: "MainScene" });
  }

  preload() {
    preloadAssets(this);
  }

  create() {
    // Get actual game dimensions
    this.gameWidth = this.scale.width;
    this.gameHeight = this.scale.height;

    createBackground(this, this.gameWidth, this.gameHeight);
    const bestScore = this.loadBestScore();

    // Calculate responsive dimensions
    const uiHeight = this.gameHeight * 0.104; // ~10% of screen
    const dpadHeight = this.gameHeight * 0.208; // ~20% of screen
    const playAreaHeight = this.gameHeight - uiHeight - dpadHeight;
    const horizontalPadding = this.gameWidth * 0.093; // ~9% padding
    const verticalPadding = playAreaHeight * 0.033; // ~3% padding

    this.state = createInitialState(
      {
        x: horizontalPadding,
        y: uiHeight + verticalPadding,
        width: this.gameWidth - horizontalPadding * 2,
        height: playAreaHeight - verticalPadding * 2,
      },
      DEFAULT_CONFIG
    );
    this.state.bestScore = bestScore;

    // Grid-backed playfield for exact (non-rect) capture + merged shapes.
    // Smaller cellSize = more precise captures, more work per frame.
    this.grid = createGrid(this.state.playBounds, 3);
    this.filledMask = new Uint8Array(this.grid.cols * this.grid.rows);
    this.wallMask = new Uint8Array(this.grid.cols * this.grid.rows);
    this.borderMask = computeBorderMask(this.grid, this.filledMask);
    this.staticGraphicsDirty = true;

    // Snap player/enemy to grid cell centers to keep borders reliable.
    const playerStart = cellToWorldCenter(this.grid, 0, 0);
    this.state.playerBall.x = playerStart.x;
    this.state.playerBall.y = playerStart.y;

    const enemyStart = cellToWorldCenter(
      this.grid,
      Math.floor(this.grid.cols / 2),
      Math.floor(this.grid.rows / 2)
    );
    this.state.enemyBall.x = enemyStart.x;
    this.state.enemyBall.y = enemyStart.y;

    this.setupGraphics();
    this.setupSprites();
    this.setupUI();
    this.setupDPad();
    this.setupParticles();
    this.addBackgroundPixels();

    this.showLevelBanner(this.state.level);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.dpad?.destroy();
    });
  }

  private setupGraphics() {
    this.borderGraphics = this.add.graphics();
    this.filledGraphics = this.add.graphics();
    this.pathGraphics = this.add.graphics();
  }

  private setupSprites() {
    this.enemySprite = this.add.sprite(
      this.state.enemyBall.x,
      this.state.enemyBall.y,
      ASSETS.ENEMY
    );
    this.enemySprite.setScale(0.8);

    // Add pulsing glow to enemy
    this.tweens.add({
      targets: this.enemySprite,
      scaleX: 0.9,
      scaleY: 0.9,
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.playerSprite = this.add.sprite(
      this.state.playerBall.x,
      this.state.playerBall.y,
      ASSETS.PLAYER
    );
    this.playerSprite.setScale(0.7);

    // Add glow/pulse effect to player
    this.tweens.add({
      targets: this.playerSprite,
      scaleX: 0.75,
      scaleY: 0.75,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private setupParticles() {
    this.particles = this.add.particles(0, 0, ASSETS.PARTICLE_CYAN, {
      speed: { min: 30, max: 70 },
      scale: { start: 0.8, end: 0 },
      lifespan: 500,
      blendMode: "ADD",
      frequency: 15,
    });
    this.particles.startFollow(this.playerSprite);
  }

  private setupUI() {
    // Responsive font sizes based on screen dimensions
    const baseFontSize = Math.min(this.gameWidth, this.gameHeight) * 0.045;
    const scoreFontSize = baseFontSize * 1.2;
    const labelFontSize = baseFontSize * 0.8;
    const gameOverFontSize = baseFontSize * 2.3;
    const levelCompleteFontSize = baseFontSize * 1.8;

    const padding = this.gameWidth * 0.037; // ~4% padding

    // Golden title style matching the reference image
    const goldStyle = {
      fontFamily: "Impact, 'Arial Black', sans-serif",
      fontSize: `${scoreFontSize}px`,
      color: "#FFD700",
      stroke: "#8B4513",
      strokeThickness: Math.max(4, scoreFontSize * 0.25),
      shadow: {
        blur: 8,
        color: "#FF8800",
        fill: true,
        offsetX: 0,
        offsetY: 0,
      },
    };

    const cyanStyle = {
      fontFamily: "Impact, 'Arial Black', sans-serif",
      fontSize: `${baseFontSize}px`,
      color: "#00FFFF",
      stroke: "#003366",
      strokeThickness: Math.max(3, baseFontSize * 0.2),
      shadow: {
        blur: 6,
        color: "#0099FF",
        fill: true,
      },
    };

    const labelStyle = {
      fontFamily: "Arial Black, sans-serif",
      fontSize: `${labelFontSize}px`,
      color: "#FFFFFF",
      stroke: "#000033",
      strokeThickness: Math.max(2, labelFontSize * 0.19),
    };

    const gameOverStyle = {
      fontFamily: "Impact, 'Arial Black', sans-serif",
      fontSize: `${gameOverFontSize}px`,
      color: "#FF3333",
      stroke: "#660000",
      strokeThickness: Math.max(6, gameOverFontSize * 0.14),
      align: "center",
      shadow: {
        blur: 12,
        color: "#FF0000",
        fill: true,
      },
    };

    const levelCompleteStyle = {
      fontFamily: "Impact, 'Arial Black', sans-serif",
      fontSize: `${levelCompleteFontSize}px`,
      color: "#00FF00",
      stroke: "#003300",
      strokeThickness: Math.max(6, levelCompleteFontSize * 0.18),
      align: "center",
      shadow: {
        blur: 12,
        color: "#00FF00",
        fill: true,
      },
    };

    this.levelText = this.add.text(padding, padding * 0.5, "Level 1", labelStyle);

    this.scoreText = this.add.text(padding, padding * 1.6, "Score: 0", goldStyle);

    this.bestScoreText = this.add.text(padding, padding * 3.1, "Best: 0", {
      ...labelStyle,
      color: "#AAAAAA",
    });

    this.coverageText = this.add
      .text(this.gameWidth - padding, padding * 1.6, "Coverage: 0%", cyanStyle)
      .setOrigin(1, 0);

    this.targetText = this.add
      .text(this.gameWidth - padding, padding * 3.1, "Target: 75%", {
        ...labelStyle,
        color: "#FFFF00",
      })
      .setOrigin(1, 0);

    this.gameOverText = this.add
      .text(this.gameWidth / 2, this.gameHeight / 2, "GAME OVER\nTap to Continue", gameOverStyle)
      .setOrigin(0.5)
      .setVisible(false);

    this.levelCompleteText = this.add
      .text(
        this.gameWidth / 2,
        this.gameHeight / 2,
        "LEVEL COMPLETE!\nTap to Continue",
        levelCompleteStyle
      )
      .setOrigin(0.5)
      .setVisible(false);
  }

  private setupDPad() {
    const handle = (direction: DPadDirection | null) => {
      if (this.state.gameOver || this.state.levelComplete) {
        this.currentDirection = null;
        return;
      }

      // In sticky mode, the D-pad may emit null (toggle off) or a direction (toggle on).
      this.currentDirection = direction;

      // Nudge immediately so short taps still move at least one cell.
      this.updatePlayer(1 / 60);
    };

    this.dpad = createDPad(this, {
      centerX: this.gameWidth / 2,
      bottomPadding: this.gameHeight * 0.021,
      buttonSize: Math.min(this.gameWidth, this.gameHeight) * 0.111,
      spacing: Math.min(this.gameWidth, this.gameHeight) * 0.148,
      alpha: 0.8,
      onDirectionChange: handle,
      enabled: () => !this.state.gameOver && !this.state.levelComplete,
      keyboard: true,
      mode: "sticky",
    });
  }

  update(_time: number, delta: number) {
    if (this.state.gameOver) return;

    if (this.state.levelComplete) {
      this.handleLevelCompleteInput();
      return;
    }

    // Clamp delta to keep physics stable on mobile (prevents tunneling/sticking after a hitch).
    const deltaSeconds = Math.min(delta / 1000, 1 / 30);

    // Update player on grid
    this.updatePlayer(deltaSeconds);

    // Update enemy with collisions against filled + current wall
    const hitLiveWall = this.updateEnemy(deltaSeconds);
    if (hitLiveWall) {
      this.endGame();
      return;
    }

    this.updateSprites();
    this.updateGraphics();
    this.updateUI();
  }

  private completeLevel() {
    this.state.levelComplete = true;
    this.levelCompleteText.setVisible(true);

    // Pulsing animation for level complete text
    this.tweens.add({
      targets: this.levelCompleteText,
      scale: { from: 0.8, to: 1.2 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Celebration particles
    this.createCelebrationEffect();

    this.saveBestScore();
  }

  private endGame() {
    this.state.gameOver = true;
    this.gameOverText.setVisible(true);

    // Shake animation for game over text
    this.tweens.add({
      targets: this.gameOverText,
      y: this.gameOverText.y + 10,
      duration: 100,
      yoyo: true,
      repeat: 3,
      ease: "Quad.easeInOut",
    });

    this.particles.stop();
    this.saveBestScore();

    if (this.gameOverAwaitingTap) return;
    this.gameOverAwaitingTap = true;

    // Pause and wait for a deliberate tap/click, then hand off to the shared ScoreDialog.
    this.time.delayedCall(600, () => {
      this.input.once("pointerdown", () => {
        try {
          dispatchGameOver({ gameId: "box-cutter", score: this.state.score, ts: Date.now() });
        } catch {}
      });
    });
  }

  private showLevelBanner(level: number) {
    this.levelBannerText?.destroy();
    const bannerFontSize = Math.min(this.gameWidth, this.gameHeight) * 0.133;
    this.levelBannerText = this.add
      .text(this.gameWidth / 2, this.gameHeight / 2, `LEVEL ${level}`, {
        fontFamily: "Impact, 'Arial Black', sans-serif",
        fontSize: `${bannerFontSize}px`,
        color: "#FFD700",
        align: "center",
        stroke: "#8B4513",
        strokeThickness: Math.max(8, bannerFontSize * 0.139),
        shadow: {
          blur: 15,
          color: "#FF8800",
          fill: true,
        },
      })
      .setOrigin(0.5)
      .setDepth(50)
      .setScale(0);

    // Scale up, then fade out
    this.tweens.add({
      targets: this.levelBannerText,
      scale: { from: 0, to: 1.5 },
      alpha: { from: 1, to: 0 },
      duration: 1200,
      ease: "Back.easeOut",
      onComplete: () => {
        this.levelBannerText?.destroy();
        this.levelBannerText = undefined;
      },
    });
  }

  private createCelebrationEffect() {
    // Burst of particles from center
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const particle = this.add.sprite(this.gameWidth / 2, this.gameHeight / 2, ASSETS.SPARK);

      this.tweens.add({
        targets: particle,
        x: this.gameWidth / 2 + Math.cos(angle) * 200,
        y: this.gameHeight / 2 + Math.sin(angle) * 200,
        alpha: { from: 1, to: 0 },
        scale: { from: 1, to: 0 },
        duration: 1000,
        ease: "Quad.easeOut",
        onComplete: () => particle.destroy(),
      });
    }
  }

  private handleLevelCompleteInput() {
    if (this.input.activePointer.isDown) {
      this.state = advanceLevel(this.state, DEFAULT_CONFIG);
      this.levelCompleteText.setVisible(false);
      this.currentDirection = null;
      this.playerStepCarrySeconds = 0;
      this.particles.start();

      // Rebuild grid/masks for the new level.
      this.grid = createGrid(this.state.playBounds, 3);
      this.filledMask = new Uint8Array(this.grid.cols * this.grid.rows);
      this.wallMask = new Uint8Array(this.grid.cols * this.grid.rows);
      this.borderMask = computeBorderMask(this.grid, this.filledMask);

      const playerStart = cellToWorldCenter(this.grid, 0, 0);
      this.state.playerBall.x = playerStart.x;
      this.state.playerBall.y = playerStart.y;
      this.state.playerBall.isDrawing = false;
      this.pathCells = [];

      const enemyStart = cellToWorldCenter(
        this.grid,
        Math.floor(this.grid.cols / 2),
        Math.floor(this.grid.rows / 2)
      );
      this.state.enemyBall.x = enemyStart.x;
      this.state.enemyBall.y = enemyStart.y;

      this.staticGraphicsDirty = true;

      this.showLevelBanner(this.state.level);
    }
  }

  private updateSprites() {
    this.playerSprite.setPosition(this.state.playerBall.x, this.state.playerBall.y);
    this.enemySprite.setPosition(this.state.enemyBall.x, this.state.enemyBall.y);

    // Rotate enemy
    this.enemySprite.rotation += 0.1;

    // Rotate player based on direction
    if (this.currentDirection) {
      let angle = 0;
      switch (this.currentDirection) {
        case "up":
          angle = -Math.PI / 2;
          break;
        case "down":
          angle = Math.PI / 2;
          break;
        case "left":
          angle = Math.PI;
          break;
        case "right":
          angle = 0;
          break;
      }
      this.playerSprite.setRotation(angle);
    }
  }

  private updatePlayer(deltaSeconds: number) {
    if (!this.currentDirection) return;

    const speedPxPerSecond = 200;
    const stepSeconds = this.grid.cellSize / speedPxPerSecond;
    this.playerStepCarrySeconds += deltaSeconds;

    const countForwardBorderOptions = (from: Cell, at: Cell) => {
      let count = 0;
      const dirs = [
        { dc: 1, dr: 0 },
        { dc: -1, dr: 0 },
        { dc: 0, dr: 1 },
        { dc: 0, dr: -1 },
      ];
      for (const { dc, dr } of dirs) {
        const nc = at.c + dc;
        const nr = at.r + dr;
        if (nc < 0 || nr < 0 || nc >= this.grid.cols || nr >= this.grid.rows) continue;
        if (nc === from.c && nr === from.r) continue;
        const ni = idx(this.grid, nc, nr);
        if (this.filledMask[ni] === 1) continue;
        if (this.borderMask[ni] === 1) count++;
      }
      return count;
    };

    const directionDelta = (dir: Direction): { dc: number; dr: number } => {
      switch (dir) {
        case "up":
          return { dc: 0, dr: -1 };
        case "down":
          return { dc: 0, dr: 1 };
        case "left":
          return { dc: -1, dr: 0 };
        case "right":
          return { dc: 1, dr: 0 };
      }
    };

    let steps = 0;
    const maxSteps = 20;
    let movedAtLeastOnce = false;

    while (this.playerStepCarrySeconds >= stepSeconds && steps < maxSteps) {
      this.playerStepCarrySeconds -= stepSeconds;
      steps++;

      const beforeCell = worldToCell(this.grid, this.state.playerBall.x, this.state.playerBall.y);
      const beforeIdx = idx(this.grid, beforeCell.c, beforeCell.r);
      const wasOnBorderCell = this.borderMask[beforeIdx] === 1;

      const { dc, dr } = directionDelta(this.currentDirection);
      const nextCell = { c: beforeCell.c + dc, r: beforeCell.r + dr };

      // Block by grid bounds.
      if (
        nextCell.c < 0 ||
        nextCell.r < 0 ||
        nextCell.c >= this.grid.cols ||
        nextCell.r >= this.grid.rows
      ) {
        this.currentDirection = null;
        this.playerStepCarrySeconds = 0;
        break;
      }

      const nextI = idx(this.grid, nextCell.c, nextCell.r);

      // Can't enter filled cells.
      if (this.filledMask[nextI] === 1) {
        this.currentDirection = null;
        this.playerStepCarrySeconds = 0;
        break;
      }

      // If not drawing, you must start from (and return to) the border.
      if (!this.state.playerBall.isDrawing) {
        if (!wasOnBorderCell) {
          this.currentDirection = null;
          this.playerStepCarrySeconds = 0;
          break;
        }

        const nextIsBorder = this.borderMask[nextI] === 1;
        if (!nextIsBorder) {
          this.state.playerBall.isDrawing = true;
          this.pathCells = [beforeCell, nextCell];
          this.wallMask.fill(0);
          rasterizePolyline(this.grid, this.pathCells, this.wallMask);
        }
      } else {
        // Drawing: extend wall path when entering new cell
        const last = this.pathCells[this.pathCells.length - 1];
        if (!last || last.c !== nextCell.c || last.r !== nextCell.r) {
          this.pathCells.push(nextCell);
          rasterizePolyline(
            this.grid,
            [this.pathCells[this.pathCells.length - 2], nextCell],
            this.wallMask
          );
        }

        // Complete capture if we return to any border cell
        const nextIsBorder = this.borderMask[nextI] === 1;
        if (nextIsBorder && this.pathCells.length >= 2) {
          // Move onto the border closure cell, then complete the capture.
          // completeCapture() will re-snap the player to a valid post-capture border cell.
          const snappedToClosure = cellToWorldCenter(this.grid, nextCell.c, nextCell.r);
          this.state.playerBall.x = snappedToClosure.x;
          this.state.playerBall.y = snappedToClosure.y;
          movedAtLeastOnce = true;

          this.completeCapture();

          // Stop movement for this tick; otherwise we'd overwrite the snap done in completeCapture.
          this.currentDirection = null;
          this.playerStepCarrySeconds = 0;
          return;
        }
      }

      // Snap player to cell center for stable border/drawing behavior.
      const snapped = cellToWorldCenter(this.grid, nextCell.c, nextCell.r);
      this.state.playerBall.x = snapped.x;
      this.state.playerBall.y = snapped.y;
      movedAtLeastOnce = true;

      // If we're following the border, stop at decision points.
      if (!this.state.playerBall.isDrawing) {
        const afterIdx = idx(this.grid, nextCell.c, nextCell.r);
        if (this.borderMask[afterIdx] === 1) {
          // Exclude the cell we came from; if there isn't exactly one way forward, stop.
          const forward = countForwardBorderOptions(beforeCell, nextCell);
          if (forward !== 1 && movedAtLeastOnce) {
            this.currentDirection = null;
            this.playerStepCarrySeconds = 0;
            break;
          }
        }
      }
    }
  }

  private circleOverlapsMask(mask: Uint8Array, x: number, y: number, radius: number): boolean {
    const samples = [
      { dx: 0, dy: 0 },
      { dx: radius, dy: 0 },
      { dx: -radius, dy: 0 },
      { dx: 0, dy: radius },
      { dx: 0, dy: -radius },
      { dx: radius * 0.707, dy: radius * 0.707 },
      { dx: radius * 0.707, dy: -radius * 0.707 },
      { dx: -radius * 0.707, dy: radius * 0.707 },
      { dx: -radius * 0.707, dy: -radius * 0.707 },
    ];

    for (const s of samples) {
      const cell = worldToCell(this.grid, x + s.dx, y + s.dy);
      if (cell.c < 0 || cell.r < 0 || cell.c >= this.grid.cols || cell.r >= this.grid.rows)
        continue;
      if (mask[idx(this.grid, cell.c, cell.r)] === 1) return true;
    }
    return false;
  }

  private updateEnemy(deltaSeconds: number): boolean {
    const e = this.state.enemyBall;

    const minX = this.state.playBounds.x + e.radius;
    const maxX = this.state.playBounds.x + this.state.playBounds.width - e.radius;
    const minY = this.state.playBounds.y + e.radius;
    const maxY = this.state.playBounds.y + this.state.playBounds.height - e.radius;

    // Sub-step to avoid tunneling through thin (cell-sized) live walls.
    const stepX = e.velocityX * deltaSeconds;
    const stepY = e.velocityY * deltaSeconds;
    const maxStep = Math.max(Math.abs(stepX), Math.abs(stepY));
    const subSteps = Math.max(1, Math.min(30, Math.ceil(maxStep / (this.grid.cellSize * 0.75))));
    const dt = deltaSeconds / subSteps;

    for (let s = 0; s < subSteps; s++) {
      // Live wall hit is instant game over.
      if (this.circleOverlapsMask(this.wallMask, e.x, e.y, e.radius)) return true;

      // IMPORTANT: recompute per-substep deltas from the *current* velocity.
      // On low-FPS/mobile, bounces can occur mid-frame; using a fixed dx/dy can pin the ball to walls.
      const dx = e.velocityX * dt;
      const dy = e.velocityY * dt;

      // X axis collision against bounds + filled.
      let nextX = e.x + dx;
      let nextY = e.y;

      if (nextX <= minX || nextX >= maxX) {
        e.velocityX = -e.velocityX;
        nextX = Math.max(minX, Math.min(maxX, nextX));
      }

      if (this.circleOverlapsMask(this.filledMask, nextX, nextY, e.radius)) {
        e.velocityX = -e.velocityX;
      } else {
        e.x = nextX;
      }

      // Y axis collision against bounds + filled.
      nextX = e.x;
      nextY = e.y + dy;

      if (nextY <= minY || nextY >= maxY) {
        e.velocityY = -e.velocityY;
        nextY = Math.max(minY, Math.min(maxY, nextY));
      }

      if (this.circleOverlapsMask(this.filledMask, nextX, nextY, e.radius)) {
        e.velocityY = -e.velocityY;
      } else {
        e.y = nextY;
      }

      if (this.circleOverlapsMask(this.wallMask, e.x, e.y, e.radius)) return true;
    }

    return false;
  }

  private completeCapture() {
    const enemyCell = worldToCell(this.grid, this.state.enemyBall.x, this.state.enemyBall.y);
    const beforeFilledCount = this.countFilled();
    applyCapture(this.grid, this.filledMask, this.wallMask, enemyCell);
    const afterFilledCount = this.countFilled();

    const newly = afterFilledCount - beforeFilledCount;
    const total = this.grid.cols * this.grid.rows;
    const newlyPct = total === 0 ? 0 : (newly / total) * 100;

    this.state.score += pointsForCapture(newlyPct, DEFAULT_CONFIG);
    this.state.coverage = total === 0 ? 0 : (afterFilledCount / total) * 100;

    // Visual feedback for capture
    this.createCaptureEffect(newlyPct);

    // Recompute border from merged filled mask (auto-joins touching shapes)
    this.borderMask = computeBorderMask(this.grid, this.filledMask);

    // Ensure the player isn't sitting on a newly-filled wall cell.
    this.snapPlayerToNearestBorderCell();

    // Reset drawing
    this.state.playerBall.isDrawing = false;
    this.pathCells = [];

    // Reset movement accumulator so the player can move immediately after capture.
    this.playerStepCarrySeconds = 0;

    this.staticGraphicsDirty = true;

    if (this.state.coverage >= this.state.targetCoverage) {
      this.completeLevel();
    }
  }

  private createCaptureEffect(capturePercent: number) {
    // Flash effect
    const flash = this.add.graphics();
    flash.fillStyle(0x00ffff, 0.3);
    flash.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    flash.setDepth(40);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 300,
      onComplete: () => flash.destroy(),
    });

    // Floating score text
    if (capturePercent > 5) {
      const points = pointsForCapture(capturePercent, DEFAULT_CONFIG);
      const bonusText = this.add
        .text(this.state.playerBall.x, this.state.playerBall.y, `+${points}`, {
          fontFamily: "Impact, sans-serif",
          fontSize: "32px",
          color: "#FFD700",
          stroke: "#000000",
          strokeThickness: 4,
        })
        .setOrigin(0.5);

      this.tweens.add({
        targets: bonusText,
        y: bonusText.y - 60,
        alpha: { from: 1, to: 0 },
        duration: 1200,
        ease: "Quad.easeOut",
        onComplete: () => bonusText.destroy(),
      });
    }

    // Pixel burst from captured area
    for (let i = 0; i < 15; i++) {
      const px = this.state.playBounds.x + Math.random() * this.state.playBounds.width;
      const py = this.state.playBounds.y + Math.random() * this.state.playBounds.height;
      const pixel = this.add.sprite(px, py, ASSETS.PIXEL);

      this.tweens.add({
        targets: pixel,
        y: py - 100 - Math.random() * 50,
        x: px + (Math.random() - 0.5) * 100,
        alpha: { from: 1, to: 0 },
        scale: { from: 1, to: 0 },
        duration: 800 + Math.random() * 400,
        ease: "Quad.easeOut",
        onComplete: () => pixel.destroy(),
      });
    }
  }

  private countFilled(): number {
    let count = 0;
    for (let i = 0; i < this.filledMask.length; i++) {
      if (this.filledMask[i]) count++;
    }
    return count;
  }

  private snapPlayerToNearestBorderCell() {
    const start = worldToCell(this.grid, this.state.playerBall.x, this.state.playerBall.y);
    const target = this.findNearestBorderCell(start);
    if (!target) return;

    const snapped = cellToWorldCenter(this.grid, target.c, target.r);
    this.state.playerBall.x = snapped.x;
    this.state.playerBall.y = snapped.y;
  }

  private findNearestBorderCell(start: Cell): Cell | null {
    const visited = new Uint8Array(this.grid.cols * this.grid.rows);
    const qC = new Int16Array(this.grid.cols * this.grid.rows);
    const qR = new Int16Array(this.grid.cols * this.grid.rows);
    let qh = 0;
    let qt = 0;

    qC[qt] = start.c;
    qR[qt] = start.r;
    qt++;
    visited[idx(this.grid, start.c, start.r)] = 1;

    while (qh < qt) {
      const c = qC[qh];
      const r = qR[qh];
      qh++;

      const i = idx(this.grid, c, r);
      const isFilled = this.filledMask[i] === 1;
      if (!isFilled && this.borderMask[i] === 1) {
        return { c, r };
      }

      const dirs = [
        { dc: 1, dr: 0 },
        { dc: -1, dr: 0 },
        { dc: 0, dr: 1 },
        { dc: 0, dr: -1 },
      ];

      for (const { dc, dr } of dirs) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= this.grid.cols || nr >= this.grid.rows) continue;
        const ni = idx(this.grid, nc, nr);
        if (visited[ni]) continue;
        visited[ni] = 1;
        // We can traverse through filled cells for the search frontier, but only enqueue if it helps.
        qC[qt] = nc;
        qR[qt] = nr;
        qt++;
      }
    }

    return null;
  }

  private updateGraphics() {
    if (this.staticGraphicsDirty) {
      this.borderGraphics.clear();
      this.filledGraphics.clear();

      // Filled areas
      this.filledGraphics.fillStyle(0x001a33, 0.9);
      for (let r = 0; r < this.grid.rows; r++) {
        let runStart = -1;
        for (let c = 0; c < this.grid.cols; c++) {
          const i = idx(this.grid, c, r);
          const filled = this.filledMask[i] === 1;
          if (filled && runStart === -1) runStart = c;
          if ((!filled || c === this.grid.cols - 1) && runStart !== -1) {
            const runEnd = filled && c === this.grid.cols - 1 ? c : c - 1;
            const x = this.grid.originX + runStart * this.grid.cellSize;
            const y = this.grid.originY + r * this.grid.cellSize;
            const w = (runEnd - runStart + 1) * this.grid.cellSize;
            const h = this.grid.cellSize;
            this.filledGraphics.fillRect(x, y, w, h);
            runStart = -1;
          }
        }
      }

      // Add tech pattern overlay
      this.filledGraphics.lineStyle(1, 0x0066aa, 0.4);
      for (let r = 0; r < this.grid.rows; r++) {
        for (let c = 0; c < this.grid.cols; c++) {
          const i = idx(this.grid, c, r);
          if (this.filledMask[i] !== 1) continue;

          const x = this.grid.originX + c * this.grid.cellSize;
          const y = this.grid.originY + r * this.grid.cellSize;
          const s = this.grid.cellSize;

          // Diagonal lines
          if ((c + r) % 3 === 0) {
            this.filledGraphics.lineBetween(x, y, x + s, y + s);
          }
          if ((c - r) % 4 === 0) {
            this.filledGraphics.lineBetween(x + s, y, x, y + s);
          }
        }
      }

      // Borders helper
      const drawBorders = (g: Phaser.GameObjects.Graphics) => {
        g.strokeRect(
          this.state.playBounds.x,
          this.state.playBounds.y,
          this.state.playBounds.width,
          this.state.playBounds.height
        );

        const s = this.grid.cellSize;
        for (let r = 0; r < this.grid.rows; r++) {
          for (let c = 0; c < this.grid.cols; c++) {
            const i = idx(this.grid, c, r);
            if (this.filledMask[i] !== 1) continue;

            const x = this.grid.originX + c * s;
            const y = this.grid.originY + r * s;

            if (r === 0 || this.filledMask[idx(this.grid, c, r - 1)] === 0) {
              g.lineBetween(x, y, x + s, y);
            }
            if (r === this.grid.rows - 1 || this.filledMask[idx(this.grid, c, r + 1)] === 0) {
              g.lineBetween(x, y + s, x + s, y + s);
            }
            if (c === 0 || this.filledMask[idx(this.grid, c - 1, r)] === 0) {
              g.lineBetween(x, y, x, y + s);
            }
            if (c === this.grid.cols - 1 || this.filledMask[idx(this.grid, c + 1, r)] === 0) {
              g.lineBetween(x + s, y, x + s, y + s);
            }
          }
        }
      };

      // Draw glow
      this.borderGraphics.lineStyle(6, 0x00ffff, 0.3);
      drawBorders(this.borderGraphics);
      // Draw core
      this.borderGraphics.lineStyle(2, 0x00ffff, 1.0);
      drawBorders(this.borderGraphics);

      this.staticGraphicsDirty = false;
    }

    // Path
    this.pathGraphics.clear();
    if (this.pathCells.length > 1) {
      const drawPath = (g: Phaser.GameObjects.Graphics) => {
        const first = cellToWorldCenter(this.grid, this.pathCells[0].c, this.pathCells[0].r);
        // Round to nearest pixel for crisp rendering
        g.beginPath();
        g.moveTo(Math.round(first.x), Math.round(first.y));
        for (let i = 1; i < this.pathCells.length; i++) {
          const p = cellToWorldCenter(this.grid, this.pathCells[i].c, this.pathCells[i].r);
          g.lineTo(Math.round(p.x), Math.round(p.y));
        }
        g.strokePath();
      };

      this.pathGraphics.lineStyle(6, 0xff00ff, 0.4);
      drawPath(this.pathGraphics);
      this.pathGraphics.lineStyle(2, 0xff00ff, 1.0);
      drawPath(this.pathGraphics);
    }
  }

  private updateUI() {
    this.levelText.setText(`Level ${this.state.level}`);
    this.scoreText.setText(`Score: ${this.state.score}`);
    this.bestScoreText.setText(`Best: ${this.state.bestScore}`);
    this.coverageText.setText(`Coverage: ${this.state.coverage.toFixed(1)}%`);
    this.targetText.setText(`Target: ${this.state.targetCoverage}%`);
  }

  private loadBestScore(): number {
    const saved = localStorage.getItem("box-cutter-best-score");
    return saved ? parseInt(saved, 10) : 0;
  }

  private saveBestScore() {
    if (this.state.score > this.state.bestScore) {
      this.state.bestScore = this.state.score;
      localStorage.setItem("box-cutter-best-score", this.state.score.toString());
    }
  }

  private addBackgroundPixels() {
    // Add scattered animated pixels in the background
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * this.gameWidth;
      const y = Math.random() * this.gameHeight;
      const pixel = this.add.sprite(x, y, ASSETS.PIXEL);
      pixel.setAlpha(0.3 + Math.random() * 0.4);
      pixel.setScale(0.5 + Math.random() * 0.5);
      pixel.setDepth(-1);

      // Slow float animation
      this.tweens.add({
        targets: pixel,
        y: y + 20 * (Math.random() > 0.5 ? 1 : -1),
        alpha: { from: pixel.alpha, to: 0.1 },
        duration: 3000 + Math.random() * 2000,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
        delay: Math.random() * 2000,
      });
    }
  }
}
