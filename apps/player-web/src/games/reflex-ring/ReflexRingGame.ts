import Phaser from "phaser";
import { BasePlatformScene } from "../../platform/scenes/BasePlatformScene";
import { tapZones } from "../../platform/input";
import { hexToNumber } from "../../platform/hud/format";
import {
  isPerfect,
  nextVelocity,
  pickTarget,
  pointsFor,
  powerupRoll,
  segmentHit,
  type Powerup,
} from "./useCases/rules";

const BASE_VELOCITY = 1.5; // rad/s
const BASE_MAX_SPEED = 5; // rad/s
const BASE_SEGMENT = Phaser.Math.DegToRad(28);

const POWERUP_CONFIG: Record<
  Powerup,
  { icon: string; banner: string; color: "sky" | "grape" | "grass" | "sun"; duration: number }
> = {
  "slow-time": { icon: "pu-hourglass", banner: "Slow time", color: "sky", duration: 6500 },
  "wide-wedge": { icon: "pu-shield", banner: "Wide target", color: "grape", duration: 6000 },
  "perfect-touch": { icon: "pu-star", banner: "Perfect streak", color: "grass", duration: 6000 },
  "auto-hit": { icon: "pu-lightning", banner: "Auto tap", color: "sun", duration: 6000 },
};

export default class ReflexRingGame extends BasePlatformScene {
  private centerX = 0;
  private centerY = 0;
  private radius = 0;
  private rng: () => number = Math.random;

  private arrowContainer!: Phaser.GameObjects.Container;
  private wedgeGraphics!: Phaser.GameObjects.Graphics;
  private wedgeColors: number[] = [];
  private wedgeColor = 0;
  private ink = 0;
  private bgSprites: Phaser.GameObjects.Sprite[] = [];

  private score = 0;
  private currentAngle = 0;
  private angularVelocity = BASE_VELOCITY;
  private maxSpeed = BASE_MAX_SPEED;
  private savedSpeed: { velocity: number; max: number } | null = null;
  private targetAngle = 0;
  private segmentWidth = BASE_SEGMENT;
  private inWedgePrev = false;
  private tappedThisWedge = false;

  private powerupToken?: Phaser.GameObjects.Container;
  private pendingPowerup: Powerup | null = null;
  private activePowerup: Powerup | null = null;
  private powerupTimer: Phaser.Time.TimerEvent | null = null;
  private powerupStatusText?: Phaser.GameObjects.Text;
  private powerupTokenRadius = 0;
  private forcePerfect = false;
  private autoHit = false;

  constructor() {
    super("ReflexRingGame");
  }

  preload(): void {
    this.load.svg("arrow", "/assets/reflex-ring/arrow.svg");
    this.load.svg("ring", "/assets/reflex-ring/ring.svg");
    this.load.svg("bg-rune", "/assets/reflex-ring/bg-rune.svg");
    this.load.svg("bg-sparkle", "/assets/reflex-ring/bg-sparkle.svg");
    this.load.svg("pu-hourglass", "/assets/reflex-ring/powerup-hourglass.svg", {
      width: 96,
      height: 96,
    });
    this.load.svg("pu-shield", "/assets/reflex-ring/powerup-shield.svg", { width: 96, height: 96 });
    this.load.svg("pu-star", "/assets/reflex-ring/powerup-star.svg", { width: 96, height: 96 });
    this.load.svg("pu-lightning", "/assets/reflex-ring/powerup-lightning.svg", {
      width: 96,
      height: 96,
    });
  }

  protected startRun(): void {
    const { width, height } = this.scale;
    const c = this.host.colors;
    this.rng = this.host.rng();
    this.ink = hexToNumber(c.ink);
    this.wedgeColors = [c.tomato, c.sun, c.grass, c.sky, c.grape].map(hexToNumber);

    this.centerX = Math.floor(width / 2);
    this.centerY = Math.floor(height / 2) + 20;
    this.radius = Math.floor(Math.min(width, height) * 0.35);

    this.score = 0;
    this.currentAngle = 0;
    this.angularVelocity = BASE_VELOCITY;
    this.maxSpeed = BASE_MAX_SPEED;
    this.savedSpeed = null;
    this.segmentWidth = BASE_SEGMENT;
    this.inWedgePrev = false;
    this.tappedThisWedge = false;
    this.powerupToken = undefined;
    this.pendingPowerup = null;
    this.activePowerup = null;
    this.powerupTimer = null;
    this.powerupStatusText = undefined;
    this.powerupTokenRadius = 0;
    this.forcePerfect = false;
    this.autoHit = false;

    this.createBackground(width, height);
    this.add
      .sprite(this.centerX, this.centerY, "ring")
      .setScale((this.radius * 2) / 316)
      .setDepth(1);
    this.wedgeGraphics = this.add.graphics().setDepth(2);
    this.createArrow();

    this.hud.setScore(0);
    this.hud.setBest(this.host.best.get());
    this.add
      .text(this.centerX, height - 40, "Tap when the arrow hits the colour", {
        fontFamily: this.host.fonts.body,
        fontSize: "20px",
        fontStyle: "700",
        color: c.ink,
        align: "center",
      })
      .setOrigin(0.5, 1)
      .setAlpha(0.7);

    this.newTarget();
    tapZones(this, { count: 1, onTap: () => this.handleTap() });

    this.time.addEvent({
      delay: Phaser.Math.Between(4000, 7000),
      loop: true,
      callback: () => {
        if (!this.runEnded && !this.activePowerup && !this.powerupToken) this.spawnPowerup();
      },
    });
  }

