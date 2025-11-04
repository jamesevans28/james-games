import Phaser from "phaser";
import { getUserName } from "../../utils/user";
import { postHighScore } from "../../lib/api";
import { dispatchGameOver } from "../../utils/gameEvents";

const GAME_ID = "fill-the-cup" as const;

// Visual + gameplay constants
const TAP_Y_FRACTION = 0.25; // tap positioned ~25% from top (moved higher)
const BASE_CUP_SPEED = 50; // px/s horizontal movement at start
const BASE_POUR_RATE = 0.75; // fill per second while under tap at start
const SPEED_INCREASE_PER_SCORE = 2.5; // increase speed by this much per point scored
const UNDER_TAP_BAND = 80; // width (px) horizontally considered under tap
const BASE_TARGET_BAND = 0.28; // starting target band height (fraction of cup)
const MIN_TARGET_BAND = 0.07; // minimum band width at high difficulty
const PERFECT_TOLERANCE = 0.02; // within +/-2% of exact center counts as perfect
const MISSES_ALLOWED = 3;

// Compute nice cup dimensions from viewport
function computeCupMetrics(width: number, height: number) {
  const cupW = Math.max(80, Math.floor(width * 0.22));
  const cupH = Math.max(180, Math.floor(height * 0.28));
  const cupY = Math.floor(height * 0.78); // baseline for bottoms (more space from tap)
  return { cupW, cupH, cupY };
}

interface Cup {
  container: Phaser.GameObjects.Container;
  outlineG: Phaser.GameObjects.Graphics;
  fillRect: Phaser.GameObjects.Rectangle;
  maskGeom: Phaser.GameObjects.Graphics;
  targetBand: Phaser.GameObjects.Rectangle;
  x: number;
  y: number;
  w: number;
  h: number;
  fill: number; // 0..1
  targetCenter: number; // 0..1 from bottom
  targetWidth: number; // fraction height
  evaluated: boolean; // scored already when leaving tap
}

export default class FillTheCupGame extends Phaser.Scene {
  private centerX!: number;
  private tapX!: number;
  private tapY!: number;

  private waterG!: Phaser.GameObjects.Graphics;
  private waterPulse = 0; // animate water
  private splashParticles!: Phaser.GameObjects.Particles.ParticleEmitter;

  private cups: Cup[] = [];
  private misses = 0;
  private score = 0;
  private best = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;

  private pouring = false; // input state

  constructor() {
    super("FillTheCupGame");
  }

  preload(): void {
    // No external assets required; everything is drawn.
  }

