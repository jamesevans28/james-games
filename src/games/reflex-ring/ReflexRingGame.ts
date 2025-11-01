import Phaser from "phaser";
import { trackGameStart } from "../../utils/analytics";
import { getUserName } from "../../utils/user";
import { postHighScore } from "../../lib/api";

// Angle spacing constraints for new target placement (degrees)
// Tweak these to tune how far the next highlight can appear from the last angle.
// Note: due to circular geometry, the effective maximum separation using shortest arc is 180°.
// If you set a value > 180, it will be clamped to 180 internally.
const MIN_TARGET_SEPARATION_DEG = 40;
const MAX_TARGET_SEPARATION_DEG = 250;

export default class ReflexRingGame extends Phaser.Scene {
  private centerX!: number;
  private centerY!: number;
  private radius!: number;

  private arrowContainer!: Phaser.GameObjects.Container;
  private currentAngle = 0; // radians
  private angularVelocity = 1.5; // rad/s
  private maxSpeed = 5;

  private targetAngle = 0; // radians
  private segmentWidth = Phaser.Math.DegToRad(28);

  private wedgeGraphics!: Phaser.GameObjects.Graphics;
  private ringGraphics!: Phaser.GameObjects.Graphics;
  private wedgeColor: number = 0xff3d81;
  private readonly wedgePalette: number[] = [
    0x22e3ff, // cyan
    0xffd166, // warm yellow
    0xff6b6b, // coral
    0x7cfc00, // lime
    0x9d4edd, // purple
    0x00f5d4, // aqua mint
  ];

  private score = 0;
  private best = 0;
  private scoreText!: Phaser.GameObjects.Text;

  // Track pass-through logic for target wedge
  private inWedgePrev = false;
  private tappedThisWedge = false;
  private gameOver = false;

  // DOM tap forwarding (to capture taps outside the canvas inside the game container)
  private parentEl: HTMLElement | null = null;
  private domPointerHandler?: (ev: PointerEvent) => void;

  constructor() {
    super("ReflexRingGame");
  }

  preload(): void {
    // Load images via asset pack for consistency
    // Use an absolute path so routes like /games/:id don't resolve this relatively
    this.load.pack("preload", "/assets/preload-asset-pack.json", "preload");
  }

  create(): void {
    const { width, height } = this.scale;
    this.centerX = Math.floor(width / 2);
    this.centerY = Math.floor(height / 2);
    this.radius = Math.floor(Math.min(width, height) * 0.35);

    // Background now handled by DOM/CSS to fully cover viewport; Phaser canvas is transparent

    // Ring with cartoon ticks (bold outline + inner stroke)
    this.ringGraphics = this.add.graphics();
    this.ringGraphics.lineStyle(12, 0x0b0b0b, 1);
    this.ringGraphics.strokeCircle(this.centerX, this.centerY, this.radius + 3);
    this.ringGraphics.lineStyle(12, 0xffffff, 1);
    this.ringGraphics.strokeCircle(this.centerX, this.centerY, this.radius);
    // Tick marks every 30 degrees (cartoon black)
    this.ringGraphics.lineStyle(6, 0x0b0b0b, 0.9);
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      const r1 = this.radius - 12;
      const r2 = this.radius + 6;
      const x1 = this.centerX + Math.cos(a) * r1;
      const y1 = this.centerY + Math.sin(a) * r1;
      const x2 = this.centerX + Math.cos(a) * r2;
      const y2 = this.centerY + Math.sin(a) * r2;
      this.ringGraphics.lineBetween(x1, y1, x2, y2);
    }

    // Arrow (cartoon) in a container so we can rotate from center
    this.arrowContainer = this.add.container(this.centerX, this.centerY);
    const margin = 12;
    const shaftHeight = Math.max(10, Math.floor(this.radius * 0.08));
    const headLength = Math.max(18, Math.floor(this.radius * 0.2));
    const shaftLength = this.radius - margin;
    const shaftWidth = Math.max(12, shaftLength - headLength);
    const headHalfWidth = Math.floor(shaftHeight * 0.7);

    // Shadow (offset)
    const shadowShaft = this.add
      .rectangle(3, 3, shaftWidth, shaftHeight, 0x000000, 0.35)
      .setOrigin(0, 0.5);
    const shadowHead = this.add
      .triangle(
        shaftWidth + 3,
        3,
        0,
        -headHalfWidth,
        0,
        headHalfWidth,
        headLength,
        0,
        0x000000,
        0.35
      )
      .setOrigin(0, 0.5);

