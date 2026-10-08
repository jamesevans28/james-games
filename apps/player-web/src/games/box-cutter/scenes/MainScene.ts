import Phaser from "phaser";
import { BasePlatformScene } from "../../../platform/scenes/BasePlatformScene";
import { dpad, keys, swipe, type DPadDirection } from "../../../platform/input";
import { hexToNumber } from "../../../platform/hud/format";
import { ASSETS, preloadAssets, createBackground } from "../assets";
import {
  DEFAULT_CONFIG,
  type Bounds,
  type Direction,
  type EnemyBall,
  type PlayerBall,
} from "../entities/GameState";
import {
  cellToWorldCenter,
  countSet,
  createGrid,
  directionDelta,
  idx,
  inBounds,
  worldToCell,
  type Cell,
  type Grid,
} from "../useCases/grid";
import { rasterizePolyline } from "../useCases/rasterize";
import { applyCapture } from "../useCases/captureFill";
import {
  computeBorderMask,
  countForwardBorderOptions,
  findNearestBorderCell,
} from "../useCases/borderMask";
import { pointsForCapture } from "../useCases/score";
import {
  collectPickup,
  coveragePct,
  enemySpeedFactor,
  isLevelComplete,
  levelSettings,
  loseLife,
  MAX_LIVES,
  newPowerupClock,
  pickPickupCell,
  skipPickup,
  startVelocity,
  tickPowerups,
  type PowerupClock,
} from "../useCases/rules";

const W = 540;
const H = 960;
/** The board, laid out for 540×960: below the HUD and status line, above the d-pad. */
const PLAY_BOUNDS: Bounds = { x: 36, y: 198, width: 468, height: 504 };
/** Smaller cells mean more precise captures and more work per frame. */
const CELL_SIZE = 3;
const PLAYER_SPEED = 200; // px/s
const ENEMY_RADIUS = 10;
const PICKUP_RADIUS = 14;
const STATUS_Y = 172;
const BOARD_CENTER = {
  x: PLAY_BOUNDS.x + PLAY_BOUNDS.width / 2,
  y: PLAY_BOUNDS.y + PLAY_BOUNDS.height / 2,
};

type NextButton = { container: Phaser.GameObjects.Container; zone: Phaser.GameObjects.Zone };

export default class MainScene extends BasePlatformScene {
  // Per-run state: every field is reset in startRun().
  private rng: () => number = Math.random;
  private score = 0;
  private lives = MAX_LIVES;
  private level = 1;
  private coverage = 0;
  private targetCoverage = 0;
  private levelComplete = false;
  private player: PlayerBall = { x: 0, y: 0, isDrawing: false };
  private enemy: EnemyBall = { x: 0, y: 0, velocityX: 0, velocityY: 0, radius: ENEMY_RADIUS };
  private currentDirection: Direction | null = null;
  private playerStepCarrySeconds = 0;
  private powerups: PowerupClock = { spawnInMs: 0, pickupLeftMs: 0, slowLeftMs: 0 };
  private pickupCell: Cell | null = null;

  private grid!: Grid;
  private filledMask!: Uint8Array; // 1 = out of play
  private wallMask!: Uint8Array; // 1 = the line being drawn
  private borderMask!: Uint8Array; // 1 = open cell on the outer edge or next to a filled one
  private pathCells: Cell[] = [];
  private staticGraphicsDirty = true;

