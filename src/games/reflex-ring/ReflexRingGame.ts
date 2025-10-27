import Phaser from "phaser";
import { trackGameStart } from "../../utils/analytics";

export default class ReflexRingGame extends Phaser.Scene {
  private centerX!: number;
  private centerY!: number;
  private radius!: number;

  private arrowContainer!: Phaser.GameObjects.Container;
  private currentAngle = 0; // radians
  private angularVelocity = 1.5; // rad/s

  private targetAngle = 0; // radians
  private segmentWidth = Phaser.Math.DegToRad(28);

  private wedgeGraphics!: Phaser.GameObjects.Graphics;
  private ringGraphics!: Phaser.GameObjects.Graphics;

  private score = 0;
  private best = 0;
  private scoreText!: Phaser.GameObjects.Text;

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

    // Background using PNG image
    const bg = this.add.image(0, 0, "rr-bg").setOrigin(0).setDepth(-10);
    const scale = Math.max(width / bg.width, height / bg.height);
    bg.setScale(scale);

    // Ring with cartoon ticks
    this.ringGraphics = this.add.graphics();
    this.ringGraphics.lineStyle(8, 0x0b0b0b, 1);
    this.ringGraphics.strokeCircle(this.centerX, this.centerY, this.radius + 2);
    this.ringGraphics.lineStyle(10, 0xffffff, 1);
    this.ringGraphics.strokeCircle(this.centerX, this.centerY, this.radius);
    // Tick marks every 30 degrees
    this.ringGraphics.lineStyle(6, 0x0b0b0b, 0.6);
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      const r1 = this.radius - 12;
      const r2 = this.radius + 6;
      const x1 = this.centerX + Math.cos(a) * r1;
      const y1 = this.centerY + Math.sin(a) * r1;
      const x2 = this.centerX + Math.cos(a) * r2;
      const y2 = this.centerY + Math.sin(a) * r2;
      this.ringGraphics.lineBetween(x1, y1, x2, y2);
    }

    // Arrow (cartoon shapes) in a container so we can rotate from center
    this.arrowContainer = this.add.container(this.centerX, this.centerY);
    const shaftHeight = 15; // keep consistent with visual thickness
    const headLength = 241;
    const headHalfWidth = shaftHeight / 2; // match head base height to shaft height for perfect centering
    // Keep the tip just shy of the ring by subtracting a small margin
    const shaftWidth = this.radius - headLength - 8;
    // const shaft = this.add.rectangle(0, 0, shaftWidth, shaftHeight, 0xfde047).setOrigin(0, 0.5);
    // shaft.setStrokeStyle(4, 0x0b0b0b, 1);
    // Position the triangle so its flat base (x=0) meets the shaft end (x=shaftWidth)
    const head = this.add
      .triangle(shaftWidth, 0, 0, -headHalfWidth, 0, shaftHeight, headLength, 0, 0xfef08a)
      .setOrigin(0, 0);
    head.setStrokeStyle(4, 0x0b0b0b, 1);
    this.arrowContainer.add([head]);

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

    // Input
    this.input.on("pointerdown", this.handleTap, this);
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.currentAngle = Phaser.Math.Angle.Wrap(this.currentAngle + this.angularVelocity * dt);
    this.arrowContainer.rotation = this.currentAngle;
  }

  private drawWedge(angle: number): void {
    this.wedgeGraphics.clear();
    this.wedgeGraphics.fillStyle(0xffccff, 0.6);
    const start = angle - this.segmentWidth / 2;
    const end = angle + this.segmentWidth / 2;
    this.wedgeGraphics.slice(this.centerX, this.centerY, this.radius, start, end, true);
    this.wedgeGraphics.fillPath();

    this.wedgeGraphics.lineStyle(2, 0x333333, 0.9);
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
      this.score += 1;
      this.scoreText.setText(this.makeScoreText());

      const speed = Math.abs(this.angularVelocity);
      const next = Math.min(speed * 1.03, 6);
      this.angularVelocity = -Math.sign(this.angularVelocity || 1) * next;

      // Flash the wedge for feedback
      this.tweens.add({
        targets: this.wedgeGraphics,
        alpha: { from: 0.6, to: 1 },
        duration: 80,
        yoyo: true,
      });

      this.pickNewTargetAngle(this.targetAngle);
    } else {
      this.onGameOver();
    }
  }

  private onGameOver(): void {
    this.input.off("pointerdown", this.handleTap, this);

    // Update best
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem("reflex-ring-best", String(this.best));
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
      this.angularVelocity = 1.5;
      this.pickNewTargetAngle(this.currentAngle);
      this.input.on("pointerdown", this.handleTap, this);
      this.input.off("pointerdown", restart);
      // Track new game start on restart attempts
      trackGameStart("reflex-ring", "Reflex Ring");
    };

    this.input.once("pointerdown", restart);
  }

  private isWithinWedge(angle: number, wedgeCenter: number, wedgeWidth: number): boolean {
    const diff = Phaser.Math.Angle.Wrap(angle - wedgeCenter);
    return Math.abs(diff) <= (wedgeWidth * 1.2) / 2;
  }

  private pickNewTargetAngle(avoidNear: number): void {
    const minSeparation = this.segmentWidth * 2;
    let tries = 0;
    let candidate = Phaser.Math.FloatBetween(0, Phaser.Math.PI2);

    while (tries++ < 30 && this.isWithinWedge(candidate, avoidNear, minSeparation)) {
      candidate = Phaser.Math.FloatBetween(0, Phaser.Math.PI2);
    }

    this.targetAngle = candidate;
    this.drawWedge(this.targetAngle);
  }

  private makeScoreText(): string {
    return `Score: ${this.score}   Best: ${this.best}`;
  }
}