  update(time: number, delta: number): void {
    if (this.runEnded) return;
    this.driftBackground(time);

    this.currentAngle = Phaser.Math.Angle.Wrap(
      this.currentAngle + (this.angularVelocity * delta) / 1000,
    );
    this.arrowContainer.rotation = this.currentAngle;

    const inWedge = segmentHit(this.currentAngle, this.targetAngle, this.segmentWidth);
    if (!this.inWedgePrev && inWedge) this.tappedThisWedge = false;
    if (this.inWedgePrev && !inWedge && !this.tappedThisWedge) {
      // The arrow left the wedge without a tap.
      if (this.autoHit) this.registerHit(true);
      else return this.lose();
    }
    this.inWedgePrev = inWedge;

    if (!this.activePowerup && this.powerupToken && this.pendingPowerup) {
      const tip = this.arrowTip();
      const dx = tip.x - this.powerupToken.x;
      const dy = tip.y - this.powerupToken.y;
      if (dx * dx + dy * dy <= (this.powerupTokenRadius + 24) ** 2) {
        this.activatePowerup(this.pendingPowerup);
      }
    }

    if (this.activePowerup && this.powerupTimer && this.powerupStatusText) {
      const left = Math.max(0, this.powerupTimer.getRemainingSeconds()).toFixed(1);
      this.powerupStatusText.setText(`${POWERUP_CONFIG[this.activePowerup].banner} ${left}s`);
    }
  }

  // --- play ---------------------------------------------------------------

  private handleTap(): void {
    if (this.runEnded) return;
    if (segmentHit(this.currentAngle, this.targetAngle, this.segmentWidth)) {
      this.registerHit(
        this.forcePerfect || isPerfect(this.currentAngle, this.targetAngle, this.segmentWidth),
      );
    } else {
      this.lose();
    }
  }

  private registerHit(perfect: boolean): void {
    this.score += pointsFor(perfect);
    this.hud.setScore(this.score);
    if (perfect) {
      this.host.audio.ding();
      this.host.haptics.tap();
      const tip = this.arrowTip();
      this.hud.popup("Perfect!", tip.x, tip.y);
    } else {
      this.host.audio.pop();
    }

    this.angularVelocity = nextVelocity(this.angularVelocity, this.maxSpeed);
    this.tweens.add({
      targets: this.wedgeGraphics,
      alpha: { from: 0.6, to: 1 },
      duration: 90,
      yoyo: true,
    });
    this.tweens.add({
      targets: this.arrowContainer,
      scale: 1.08,
      duration: 80,
      yoyo: true,
      ease: "Sine.Out",
    });

    this.tappedThisWedge = true;
    this.newTarget();
  }

  private lose(): void {
    if (this.activePowerup) this.expirePowerup();
    this.shakeCamera(250, 0.012);
    this.flashCamera(120, 255, 90, 78);
    this.endRun(this.score);
  }

  private newTarget(): void {
    this.targetAngle = pickTarget(this.rng, this.targetAngle);
    const colors = this.wedgeColors.filter((c) => c !== this.wedgeColor);
    this.wedgeColor = colors[Math.floor(this.rng() * colors.length)] ?? this.ink;
    this.drawWedge();
    this.inWedgePrev = false;
    this.tappedThisWedge = false;
  }

  // --- power-ups ------------------------------------------------------------

  private spawnPowerup(): void {
    const type = powerupRoll(this.rng);
    const config = POWERUP_CONFIG[type];
    const angle = this.rng() * Math.PI * 2;
    const r = this.radius * 0.85;
    const size = this.radius * 0.36;

    const token = this.add
      .container(this.centerX + Math.cos(angle) * r, this.centerY + Math.sin(angle) * r)
      .setDepth(10)
      .setAlpha(0);
    const disc = this.add
      .circle(0, 0, size / 2, hexToNumber(this.host.colors.paper))
      .setStrokeStyle(5, this.ink);
    const icon = this.add.image(0, 0, config.icon).setDisplaySize(size * 0.75, size * 0.75);
    token.add([disc, icon]);
    this.tweens.add({ targets: token, alpha: 1, duration: 220, ease: "Cubic.Out" });

    this.pendingPowerup = type;
    this.powerupToken = token;
    this.powerupTokenRadius = size / 2;

    this.time.delayedCall(config.duration + 2000, () => {
      if (this.powerupToken !== token || this.activePowerup) return;
      this.tweens.add({
        targets: token,
        alpha: 0,
        duration: 180,
        onComplete: () => token.destroy(true),
      });
      this.powerupToken = undefined;
      this.pendingPowerup = null;
    });
  }