  create(): void {
    const { width, height } = this.scale;
    this.centerX = Math.floor(width / 2);

    this.tapX = this.centerX;
    this.tapY = Math.floor(height * TAP_Y_FRACTION);

    // Score + lives UI
    this.best = Number(localStorage.getItem(`${GAME_ID}-best`) || 0);
    this.scoreText = this.add
      .text(this.centerX, 16, this.makeScoreText(), {
        fontFamily: "Fredoka, Arial Black, Arial, sans-serif",
        fontSize: "28px",
        color: "#ffffff",
        stroke: "#000",
        strokeThickness: 6,
        align: "center",
      })
      .setOrigin(0.5, 0);

    this.livesText = this.add
      .text(width - 16, 16, this.makeLivesText(), {
        fontFamily: "Arial",
        fontSize: "22px",
        color: "#ffffff",
        stroke: "#000",
        strokeThickness: 4,
        align: "right",
      })
      .setOrigin(1, 0);

    // Draw a more cartoonish, detailed faucet/tap
    const tapG = this.add.graphics();
    const bodyW = 180;
    const bodyH = 34;
    const nozzleW = 48;
    const nozzleH = 40;
    const tapOffset = 16; // Offset to align nozzle opening with tapX

    // Main pipe body (darker gray)
    tapG.fillStyle(0x5b6b7a, 1);
    tapG.fillRoundedRect(
      this.tapX - bodyW - 16 - tapOffset,
      this.tapY - bodyH / 2,
      bodyW,
      bodyH,
      14
    );

    // Vertical neck into nozzle (darker gray)
    tapG.fillRoundedRect(this.tapX - 26 - tapOffset, this.tapY - 30, 22, 60, 10);

    // Nozzle head (lighter gray)
    tapG.fillStyle(0x8a9baa, 1);
    tapG.fillRoundedRect(this.tapX - 8 - tapOffset, this.tapY - 18, nozzleW, nozzleH, 12);

    // Nozzle opening (dark inset)
    tapG.fillStyle(0x333333, 1);
    tapG.fillEllipse(this.tapX + 16 - tapOffset, this.tapY + nozzleH - 26, 22, 10);
    tapG.fillStyle(0x50d9ff, 0.5); // Watery sheen
    tapG.fillEllipse(this.tapX + 16 - tapOffset, this.tapY + nozzleH - 28, 20, 6);

    // Outlines for definition
    tapG.lineStyle(5, 0x0b0b0b, 0.9);
    tapG.strokeRoundedRect(
      this.tapX - bodyW - 16 - tapOffset,
      this.tapY - bodyH / 2,
      bodyW,
      bodyH,
      14
    );
    tapG.strokeRoundedRect(this.tapX - 26 - tapOffset, this.tapY - 30, 22, 60, 10);
    tapG.strokeRoundedRect(this.tapX - 8 - tapOffset, this.tapY - 18, nozzleW, nozzleH, 12);

    // Water graphics
    this.waterG = this.add.graphics();

    // Create a texture for our particles
    const particleG = this.add.graphics();
    particleG.fillStyle(0xffffff, 1);
    particleG.fillCircle(6, 6, 6);
    particleG.generateTexture("droplet", 12, 12);
    particleG.destroy();

    // Create splash particle emitter (initially off)
    this.splashParticles = this.add.particles(0, 0, "droplet", {
      speed: { min: 60, max: 150 },
      angle: { min: -120, max: -60 },
      scale: { start: 0.5, end: 0 },
      lifespan: 400,
      frequency: -1, // manual emission
      tint: 0x50d9ff,
      alpha: { start: 0.9, end: 0 },
      gravityY: 300,
    });
    this.splashParticles.setDepth(2000); // Render splashes on top of everything

    // Build cups pipeline
    const { cupW, cupH, cupY } = computeCupMetrics(width, height);
    const spacing = Math.floor(width / 3);
    for (let i = 0; i < 3; i++) {
      const x = -cupW - i * spacing; // start off-screen to the left staggered
      this.cups.push(this.createCup(x, cupY, cupW, cupH, 0));
    }

    // Input handlers (pointer + keyboard)
    this.input.on("pointerdown", () => (this.pouring = true));
    this.input.on("pointerup", () => (this.pouring = false));
    this.input.keyboard?.on("keydown-SPACE", () => (this.pouring = true));
    this.input.keyboard?.on("keyup-SPACE", () => (this.pouring = false));
    this.input.keyboard?.on("keydown-LEFT", () => (this.pouring = true));
    this.input.keyboard?.on("keyup-LEFT", () => (this.pouring = false));
    this.input.keyboard?.on("keydown-RIGHT", () => (this.pouring = true));
    this.input.keyboard?.on("keyup-RIGHT", () => (this.pouring = false));
    this.input.on("gameout", () => (this.pouring = false));
  }

  private createCup(x: number, baseY: number, w: number, h: number, difficulty: number): Cup {
    const container = this.add.container(x, baseY);

    // Cup outline (glass) – sides and bottom only, open at the top
    const outlineG = this.add.graphics();
    outlineG.lineStyle(4, 0xffffff, 0.9);
    // left side
    outlineG.lineBetween(-w / 2, -h, -w / 2, 0);
    // right side
    outlineG.lineBetween(w / 2, -h, w / 2, 0);
    // bottom
    outlineG.beginPath();
    outlineG.moveTo(-w / 2, 0);
    outlineG.lineTo(w / 2, 0);
    outlineG.strokePath();

    // Fill rectangle (water inside cup) - positioned from the bottom up
    const fillRect = this.add
      .rectangle(0, 0, w - 16, 0, 0x50d9ff, 0.85)
      .setOrigin(0.5, 1)
      .setDepth(5);

    // NO MASK - let the fill be fully visible
    // The outline defines the visual boundary

    // Target band (highlight where to fill) – clamped to never exceed cup height
    const targetCenter = Phaser.Math.FloatBetween(0.7, 0.88); // lower range to keep in bounds
    const targetWidth = Phaser.Math.Linear(
      BASE_TARGET_BAND,
      MIN_TARGET_BAND,
      Phaser.Math.Clamp(difficulty, 0, 1)
    );
    // Ensure band never goes above the cup rim
    const maxCenter = 1.0 - targetWidth / 2;
    const clampedCenter = Math.min(targetCenter, maxCenter);

    // Position the band at the correct height from the bottom
    const bandY = -h * clampedCenter;
    const targetBand = this.add
      .rectangle(0, bandY, w - 10, h * targetWidth, 0xffea00, 0.35)
      .setOrigin(0.5, 0.5)
      .setStrokeStyle(3, 0xffcc00, 0.9)
      .setDepth(10);

    container.add([outlineG, fillRect, targetBand]);

    const cup: Cup = {
      container,
      outlineG,
      fillRect,
      maskGeom: this.add.graphics(), // dummy, not used
      targetBand,
      x,
      y: baseY,
      w,
      h,
      fill: 0,
      targetCenter: clampedCenter,
      targetWidth,
      evaluated: false,
    };
    this.positionCupGraphics(cup);
    return cup;
  }