    // Main arrow
    const shaft = this.add.rectangle(0, 0, shaftWidth, shaftHeight, 0xffd400).setOrigin(0, 0.5);
    shaft.setStrokeStyle(4, 0x0b0b0b, 1);
    const head = this.add
      .triangle(shaftWidth, 0, 0, -headHalfWidth, 0, headHalfWidth, headLength, 0, 0xfff275)
      .setOrigin(0, 0.5);
    head.setStrokeStyle(4, 0x0b0b0b, 1);
    this.arrowContainer.add([shadowShaft, shadowHead, shaft, head]);

    // Wedge graphics layer
    this.wedgeGraphics = this.add.graphics();
    this.best = Number(localStorage.getItem("reflex-ring-best") || 0);
    this.scoreText = this.add
      .text(this.centerX, 24, this.makeScoreText(), {
        fontFamily: "Fredoka, Arial Black, Arial, sans-serif",
        fontSize: "28px",
        color: "#ffffff",
        stroke: "#000",
        strokeThickness: 6,
        align: "center",
      })
      .setOrigin(0.5, 0);

    this.add
      .text(this.centerX, height - 40, "Tap when the arrow hits the highlight", {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#3f3f3f",
      })
      .setOrigin(0.5, 1);

    // Initial target
    this.pickNewTargetAngle(this.currentAngle);

    // Input: in-canvas tap
    this.input.on("pointerdown", this.handleTap, this);

    // Input: capture taps on the full game container (outside canvas letterbox)
    this.parentEl = this.game.canvas.parentElement as HTMLElement | null;
    this.domPointerHandler = (ev: PointerEvent) => {
      // Avoid double trigger when the tap is directly on the canvas
      if (ev.target instanceof HTMLCanvasElement) return;
      // Ignore if the scene is in game over state; restart is handled via scene input
      if (this.gameOver) return;
      this.handleTap();
    };
    if (this.parentEl && this.domPointerHandler) {
      this.parentEl.addEventListener("pointerdown", this.domPointerHandler, { passive: true });
    }

