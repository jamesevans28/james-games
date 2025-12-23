import Phaser from "phaser";
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
  private playerSprite!: Phaser.GameObjects.Arc;
  private enemySprite!: Phaser.GameObjects.Arc;
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

  constructor() {
    super({ key: "MainScene" });
  }

  create() {
    const bestScore = this.loadBestScore();

    this.state = createInitialState(
      {
        x: 50,
        y: UI_HEIGHT + 20,
        width: GAME_WIDTH - 100,
        height: PLAY_AREA_HEIGHT - 80,
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
    this.enemySprite = this.add.circle(
      this.state.enemyBall.x,
      this.state.enemyBall.y,
      this.state.enemyBall.radius,
      0xff0000
    );

    this.playerSprite = this.add.circle(
      this.state.playerBall.x,
      this.state.playerBall.y,
      this.state.playerBall.radius,
      0x00ffff
    );
  }

  private setupParticles() {
    this.particles = this.add.particles(0, 0, "particle", {
      speed: { min: 20, max: 50 },
      scale: { start: 0.3, end: 0 },
      lifespan: 300,
      blendMode: "ADD",
      tint: 0x00ffff,
      frequency: 30,
    });
    this.particles.startFollow(this.playerSprite);
  }

  private setupUI() {
    this.levelText = this.add.text(20, 10, "Level 1", {
      fontSize: "18px",
      color: "#ffffff",
      fontStyle: "bold",
    });

    this.scoreText = this.add.text(20, 20, "Score: 0", {
      fontSize: "24px",
      color: "#ffffff",
      fontStyle: "bold",
    });

    // Shift score down so the level label sits above it.
    this.scoreText.setPosition(20, 32);

    this.bestScoreText = this.add.text(20, 62, "Best: 0", {
      fontSize: "20px",
      color: "#aaaaaa",
    });

    this.coverageText = this.add
      .text(GAME_WIDTH - 20, 32, "Coverage: 0%", {
        fontSize: "20px",
        color: "#ffffff",
      })
      .setOrigin(1, 0);

    this.targetText = this.add
      .text(GAME_WIDTH - 20, 62, "Target: 75%", {
        fontSize: "20px",
        color: "#ffff00",
      })
      .setOrigin(1, 0);

    this.gameOverText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "GAME OVER\nTap to Continue", {
        fontSize: "48px",
        color: "#ff0000",
        align: "center",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setVisible(false);

    this.levelCompleteText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "LEVEL COMPLETE!\nTap to Continue", {
        fontSize: "36px",
        color: "#00ff00",
        align: "center",
        fontStyle: "bold",
      })
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
      centerX: GAME_WIDTH / 2,
      bottomPadding: 20,
      buttonSize: 60,
      spacing: 80,
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
    this.saveBestScore();
  }

  private endGame() {
    this.state.gameOver = true;
    this.gameOverText.setVisible(true);
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
    this.levelBannerText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `Level ${level}`, {
        fontSize: "56px",
        color: "#ffffff",
        align: "center",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(50)
      .setAlpha(1);

    this.tweens.add({
      targets: this.levelBannerText,
      alpha: 0,
      duration: 900,
      ease: "Quad.easeOut",
      onComplete: () => {
        this.levelBannerText?.destroy();
        this.levelBannerText = undefined;
      },
    });
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
      // Borders from the actual filled mask (merged shapes)
      this.borderGraphics.clear();
      this.borderGraphics.lineStyle(3, 0xffffff);

      // Outer border
      this.borderGraphics.strokeRect(
        this.state.playBounds.x,
        this.state.playBounds.y,
        this.state.playBounds.width,
        this.state.playBounds.height
      );

      // Inner borders: draw edges where a filled cell touches an empty cell.
      const s = this.grid.cellSize;
      for (let r = 0; r < this.grid.rows; r++) {
        for (let c = 0; c < this.grid.cols; c++) {
          const i = idx(this.grid, c, r);
          if (this.filledMask[i] !== 1) continue;

          const x = this.grid.originX + c * s;
          const y = this.grid.originY + r * s;

          // top edge
          if (r === 0 || this.filledMask[idx(this.grid, c, r - 1)] === 0) {
            this.borderGraphics.lineBetween(x, y, x + s, y);
          }
          // bottom edge
          if (r === this.grid.rows - 1 || this.filledMask[idx(this.grid, c, r + 1)] === 0) {
            this.borderGraphics.lineBetween(x, y + s, x + s, y + s);
          }
          // left edge
          if (c === 0 || this.filledMask[idx(this.grid, c - 1, r)] === 0) {
            this.borderGraphics.lineBetween(x, y, x, y + s);
          }
          // right edge
          if (c === this.grid.cols - 1 || this.filledMask[idx(this.grid, c + 1, r)] === 0) {
            this.borderGraphics.lineBetween(x + s, y, x + s, y + s);
          }
        }
      }

      // Filled areas exactly as captured (grid mask)
      this.filledGraphics.clear();
      this.filledGraphics.fillStyle(0x0099ff, 0.45);

      // Run-length draw for performance
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

      this.staticGraphicsDirty = false;
    }

    // Draw current wall path (live line)
    this.pathGraphics.clear();
    if (this.pathCells.length > 1) {
      this.pathGraphics.lineStyle(3, 0x00ffff);

      const first = cellToWorldCenter(this.grid, this.pathCells[0].c, this.pathCells[0].r);
      this.pathGraphics.beginPath();
      this.pathGraphics.moveTo(first.x, first.y);
      for (let i = 1; i < this.pathCells.length; i++) {
        const p = cellToWorldCenter(this.grid, this.pathCells[i].c, this.pathCells[i].r);
        this.pathGraphics.lineTo(p.x, p.y);
      }
      this.pathGraphics.strokePath();
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
}