  private positionCupGraphics(cup: Cup) {
    const fillH = cup.h * cup.fill;
    cup.fillRect.setSize(cup.w - 16, fillH);
    // Position fill rect so it grows upward from the bottom
    cup.fillRect.y = 0;
  }

  update(_t: number, dtMs: number): void {
    // Stop all game logic when game is over
    if (this.isGameOver()) return;

    const dt = dtMs / 1000;
    const width = this.scale.width;
    const { cupW } = computeCupMetrics(this.scale.width, this.scale.height);
    const spacing = Math.floor(this.scale.width / 2.2); // increased spacing for better gameplay

    // Calculate dynamic speeds based on score (difficulty increases over time)
    const speedMultiplier = 1 + (this.score * SPEED_INCREASE_PER_SCORE) / 100;
    const currentCupSpeed = BASE_CUP_SPEED * speedMultiplier;
    const currentPourRate = BASE_POUR_RATE * speedMultiplier;

    // Animate cups movement
    for (const cup of this.cups) {
      cup.x += currentCupSpeed * dt;
      cup.container.x = cup.x;

      // Pouring logic (only when under tap)
      const under = Math.abs(cup.x - this.tapX) <= UNDER_TAP_BAND / 2 && cup.container.y > 0;
      if (this.pouring && under) {
        cup.fill = Phaser.Math.Clamp(cup.fill + currentPourRate * dt, 0, 1);
        this.positionCupGraphics(cup);
      }

      // Scoring when leaving the tap zone to the right (evaluate once)
      if (!cup.evaluated && cup.x - this.tapX > UNDER_TAP_BAND / 2) {
        this.scoreCupIfNeeded(cup);
        cup.evaluated = true;
      }
    }

    // Recycle cups that left the screen (right side)
    const off = this.cups.filter((c) => c.x - c.w / 2 > width + 10);
    for (const c of off) {
      const idx = this.cups.indexOf(c);
      if (idx >= 0) this.cups.splice(idx, 1);
    }
    // Ensure a continuous pipeline of cups on the left with more spacing
    const { cupH, cupY } = computeCupMetrics(this.scale.width, this.scale.height);
    let leftMost = this.leftMostX();
    if (!isFinite(leftMost)) leftMost = -cupW - 40;
    // Maintain at least 2 cups off-screen to the left to avoid gaps
    const minLeftX = -cupW - spacing * 2;
    while (leftMost > minLeftX) {
      const difficulty = Phaser.Math.Clamp(this.score / 20, 0, 1);
      leftMost = leftMost - spacing;
      this.cups.push(this.createCup(leftMost, cupY, cupW, cupH, difficulty));
    }

    // Draw water stream
    this.renderWater(dt);
  }

  private leftMostX(): number {
    return this.cups.reduce((min, c) => Math.min(min, c.x), Number.POSITIVE_INFINITY);
  }

  private scoreCupIfNeeded(cup: Cup) {
    const min = Phaser.Math.Clamp(cup.targetCenter - cup.targetWidth / 2, 0, 1);
    const max = Phaser.Math.Clamp(cup.targetCenter + cup.targetWidth / 2, 0, 1);

    let awarded = 0;
    const perfectMin = Phaser.Math.Clamp(cup.targetCenter - PERFECT_TOLERANCE, 0, 1);
    const perfectMax = Phaser.Math.Clamp(cup.targetCenter + PERFECT_TOLERANCE, 0, 1);

    if (cup.fill >= perfectMin && cup.fill <= perfectMax) {
      awarded = 2;
      const tipX = cup.x;
      const tipY = cup.y - cup.h * cup.fill - 10;
      this.showPerfectPopup(tipX, tipY);
    } else if (cup.fill >= min && cup.fill <= max) {
      awarded = 1;
    }

    if (awarded > 0) {
      this.score += awarded;
      this.scoreText.setText(this.makeScoreText());
    } else {
      this.misses += 1;
      this.livesText.setText(this.makeLivesText());
      this.cameras.main.shake(200, 0.01);
      if (this.misses >= MISSES_ALLOWED) {
        this.onGameOver();
      }
    }
  }