  private activatePowerup(type: Powerup): void {
    this.activePowerup = type;
    this.pendingPowerup = null;
    this.powerupToken?.destroy(true);
    this.powerupToken = undefined;
    this.host.audio.play("score");

    switch (type) {
      case "slow-time":
        this.savedSpeed = { velocity: this.angularVelocity, max: this.maxSpeed };
        this.angularVelocity *= 0.75;
        this.maxSpeed *= 0.75;
        break;
      case "wide-wedge":
        this.segmentWidth = BASE_SEGMENT * 2;
        this.drawWedge();
        break;
      case "perfect-touch":
        this.forcePerfect = true;
        break;
      case "auto-hit":
        this.autoHit = true;
        break;
    }

    const { banner, color, duration } = POWERUP_CONFIG[type];
    this.powerupStatusText?.destroy();
    this.powerupStatusText = this.add
      .text(this.centerX, this.centerY - this.radius - 40, banner, {
        fontFamily: this.host.fonts.display,
        fontSize: "26px",
        fontStyle: "800",
        color: this.host.colors[color],
        stroke: this.host.colors.ink,
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(15);
    this.powerupTimer = this.time.delayedCall(duration, () => this.expirePowerup());
  }

  private expirePowerup(): void {
    switch (this.activePowerup) {
      case "slow-time":
        if (this.savedSpeed) {
          this.angularVelocity =
            Math.sign(this.angularVelocity || 1) * Math.abs(this.savedSpeed.velocity);
          this.maxSpeed = this.savedSpeed.max;
        }
        break;
      case "wide-wedge":
        this.segmentWidth = BASE_SEGMENT;
        this.drawWedge();
        break;
      case "perfect-touch":
        this.forcePerfect = false;
        break;
      case "auto-hit":
        this.autoHit = false;
        break;
    }
    this.savedSpeed = null;
    this.activePowerup = null;
    this.powerupTimer?.remove();
    this.powerupTimer = null;
    const text = this.powerupStatusText;
    this.powerupStatusText = undefined;
    if (text)
      this.tweens.add({ targets: text, alpha: 0, duration: 220, onComplete: () => text.destroy() });
  }

  // --- drawing --------------------------------------------------------------

  private createBackground(width: number, height: number): void {
    this.bgSprites = [];
    const scatter = (key: string, count: number, alpha: number) => {
      for (let i = 0; i < count; i++) {
        const sprite = this.add
          .sprite(this.rng() * width, this.rng() * height, key)
          .setAlpha(alpha)
          .setScale(1 + this.rng() * 0.5)
          .setDepth(-10);
        this.bgSprites.push(sprite);
      }
    };
    scatter("bg-rune", 6, 0.25);
    scatter("bg-sparkle", 10, 0.3);
  }

  private driftBackground(time: number): void {
    const { width, height } = this.scale;
    this.bgSprites.forEach((s, i) => {
      s.x = Phaser.Math.Wrap(s.x + Math.sin(time / 800 + i) * 0.2, -20, width + 20);
      s.y = Phaser.Math.Wrap(s.y + Math.cos(time / 1000 + i) * 0.2, -20, height + 20);
    });
  }

  private createArrow(): void {
    this.arrowContainer = this.add.container(this.centerX, this.centerY).setDepth(3);
    const tailOriginX = 20 / 159; // tail position inside the 159×215 SVG
    const scale = (this.radius * 0.9) / 139; // 139 px tip-to-tail in the SVG
    const shadow = this.add
      .sprite(5, 3, "arrow")
      .setOrigin(tailOriginX, 0.5)
      .setScale(scale)
      .setAlpha(0.25)
      .setTint(this.ink)
      .setTintMode(Phaser.TintModes.FILL);
    const arrow = this.add.sprite(0, 0, "arrow").setOrigin(tailOriginX, 0.5).setScale(scale);
    this.arrowContainer.add([shadow, arrow]);
  }

  private drawWedge(): void {
    const g = this.wedgeGraphics;
    const start = this.targetAngle - this.segmentWidth / 2;
    const end = this.targetAngle + this.segmentWidth / 2;
    g.clear();
    g.fillStyle(this.wedgeColor, 0.9);
    g.slice(this.centerX, this.centerY, this.radius, start, end, false);
    g.fillPath();
    g.lineStyle(5, this.ink, 1);
    g.slice(this.centerX, this.centerY, this.radius, start, end, false);
    g.strokePath();
  }

  private arrowTip(): { x: number; y: number } {
    const r = this.radius - 12;
    return {
      x: this.centerX + Math.cos(this.currentAngle) * r,
      y: this.centerY + Math.sin(this.currentAngle) * r,
    };
  }
}