  // Game objects: recreated in startRun() because a restart rebuilds the display list.
  private playerSprite!: Phaser.GameObjects.Sprite;
  private enemySprite!: Phaser.GameObjects.Sprite;
  private borderGraphics!: Phaser.GameObjects.Graphics;
  private pathGraphics!: Phaser.GameObjects.Graphics;
  private filledGraphics!: Phaser.GameObjects.Graphics;
  private particles!: Phaser.GameObjects.Particles.ParticleEmitter;
  private statusText!: Phaser.GameObjects.Text;
  private pickup: Phaser.GameObjects.Container | null = null;
  private nextButton: NextButton | null = null;
  private levelBannerText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super("MainScene");
  }

  preload() {
    preloadAssets(this);
  }

  protected startRun() {
    // The scene object survives restarts: reset per-run fields first.
    this.rng = this.host.rng();
    this.score = 0;
    this.lives = MAX_LIVES;
    this.level = 1;
    this.levelComplete = false;
    this.currentDirection = null;
    this.playerStepCarrySeconds = 0;
    this.pickup = null;
    this.pickupCell = null;
    this.nextButton = null;
    this.levelBannerText = null;

    createBackground(this, W, H);
    this.addBackgroundPixels();
    this.borderGraphics = this.add.graphics();
    this.filledGraphics = this.add.graphics();
    this.pathGraphics = this.add.graphics();
    this.setupSprites();
    this.setupParticles();

    this.statusText = this.add
      .text(W / 2, STATUS_Y, "", {
        fontFamily: this.host.fonts.display,
        fontSize: "24px",
        fontStyle: "800",
        color: this.host.colors.paper,
        stroke: this.host.colors.ink,
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    this.hud.setScore(0);
    this.hud.setBest(this.host.best.get());
    this.hud.setHearts(this.lives, MAX_LIVES);

    this.setupInput();
    this.startLevel(1);
  }

  /** A fresh board for `level`. Score and lives carry over. */
  private startLevel(level: number) {
    const { enemySpeed, targetCoverage } = levelSettings(level, DEFAULT_CONFIG);
    this.level = level;
    this.targetCoverage = targetCoverage;
    this.coverage = 0;
    this.levelComplete = false;
    this.currentDirection = null;
    this.playerStepCarrySeconds = 0;

    this.grid = createGrid(PLAY_BOUNDS, CELL_SIZE);
    this.filledMask = new Uint8Array(this.grid.cols * this.grid.rows);
    this.wallMask = new Uint8Array(this.grid.cols * this.grid.rows);
    this.borderMask = computeBorderMask(this.grid, this.filledMask);
    this.pathCells = [];

    // Snap player and enemy to cell centres to keep borders reliable.
    const playerStart = cellToWorldCenter(this.grid, 0, 0);
    this.player = { x: playerStart.x, y: playerStart.y, isDrawing: false };
    const enemyStart = cellToWorldCenter(
      this.grid,
      Math.floor(this.grid.cols / 2),
      Math.floor(this.grid.rows / 2),
    );
    const v = startVelocity(enemySpeed, this.rng);
    this.enemy = {
      x: enemyStart.x,
      y: enemyStart.y,
      velocityX: v.vx,
      velocityY: v.vy,
      radius: ENEMY_RADIUS,
    };

    this.powerups = newPowerupClock(this.rng);
    this.removePickup(false);
    this.enemySprite.clearTint();
    this.particles.start();

    this.staticGraphicsDirty = true;
    this.updateSprites(0);
    this.updateGraphics();
    this.updateStatus();
    this.showLevelBanner(level);
  }

  private setupSprites() {
    this.enemySprite = this.add.sprite(this.enemy.x, this.enemy.y, ASSETS.ENEMY).setScale(0.8);
    this.tweens.add({
      targets: this.enemySprite,
      scaleX: 0.9,
      scaleY: 0.9,
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.playerSprite = this.add.sprite(this.player.x, this.player.y, ASSETS.PLAYER).setScale(0.7);
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

  private setupInput() {
    const canSteer = () => !this.runEnded && !this.levelComplete;
    // The d-pad also maps the arrow keys, so swipe leaves the keyboard alone.
    dpad(this, {
      centerX: W / 2,
      bottomPadding: 20,
      buttonSize: 60,
      spacing: 80,
      alpha: 0.85,
      onDirectionChange: (dir) => this.steer(dir),
      enabled: canSteer,
      keyboard: true,
      mode: "sticky",
    });
    swipe(this, { onSwipe: (dir) => this.steer(dir), keyboard: false });
    keys(this, { Enter: () => this.nextLevel(), " ": () => this.nextLevel() });
  }

  private steer(direction: DPadDirection | null) {
    if (this.runEnded || this.levelComplete) {
      this.currentDirection = null;
      return;
    }
    // Sticky d-pad: a direction keeps the player moving until a wall or junction.
    this.currentDirection = direction;
    // Nudge straight away so short taps still move at least one cell.
    this.updatePlayer(1 / 60);
  }

  update(_time: number, delta: number) {
    if (this.runEnded || this.levelComplete) return;

    // Clamp delta to keep physics stable on mobile (prevents tunnelling after a hitch).
    const deltaSeconds = Math.min(delta / 1000, 1 / 30);

    const tick = tickPowerups(this.powerups, deltaSeconds * 1000, this.rng);
    this.powerups = tick.clock;
    if (tick.expired) this.removePickup(true);
    if (tick.spawn) this.spawnPickup();
    if (tick.slowEnded) this.enemySprite.clearTint();

    this.updatePlayer(deltaSeconds);
    // A capture can finish the level mid-frame; completeLevel() has drawn it already.
    if (this.levelComplete) return;
    this.checkPickup();

    const factor = enemySpeedFactor(this.powerups);
    if (this.updateEnemy(deltaSeconds * factor)) this.onLineHit();

    this.updateSprites(deltaSeconds * factor);
    this.updateGraphics();
  }

  // --- Lives, levels, game over --------------------------------------------

  /** The fireball touched the line being drawn: lose a life and the line. */
  private onLineHit() {
    this.lives = loseLife(this.lives);
    this.hud.setHearts(this.lives, MAX_LIVES);
    this.cameras.main.shake(250, 0.01);
    this.flash(hexToNumber(this.host.colors.tomato));
    this.currentDirection = null;
    this.playerStepCarrySeconds = 0;

    if (this.lives <= 0) {
      // Leave the broken line on screen; endRun plays the end sting and fail haptic.
      this.particles.stop();
      this.endRun(this.score, { level: this.level });
      return;
    }

    this.host.audio.play("miss");
    this.host.haptics.tap();

    // Back to where the line started (still a border cell: nothing was filled meanwhile).
    const start = this.pathCells[0];
    this.wallMask.fill(0);
    this.pathCells = [];
    this.player.isDrawing = false;
    if (start) {
      const p = cellToWorldCenter(this.grid, start.c, start.r);
      this.player.x = p.x;
      this.player.y = p.y;
    }
    this.hud.popup("Ouch!", this.player.x, this.player.y - 24, this.host.colors.tomato);
  }

  private completeLevel() {
    this.levelComplete = true;
    this.currentDirection = null;
    this.particles.stop();
    this.removePickup(false);
    this.enemySprite.clearTint();
    this.updateSprites(0);
    this.updateGraphics();
    this.updateStatus();

    this.createCelebrationEffect();
    this.host.audio.ding();
    this.host.haptics.success();
    this.showNextButton();
  }

  private nextLevel() {
    if (!this.levelComplete || this.runEnded) return;
    if (this.nextButton) {
      this.nextButton.container.destroy();
      this.nextButton.zone.destroy();
      this.nextButton = null;
    }
    this.host.audio.play("tap");
    this.startLevel(this.level + 1);
  }

  /** A sticker-style "Next level" button over the board. */
  private showNextButton() {
    const ink = hexToNumber(this.host.colors.ink);
    const sun = hexToNumber(this.host.colors.sun);
    const w = 280;
    const h = 80;
    const { x, y } = BOARD_CENTER;

    const heading = this.add
      .text(0, -100, `Level ${this.level} cleared!`, {
        fontFamily: this.host.fonts.display,
        fontSize: "40px",
        fontStyle: "800",
        color: this.host.colors.grass,
        stroke: this.host.colors.ink,
        strokeThickness: 8,
      })
      .setOrigin(0.5);

    const face = this.add.graphics();
    face.fillStyle(ink, 1).fillRoundedRect(-w / 2, -h / 2 + 6, w, h, 22);
    face.fillStyle(sun, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 22);
    face.lineStyle(4, ink, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 22);

    const label = this.add
      .text(0, 0, "Next level ▶", {
        fontFamily: this.host.fonts.display,
        fontSize: "34px",
        fontStyle: "800",
        color: this.host.colors.ink,
      })
      .setOrigin(0.5);

    const container = this.add.container(x, y, [heading, face, label]).setDepth(60).setScale(0.6);
    const zone = this.add
      .zone(x, y, w, h)
      .setDepth(61)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.nextLevel());

    this.tweens.add({ targets: container, scale: 1, duration: 300, ease: "Back.Out" });
    this.tweens.add({
      targets: [face, label],
      scale: 1.05,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      delay: 300,
    });
    this.nextButton = { container, zone };
  }

  private updateStatus() {
    const slowS = Math.ceil(this.powerups.slowLeftMs / 1000);
    const slow = slowS > 0 && !this.levelComplete ? `  ·  Slow ${slowS}s` : "";
    const text = `Level ${this.level}  ·  ${Math.floor(this.coverage)}% of ${this.targetCoverage}%${slow}`;
    if (this.statusText.text !== text) this.statusText.setText(text);
  }

  // --- Power-up --------------------------------------------------------------

  private spawnPickup() {
    const cell = pickPickupCell(this.grid, this.filledMask, this.rng);
    if (!cell) {
      this.powerups = skipPickup(this.powerups, this.rng);
      return;
    }
    this.pickupCell = cell;
    const { x, y } = cellToWorldCenter(this.grid, cell.c, cell.r);

    const ink = hexToNumber(this.host.colors.ink);
    const g = this.add.graphics();
    // A little clock: grab it and the fireball slows down.
    g.fillStyle(hexToNumber(this.host.colors.sky), 1).fillCircle(0, 0, PICKUP_RADIUS);
    g.lineStyle(3, ink, 1).strokeCircle(0, 0, PICKUP_RADIUS);
    g.fillStyle(hexToNumber(this.host.colors.paper), 1).fillCircle(0, 0, PICKUP_RADIUS - 5);
    g.lineStyle(2, ink, 1);
    g.lineBetween(0, 0, 0, -6);
    g.lineBetween(0, 0, 5, 0);

    this.pickup = this.add.container(x, y, [g]).setDepth(20).setScale(0);
    this.tweens.add({ targets: this.pickup, scale: 1, duration: 250, ease: "Back.Out" });
    this.tweens.add({
      targets: g,
      angle: { from: -12, to: 12 },
      duration: 300,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    this.host.audio.pop();
  }

  private removePickup(fade: boolean) {
    const obj = this.pickup;
    this.pickup = null;
    this.pickupCell = null;
    if (!obj) return;
    if (!fade) {
      obj.destroy();
      return;
    }
    this.tweens.add({
      targets: obj,
      alpha: 0,
      scale: 0.4,
      duration: 250,
      onComplete: () => obj.destroy(),
    });
  }

  /** The player touched the pickup, or boxed it in with a capture. */
  private checkPickup() {
    const cell = this.pickupCell;
    if (!cell) return;
    const { x, y } = cellToWorldCenter(this.grid, cell.c, cell.r);
    const touched = Math.hypot(this.player.x - x, this.player.y - y) <= PICKUP_RADIUS + 6;
    const boxedIn = this.filledMask[idx(this.grid, cell.c, cell.r)] === 1;
    if (!touched && !boxedIn) return;

    this.powerups = collectPickup(this.rng);
    this.removePickup(false);
    this.enemySprite.setTint(hexToNumber(this.host.colors.sky));
    this.hud.popup("Slow-mo!", x, y - 20, this.host.colors.sky);
    this.host.audio.ding();
    this.host.haptics.success();
  }

  // --- Movement --------------------------------------------------------------

  private updateSprites(deltaSeconds: number) {
    this.playerSprite.setPosition(this.player.x, this.player.y);
    this.enemySprite.setPosition(this.enemy.x, this.enemy.y);
    this.enemySprite.rotation += 6 * deltaSeconds; // about a turn a second

    if (this.currentDirection) {
      const angles: Record<Direction, number> = {
        up: -Math.PI / 2,
        down: Math.PI / 2,
        left: Math.PI,
        right: 0,
      };
      this.playerSprite.setRotation(angles[this.currentDirection]);
    }
    this.updateStatus();
  }

  private stopPlayer() {
    this.currentDirection = null;
    this.playerStepCarrySeconds = 0;
  }

  private updatePlayer(deltaSeconds: number) {
    if (!this.currentDirection) return;

    const stepSeconds = this.grid.cellSize / PLAYER_SPEED;
    this.playerStepCarrySeconds += deltaSeconds;

    let steps = 0;
    const maxSteps = 20;

    while (this.playerStepCarrySeconds >= stepSeconds && steps < maxSteps) {
      this.playerStepCarrySeconds -= stepSeconds;
      steps++;

      const beforeCell = worldToCell(this.grid, this.player.x, this.player.y);
      const wasOnBorderCell = this.borderMask[idx(this.grid, beforeCell.c, beforeCell.r)] === 1;

      const { dc, dr } = directionDelta(this.currentDirection);
      const nextCell = { c: beforeCell.c + dc, r: beforeCell.r + dr };

      // Blocked by the edge of the board or by filled cells.
      if (!inBounds(this.grid, nextCell.c, nextCell.r)) return this.stopPlayer();
      const nextI = idx(this.grid, nextCell.c, nextCell.r);
      if (this.filledMask[nextI] === 1) return this.stopPlayer();
      const nextIsBorder = this.borderMask[nextI] === 1;

      if (!this.player.isDrawing) {
        // A line must start from the border.
        if (!wasOnBorderCell) return this.stopPlayer();
        if (!nextIsBorder) {
          this.player.isDrawing = true;
          this.pathCells = [beforeCell, nextCell];
          this.wallMask.fill(0);
          rasterizePolyline(this.grid, this.pathCells, this.wallMask);
        }
      } else {
        // Drawing: extend the line into the new cell.
        const last = this.pathCells[this.pathCells.length - 1];
        if (!last || last.c !== nextCell.c || last.r !== nextCell.r) {
          this.pathCells.push(nextCell);
          rasterizePolyline(
            this.grid,
            [this.pathCells[this.pathCells.length - 2], nextCell],
            this.wallMask,
          );
        }

        // Back on any border cell closes the shape.
        if (nextIsBorder && this.pathCells.length >= 2) {
          const closure = cellToWorldCenter(this.grid, nextCell.c, nextCell.r);
          this.player.x = closure.x;
          this.player.y = closure.y;
          // completeCapture() re-snaps the player; stop so nothing overwrites that.
          this.stopPlayer();
          this.completeCapture();
          return;
        }
      }

      // Snap to the cell centre for stable border/drawing behaviour.
      const snapped = cellToWorldCenter(this.grid, nextCell.c, nextCell.r);
      this.player.x = snapped.x;
      this.player.y = snapped.y;

      // Following the border: stop at junctions and dead ends.
      if (!this.player.isDrawing && nextIsBorder) {
        const forward = countForwardBorderOptions(
          this.grid,
          this.filledMask,
          this.borderMask,
          beforeCell,
          nextCell,
        );
        if (forward !== 1) return this.stopPlayer();
      }
    }
  }

  private circleOverlapsMask(mask: Uint8Array, x: number, y: number, radius: number): boolean {
    const d = radius * 0.707;
    const samples = [
      [0, 0],
      [radius, 0],
      [-radius, 0],
      [0, radius],
      [0, -radius],
      [d, d],
      [d, -d],
      [-d, d],
      [-d, -d],
    ] as const;

    for (const [dx, dy] of samples) {
      const cell = worldToCell(this.grid, x + dx, y + dy);
      if (mask[idx(this.grid, cell.c, cell.r)] === 1) return true;
    }
    return false;
  }

  /** Moves the fireball; true if it touched the line being drawn. */
  private updateEnemy(deltaSeconds: number): boolean {
    const e = this.enemy;
    const b = PLAY_BOUNDS;
    const minX = b.x + e.radius;
    const maxX = b.x + b.width - e.radius;
    const minY = b.y + e.radius;
    const maxY = b.y + b.height - e.radius;

    // Sub-step to avoid tunnelling through thin (cell-sized) live walls.
    const maxStep = Math.max(Math.abs(e.velocityX), Math.abs(e.velocityY)) * deltaSeconds;
    const subSteps = Math.max(1, Math.min(30, Math.ceil(maxStep / (this.grid.cellSize * 0.75))));
    const dt = deltaSeconds / subSteps;

    for (let s = 0; s < subSteps; s++) {
      if (this.circleOverlapsMask(this.wallMask, e.x, e.y, e.radius)) return true;

      // Recompute per-substep deltas from the current velocity: bounces can happen mid-frame.
      let nextX = e.x + e.velocityX * dt;
      if (nextX <= minX || nextX >= maxX) {
        e.velocityX = -e.velocityX;
        nextX = Math.max(minX, Math.min(maxX, nextX));
      }
      if (this.circleOverlapsMask(this.filledMask, nextX, e.y, e.radius)) {
        e.velocityX = -e.velocityX;
      } else {
        e.x = nextX;
      }

      let nextY = e.y + e.velocityY * dt;
      if (nextY <= minY || nextY >= maxY) {
        e.velocityY = -e.velocityY;
        nextY = Math.max(minY, Math.min(maxY, nextY));
      }
      if (this.circleOverlapsMask(this.filledMask, e.x, nextY, e.radius)) {
        e.velocityY = -e.velocityY;
      } else {
        e.y = nextY;
      }

      if (this.circleOverlapsMask(this.wallMask, e.x, e.y, e.radius)) return true;
    }

    return false;
  }

  // --- Capture ---------------------------------------------------------------

  private completeCapture() {
    const enemyCell = worldToCell(this.grid, this.enemy.x, this.enemy.y);
    const before = countSet(this.filledMask);
    applyCapture(this.grid, this.filledMask, this.wallMask, enemyCell);
    const after = countSet(this.filledMask);

    const total = this.grid.cols * this.grid.rows;
    const newlyPct = coveragePct(after - before, total);
    const points = pointsForCapture(newlyPct, DEFAULT_CONFIG);
    this.score += points;
    this.coverage = coveragePct(after, total);
    this.hud.setScore(this.score);
    this.host.audio.play("score");
    this.createCaptureEffect(points);

    // Recompute the border from the merged filled mask (touching shapes join up).
    this.borderMask = computeBorderMask(this.grid, this.filledMask);

    // Make sure the player isn't sitting on a newly filled cell.
    const here = worldToCell(this.grid, this.player.x, this.player.y);
    const target = findNearestBorderCell(this.grid, this.filledMask, this.borderMask, here);
    if (target) {
      const p = cellToWorldCenter(this.grid, target.c, target.r);
      this.player.x = p.x;
      this.player.y = p.y;
    }

    this.player.isDrawing = false;
    this.pathCells = [];
    this.playerStepCarrySeconds = 0;
    this.staticGraphicsDirty = true;

    if (isLevelComplete(this.coverage, this.targetCoverage)) this.completeLevel();
  }

  // --- Effects ---------------------------------------------------------------

  private flash(color: number) {
    const flash = this.add.graphics().setDepth(40);
    flash.fillStyle(color, 0.3).fillRect(0, 0, W, H);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 300,
      onComplete: () => flash.destroy(),
    });
  }

  private createCaptureEffect(points: number) {
    this.flash(0x00ffff);
    if (points > 0) this.hud.popup(`+${points}`, this.player.x, this.player.y - 20);

    // Pixel burst over the board (cosmetic).
    for (let i = 0; i < 15; i++) {
      const px = PLAY_BOUNDS.x + Phaser.Math.FloatBetween(0, PLAY_BOUNDS.width);
      const py = PLAY_BOUNDS.y + Phaser.Math.FloatBetween(0, PLAY_BOUNDS.height);
      const pixel = this.add.sprite(px, py, ASSETS.PIXEL);
      this.tweens.add({
        targets: pixel,
        y: py - Phaser.Math.FloatBetween(100, 150),
        x: px + Phaser.Math.FloatBetween(-50, 50),
        alpha: { from: 1, to: 0 },
        scale: { from: 1, to: 0 },
        duration: Phaser.Math.Between(800, 1200),
        ease: "Quad.easeOut",
        onComplete: () => pixel.destroy(),
      });
    }
  }

  private createCelebrationEffect() {
    const { x, y } = BOARD_CENTER;
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const spark = this.add.sprite(x, y, ASSETS.SPARK).setDepth(55);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * 200,
        y: y + Math.sin(angle) * 200,
        alpha: { from: 1, to: 0 },
        scale: { from: 1, to: 0 },
        duration: 1000,
        ease: "Quad.easeOut",
        onComplete: () => spark.destroy(),
      });
    }
  }

  private showLevelBanner(level: number) {
    this.levelBannerText?.destroy();
    const banner = this.add
      .text(BOARD_CENTER.x, BOARD_CENTER.y, `LEVEL ${level}`, {
        fontFamily: this.host.fonts.display,
        fontSize: "72px",
        fontStyle: "800",
        color: this.host.colors.sun,
        stroke: this.host.colors.ink,
        strokeThickness: 10,
      })
      .setOrigin(0.5)
      .setDepth(50)
      .setScale(0);
    this.levelBannerText = banner;

    // Scale up, then fade out.
    this.tweens.add({
      targets: banner,
      scale: { from: 0, to: 1.5 },
      alpha: { from: 1, to: 0 },
      duration: 1200,
      ease: "Back.easeOut",
      onComplete: () => {
        banner.destroy();
        if (this.levelBannerText === banner) this.levelBannerText = null;
      },
    });
  }

  private addBackgroundPixels() {
    // Scattered, slowly floating pixels behind everything (cosmetic).
    for (let i = 0; i < 30; i++) {
      const x = Phaser.Math.FloatBetween(0, W);
      const y = Phaser.Math.FloatBetween(0, H);
      const pixel = this.add
        .sprite(x, y, ASSETS.PIXEL)
        .setAlpha(Phaser.Math.FloatBetween(0.3, 0.7))
        .setScale(Phaser.Math.FloatBetween(0.5, 1))
        .setDepth(-1);

      this.tweens.add({
        targets: pixel,
        y: y + (Phaser.Math.Between(0, 1) === 1 ? 20 : -20),
        alpha: { from: pixel.alpha, to: 0.1 },
        duration: Phaser.Math.Between(3000, 5000),
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
        delay: Phaser.Math.Between(0, 2000),
      });
    }
  }

  // --- Drawing ---------------------------------------------------------------

  private updateGraphics() {
    if (this.staticGraphicsDirty) {
      this.drawStatic();
      this.staticGraphicsDirty = false;
    }

    this.pathGraphics.clear();
    if (this.pathCells.length > 1) {
      const drawPath = (g: Phaser.GameObjects.Graphics) => {
        const first = cellToWorldCenter(this.grid, this.pathCells[0].c, this.pathCells[0].r);
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

  private drawStatic() {
    const { grid, filledMask: filled } = this;
    const s = grid.cellSize;
    this.borderGraphics.clear();
    this.filledGraphics.clear();

    // Filled areas, one rect per horizontal run.
    this.filledGraphics.fillStyle(0x001a33, 0.9);
    for (let r = 0; r < grid.rows; r++) {
      let runStart = -1;
      for (let c = 0; c < grid.cols; c++) {
        const isFilled = filled[idx(grid, c, r)] === 1;
        if (isFilled && runStart === -1) runStart = c;
        if ((!isFilled || c === grid.cols - 1) && runStart !== -1) {
          const runEnd = isFilled && c === grid.cols - 1 ? c : c - 1;
          this.filledGraphics.fillRect(
            grid.originX + runStart * s,
            grid.originY + r * s,
            (runEnd - runStart + 1) * s,
            s,
          );
          runStart = -1;
        }
      }
    }

    // Tech pattern overlay.
    this.filledGraphics.lineStyle(1, 0x0066aa, 0.4);
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        if (filled[idx(grid, c, r)] !== 1) continue;
        const x = grid.originX + c * s;
        const y = grid.originY + r * s;
        if ((c + r) % 3 === 0) this.filledGraphics.lineBetween(x, y, x + s, y + s);
        if ((c - r) % 4 === 0) this.filledGraphics.lineBetween(x + s, y, x, y + s);
      }
    }

    const drawBorders = (g: Phaser.GameObjects.Graphics) => {
      g.strokeRect(PLAY_BOUNDS.x, PLAY_BOUNDS.y, PLAY_BOUNDS.width, PLAY_BOUNDS.height);
      for (let r = 0; r < grid.rows; r++) {
        for (let c = 0; c < grid.cols; c++) {
          if (filled[idx(grid, c, r)] !== 1) continue;
          const x = grid.originX + c * s;
          const y = grid.originY + r * s;
          if (r === 0 || filled[idx(grid, c, r - 1)] === 0) g.lineBetween(x, y, x + s, y);
          if (r === grid.rows - 1 || filled[idx(grid, c, r + 1)] === 0)
            g.lineBetween(x, y + s, x + s, y + s);
          if (c === 0 || filled[idx(grid, c - 1, r)] === 0) g.lineBetween(x, y, x, y + s);
          if (c === grid.cols - 1 || filled[idx(grid, c + 1, r)] === 0)
            g.lineBetween(x + s, y, x + s, y + s);
        }
      }
    };

    // Glow, then core.
    this.borderGraphics.lineStyle(6, 0x00ffff, 0.3);
    drawBorders(this.borderGraphics);
    this.borderGraphics.lineStyle(2, 0x00ffff, 1.0);
    drawBorders(this.borderGraphics);
  }
}