  private renderWater(dt: number) {
    this.waterPulse += dt * 8;
    this.waterG.clear();
    if (!this.pouring || this.isGameOver()) {
      this.splashParticles.stop();
      return;
    }

    const width = 16 + Math.sin(this.waterPulse) * 2;
    // Determine intersection with the cup directly under the tap
    let endY = this.scale.height;
    let isHittingCup = false;
    let splashX = this.tapX;
    let splashY = this.scale.height;

    // Find the cup that's under the tap
    const activeCup = this.cups
      .filter((c) => {
        const cupLeft = c.x - c.w / 2;
        const cupRight = c.x + c.w / 2;
        return this.tapX >= cupLeft && this.tapX <= cupRight;
      })
      .sort((a, b) => Math.abs(a.x - this.tapX) - Math.abs(b.x - this.tapX))[0];

    if (activeCup) {
      const interiorLeft = activeCup.x - (activeCup.w - 16) / 2;
      const interiorRight = activeCup.x + (activeCup.w - 16) / 2;

      // Check if water hits the interior (fills the cup)
      if (this.tapX >= interiorLeft && this.tapX <= interiorRight) {
        // Water is inside the cup - stop at water surface or rim
        const rimY = activeCup.y - activeCup.h;
        const surfaceY = activeCup.y - activeCup.h * activeCup.fill;
        endY = Math.max(rimY, surfaceY);
        splashY = endY;
        isHittingCup = true;
      } else {
        // Water hits the side/edge of the cup - stop at the top rim
        const rimY = activeCup.y - activeCup.h;
        endY = rimY;
        splashY = rimY;
        isHittingCup = true;
      }
      splashX = this.tapX;
    }

    // Draw a vertical watery column with layered alpha for movement feel
    const x = this.tapX;
    const y1 = this.tapY + 10;
    const y2 = endY;

    this.waterG.fillStyle(0x50d9ff, 0.85);
    this.waterG.fillRect(x - width / 2, y1, width, y2 - y1);
    this.waterG.fillStyle(0xffffff, 0.25);
    this.waterG.fillRect(x - width / 2 + 3, y1, 4, y2 - y1);
    this.waterG.fillStyle(0x0aaaf0, 0.3);
    this.waterG.fillRect(x + width / 2 - 5, y1, 3, y2 - y1);

    // Emit splash particles when water hits a surface
    if (isHittingCup || endY >= this.scale.height - 1) {
      this.splashParticles.setPosition(splashX, splashY);
      if (!this.splashParticles.emitting) {
        this.splashParticles.start();
      }
      // Emit a few particles per frame for a continuous splash
      this.splashParticles.explode(3);
    } else {
      this.splashParticles.stop();
    }
  }

  private isGameOver(): boolean {
    return this.misses >= MISSES_ALLOWED;
  }

  private onGameOver() {
    if (!this.isGameOver()) return; // ensure state

    // update best
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem(`${GAME_ID}-best`, String(this.best));
    }

    const name = getUserName();
    if (name && this.score > 0) {
      postHighScore({ name, gameId: GAME_ID, score: this.score }).catch(() => {});
    }

    // Overlay
    const w = this.scale.width,
      h = this.scale.height;
    const overlay = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.55).setDepth(1000);
    const t1 = this.add
      .text(w / 2, h / 2 - 20, "Game Over", {
        fontFamily: "Arial Black",
        fontSize: "42px",
        color: "#fff",
        stroke: "#000",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(1001);
    const t2 = this.add
      .text(w / 2, h / 2 + 30, "Tap to Restart", {
        fontFamily: "Arial",
        fontSize: "22px",
        color: "#fff",
      })
      .setOrigin(0.5)
      .setDepth(1001);

    // Notify shell
    try {
      dispatchGameOver({ gameId: GAME_ID, score: this.score, ts: Date.now() });
    } catch {}

    this.time.delayedCall(900, () => {
      this.input.once("pointerdown", () => {
        overlay.destroy();
        t1.destroy();
        t2.destroy();
        this.restart();
      });
    });
  }

  private restart() {
    // reset state
    this.misses = 0;
    this.score = 0;
    this.scoreText.setText(this.makeScoreText());
    this.livesText.setText(this.makeLivesText());

    // reset cups
    for (const c of this.cups) c.container.destroy();
    this.cups.length = 0;
    const { cupW, cupH, cupY } = computeCupMetrics(this.scale.width, this.scale.height);
    const spacing = Math.floor(this.scale.width / 3);
    for (let i = 0; i < 3; i++) {
      const x = -cupW - i * spacing;
      this.cups.push(this.createCup(x, cupY, cupW, cupH, 0));
    }
  }

  private showPerfectPopup(x: number, y: number) {
    const txt = this.add
      .text(x, y, "Perfect", {
        fontFamily: "Fredoka, Arial Black, Arial, sans-serif",
        fontSize: "24px",
        color: "#ffd166",
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(1000)
      .setAlpha(0.95);

    this.tweens.add({
      targets: txt,
      y: y - 24,
      alpha: 0,
      duration: 500,
      ease: "Cubic.EaseIn",
      onComplete: () => txt.destroy(),
    });
  }

  private makeScoreText(): string {
    return `Score: ${this.score}   Best: ${this.best}`;
  }

  private makeLivesText(): string {
    const remaining = MISSES_ALLOWED - this.misses;
    return "❤".repeat(Math.max(0, remaining));
  }
}