    // Clean up DOM listener on shutdown
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.parentEl && this.domPointerHandler) {
        this.parentEl.removeEventListener("pointerdown", this.domPointerHandler);
      }
      this.domPointerHandler = undefined;
      this.parentEl = null;
    });
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.currentAngle = Phaser.Math.Angle.Wrap(this.currentAngle + this.angularVelocity * dt);
    this.arrowContainer.rotation = this.currentAngle;

    // Detect entering/exiting the target wedge to fail the run if player doesn't tap in time
    const inWedgeNow = this.isWithinWedge(this.currentAngle, this.targetAngle, this.segmentWidth);
    if (!this.inWedgePrev && inWedgeNow) {
      // Just entered the wedge for this pass
      this.tappedThisWedge = false;
    }
    if (this.inWedgePrev && !inWedgeNow) {
      // Exited the wedge; if not tapped during this pass -> game over
      if (!this.tappedThisWedge && !this.gameOver) {
        this.onGameOver();
      }
    }
    this.inWedgePrev = inWedgeNow;
  }

  private drawWedge(angle: number): void {
    this.wedgeGraphics.clear();
    this.wedgeGraphics.fillStyle(this.wedgeColor, 0.85);
    const start = angle - this.segmentWidth / 2;
    const end = angle + this.segmentWidth / 2;
    this.wedgeGraphics.slice(this.centerX, this.centerY, this.radius, start, end, true);
    this.wedgeGraphics.fillPath();

    // Thick cartoon outline
    this.wedgeGraphics.lineStyle(4, 0x0b0b0b, 1);
    this.wedgeGraphics.beginPath();
    this.wedgeGraphics.arc(this.centerX, this.centerY, this.radius, start, end, false);
    this.wedgeGraphics.lineBetween(
      this.centerX,
      this.centerY,
      this.centerX + Math.cos(start) * this.radius,
      this.centerY + Math.sin(start) * this.radius
    );
    this.wedgeGraphics.lineBetween(
      this.centerX,
      this.centerY,
      this.centerX + Math.cos(end) * this.radius,
      this.centerY + Math.sin(end) * this.radius
    );
    this.wedgeGraphics.strokePath();
  }

  private handleTap(): void {
    const within = this.isWithinWedge(this.currentAngle, this.targetAngle, this.segmentWidth);
    if (within) {
      // check for perfect hit
      const isPerfect = this.isPerfectHit(this.currentAngle, this.targetAngle);

      //update score
      this.score += isPerfect ? 2 : 1;
      this.scoreText.setText(this.makeScoreText());

      //update speed
      const speed = Math.abs(this.angularVelocity);
      const next = Math.min(speed * 1.03, this.maxSpeed);
      this.angularVelocity = -Math.sign(this.angularVelocity || 1) * next;

      // Flash the wedge for feedback
      this.tweens.add({
        targets: this.wedgeGraphics,
        alpha: { from: 0.6, to: 1 },
        duration: 80,
        yoyo: true,
      });

      // Show perfect popup if centered enough
      if (isPerfect) {
        const tip = this.getArrowTipPosition();
        this.showPerfectPopup(tip.x, tip.y);
      }

      // Mark that we tapped during this wedge pass
      this.tappedThisWedge = true;

      this.pickNewTargetAngle(this.targetAngle);
    } else {
      this.onGameOver();
    }
  }

  private onGameOver(): void {
    if (this.gameOver) return;
    this.gameOver = true;
    this.input.off("pointerdown", this.handleTap, this);
    // Stop arrow rotation while in game-over state
    this.angularVelocity = 0;

    // Camera effects
    this.cameras.main.shake(250, 0.01);
    this.cameras.main.flash(120, 255, 50, 50);

    // Update best (local)
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem("reflex-ring-best", String(this.best));
    }

    // Submit this run score (always)
    const name = getUserName();
    if (name && this.score > 0) {
      // Submit asynchronously; no await to avoid blocking UI
      postHighScore({ name, gameId: "reflex-ring", score: this.score }).catch(() => {});
    }

    const overlay = this.add.rectangle(
      this.centerX,
      this.centerY,
      this.scale.width,
      this.scale.height,
      0x000000,
      0.55
    );
    const t1 = this.add
      .text(this.centerX, this.centerY - 20, "Game Over", {
        fontFamily: "Arial Black",
        fontSize: "42px",
        color: "#ffffff",
        stroke: "#000",
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    const t2 = this.add
      .text(this.centerX, this.centerY + 30, "Tap to Restart", {
        fontFamily: "Arial",
        fontSize: "22px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const restart = () => {
      overlay.destroy();
      t1.destroy();
      t2.destroy();
      this.score = 0;
      this.scoreText.setText(this.makeScoreText());
      this.currentAngle = 0;
      // Resume arrow rotation for a fresh run
      this.angularVelocity = 1.5;
      this.gameOver = false;
      this.inWedgePrev = false;
      this.tappedThisWedge = false;
      this.pickNewTargetAngle(this.currentAngle);
      this.input.on("pointerdown", this.handleTap, this);
      this.input.off("pointerdown", restart);
      // Track new game start on restart attempts
      trackGameStart("reflex-ring", "Reflex Ring");
    };

    // Add a short delay before allowing restart to avoid accidental taps
    this.time.delayedCall(1000, () => {
      this.input.once("pointerdown", restart);
    });
  }

  private isWithinWedge(angle: number, wedgeCenter: number, wedgeWidth: number): boolean {
    const diff = Phaser.Math.Angle.Wrap(angle - wedgeCenter);
    return Math.abs(diff) <= (wedgeWidth * 1.2) / 2;
  }

  // Perfect hit is a tighter window around the wedge center
  private isPerfectHit(angle: number, wedgeCenter: number): boolean {
    const diff = Math.abs(Phaser.Math.Angle.Wrap(angle - wedgeCenter));
    const perfectWindow = this.segmentWidth * 0.15; // ~15% of segment width
    return diff <= perfectWindow / 2;
  }

  // Compute the world position of the arrow tip (slightly inside the ring)
  private getArrowTipPosition(): { x: number; y: number } {
    const tipRadius = this.radius - 8;
    return {
      x: this.centerX + Math.cos(this.currentAngle) * tipRadius,
      y: this.centerY + Math.sin(this.currentAngle) * tipRadius,
    };
  }

  private showPerfectPopup(x: number, y: number): void {
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

  private pickNewTargetAngle(avoidNear: number): void {
    const minSep = Phaser.Math.DegToRad(MIN_TARGET_SEPARATION_DEG);
    // Clamp to 180° max effectively, since shortest angular distance is in [0, PI]
    const maxSep = Phaser.Math.DegToRad(Math.min(MAX_TARGET_SEPARATION_DEG, 180));

    let tries = 0;
    let candidate = Phaser.Math.FloatBetween(0, Phaser.Math.PI2);

    const isValid = (ang: number) => {
      const delta = Math.abs(Phaser.Math.Angle.Wrap(ang - avoidNear)); // [0, PI]
      return delta >= minSep && delta <= maxSep;
    };

    while (tries++ < 50 && !isValid(candidate)) {
      candidate = Phaser.Math.FloatBetween(0, Phaser.Math.PI2);
    }

    this.targetAngle = candidate;
    // Pick a vibrant color for the next wedge
    this.wedgeColor = this.wedgePalette[Phaser.Math.Between(0, this.wedgePalette.length - 1)];
    this.drawWedge(this.targetAngle);
    // Reset per-pass state so the player gets a fresh chance on the new segment
    this.inWedgePrev = false;
    this.tappedThisWedge = false;
  }

  private makeScoreText(): string {
    return `Score: ${this.score}   Best: ${this.best}`;
  }
}
