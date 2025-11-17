// (Removed duplicate power-up system methods and properties)
import Phaser from "phaser";
import { trackGameStart } from "../../utils/analytics";
import { dispatchGameOver } from "../../utils/gameEvents";

const MIN_TARGET_SEPARATION_DEG = 40;
const MAX_TARGET_SEPARATION_DEG = 250;
const PERFECT_WINDOW_RATIO = 0.2;

const POWERUP_TYPES = ["slow-time", "wide-wedge", "perfect-touch", "auto-hit"] as const;
type PowerupType = (typeof POWERUP_TYPES)[number];

const POWERUP_CONFIG: Record<
  PowerupType,
  { short: string; banner: string; circleColor: number; textColor: string; duration: number }
> = {
  "slow-time": {
    short: "SLOW",
    banner: "Slow Time",
    circleColor: 0x1d4ed8,
    textColor: "#BFDBFE",
    duration: 6500,
  },
  "wide-wedge": {
    short: "WIDE",
    banner: "Wide Target",
    circleColor: 0x9333ea,
    textColor: "#F3E8FF",
    duration: 6000,
  },
  "perfect-touch": {
    short: "PERF",
    banner: "Perfect Streak",
    circleColor: 0x047857,
    textColor: "#D1FAE5",
    duration: 6000,
  },
  "auto-hit": {
    short: "AUTO",
    banner: "Auto Tap",
    circleColor: 0xf59e0b,
    textColor: "#FEF3C7",
    duration: 6000,
  },
};

export default class ReflexRingGame extends Phaser.Scene {
  private centerX!: number;
  private centerY!: number;
  private radius!: number;

  private arrowContainer!: Phaser.GameObjects.Container;
  private arrowSprite!: Phaser.GameObjects.Sprite;
  private arrowShadow!: Phaser.GameObjects.Sprite;
  private hitPulseTween?: Phaser.Tweens.Tween;

  private currentAngle = 0;
  private angularVelocity = 1.5;
  private readonly baseAngularVelocity = 1.5;
  private savedAngularVelocity: number | null = null;

  private maxSpeed = 5;
  private readonly baseMaxSpeed = 5;
  private savedMaxSpeed: number | null = null;

  private targetAngle = 0;
  private readonly baseSegmentWidth = Phaser.Math.DegToRad(28);
  private segmentWidth = this.baseSegmentWidth;

  private bgSprites: Phaser.GameObjects.Sprite[] = [];
  private ringSprite!: Phaser.GameObjects.Sprite;
  private wedgeGraphics!: Phaser.GameObjects.Graphics;
  private wedgeColor = 0xff3d81;
  private readonly wedgePalette = [0x22e3ff, 0xffd166, 0xff6b6b, 0x7cfc00, 0x9d4edd, 0x00f5d4];

  private score = 0;
  private best = 0;
  private scoreText!: Phaser.GameObjects.Text;

  private inWedgePrev = false;
  private tappedThisWedge = false;
  private gameOver = false;

  private parentEl: HTMLElement | null = null;
  private domPointerHandler?: (ev: PointerEvent) => void;

  private powerupToken?: Phaser.GameObjects.Container;
  private pendingPowerupType: PowerupType | null = null;
  private activePowerupType: PowerupType | null = null;
  private powerupTimer: Phaser.Time.TimerEvent | null = null;
  private powerupActive = false;
  private powerupStatusText?: Phaser.GameObjects.Text;
  private currentPowerupLabel = "";
  private powerupTokenRadius = 0;
  private forcePerfectHits = false;
  private autoHitActive = false;

  private powerupSpawnTimer?: Phaser.Time.TimerEvent;
  private backgroundDriftTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super("ReflexRingGame");
  }

  preload(): void {
    this.load.svg("arrow", "/assets/reflex-ring/arrow.svg");
    this.load.svg("ring", "/assets/reflex-ring/ring.svg");
    this.load.svg("bg-block", "/assets/reflex-ring/bg-block.svg");
    this.load.svg("bg-rune", "/assets/reflex-ring/bg-rune.svg");
    this.load.svg("bg-sparkle", "/assets/reflex-ring/bg-sparkle.svg");
  }

  create(): void {
    const { width, height } = this.scale;
    this.centerX = Math.floor(width / 2);
    this.centerY = Math.floor(height / 2);
    this.radius = Math.floor(Math.min(width, height) * 0.35);

    this.gameOver = false;
    this.currentAngle = 0;
    this.angularVelocity = this.baseAngularVelocity;
    this.maxSpeed = this.baseMaxSpeed;
    this.segmentWidth = this.baseSegmentWidth;
    this.forcePerfectHits = false;
    this.autoHitActive = false;
    this.currentPowerupLabel = "";
    this.activePowerupType = null;
    this.pendingPowerupType = null;
    this.powerupToken?.destroy(true);
    this.powerupToken = undefined;
    this.powerupStatusText?.destroy();
    this.powerupStatusText = undefined;

    this.createBackground(width, height);
    this.createRing();
    this.createArrow();
    this.createUi(height);

    this.pickNewTargetAngle(this.currentAngle);

    this.powerupSpawnTimer = this.time.addEvent({
      delay: Phaser.Math.Between(4000, 7000),
      loop: true,
      callback: () => {
        if (!this.gameOver && !this.powerupActive && !this.powerupToken) {
          this.spawnPowerup();
        }
      },
    });

    this.input.on("pointerdown", this.handleTap, this);
    this.attachDomPointerHandler();
    trackGameStart("reflex-ring", "Reflex Ring");

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.backgroundDriftTimer?.remove();
      this.powerupSpawnTimer?.remove();
      this.powerupTimer?.remove();
      if (this.parentEl && this.domPointerHandler) {
        this.parentEl.removeEventListener("pointerdown", this.domPointerHandler);
      }
      this.domPointerHandler = undefined;
      this.parentEl = null;
    });
  }

  update(_time: number, delta: number): void {
    if (this.gameOver) {
      this.arrowContainer.rotation = this.currentAngle;
      return;
    }

    const dt = delta / 1000;
    this.currentAngle = Phaser.Math.Angle.Wrap(this.currentAngle + this.angularVelocity * dt);
    this.arrowContainer.rotation = this.currentAngle;

    const wasInWedge = this.inWedgePrev;
    const inWedgeNow = this.isWithinWedge(this.currentAngle, this.targetAngle, this.segmentWidth);
    if (!wasInWedge && inWedgeNow) {
      this.tappedThisWedge = false;
    }
    if (wasInWedge && !inWedgeNow && !this.tappedThisWedge) {
      if (this.autoHitActive) {
        const perfect =
          this.forcePerfectHits || this.isPerfectHit(this.currentAngle, this.targetAngle);
        this.registerHit(perfect, perfect);
      } else {
        this.onGameOver();
      }
    }
    this.inWedgePrev = inWedgeNow;

    if (!this.powerupActive && this.powerupToken && this.pendingPowerupType) {
      const tip = this.getArrowTipPosition();
      const dx = tip.x - this.powerupToken.x;
      const dy = tip.y - this.powerupToken.y;
      const distanceSq = dx * dx + dy * dy;
      const threshold = (this.powerupTokenRadius + 24) ** 2;
      if (distanceSq <= threshold) {
        this.activatePowerup(this.pendingPowerupType);
      }
    }

    if (
      this.powerupActive &&
      this.powerupTimer &&
      this.powerupStatusText &&
      this.activePowerupType
    ) {
      const remaining = Math.max(0, this.powerupTimer.getRemainingSeconds());
      this.powerupStatusText.setText(`${this.currentPowerupLabel} ${remaining.toFixed(1)}s`);
    }
  }

  private createBackground(width: number, height: number): void {
    this.bgSprites.forEach((sprite) => sprite.destroy());
    this.bgSprites = [];

    const pushSprite = (
      key: string,
      count: number,
      alpha: number,
      depth: number,
      scaleRange: [number, number]
    ) => {
      for (let i = 0; i < count; i++) {
        const sprite = this.add.sprite(
          Phaser.Math.Between(0, width),
          Phaser.Math.Between(0, height),
          key
        );
        sprite.setAlpha(alpha);
        // Keep minimal scaling for variety - these are small 32x32 SVGs
        sprite.setScale(Phaser.Math.FloatBetween(scaleRange[0], scaleRange[1]));
        sprite.setDepth(depth);
        this.bgSprites.push(sprite);
      }
    };

    pushSprite("bg-block", 8, 0.18, -10, [1.0, 1.5]);
    pushSprite("bg-rune", 6, 0.13, -9, [1.0, 1.5]);
    pushSprite("bg-sparkle", 10, 0.09, -8, [1.0, 1.5]);

    this.backgroundDriftTimer?.remove();
    this.backgroundDriftTimer = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        const now = this.time.now;
        this.bgSprites.forEach((sprite, idx) => {
          sprite.x += Math.sin(now / 800 + idx) * 0.2;
          sprite.y += Math.cos(now / 1000 + idx) * 0.2;
          if (sprite.x < -20) sprite.x = width + 20;
          if (sprite.x > width + 20) sprite.x = -20;
          if (sprite.y < -20) sprite.y = height + 20;
          if (sprite.y > height + 20) sprite.y = -20;
        });
      },
    });
  }

  private createRing(): void {
    if (this.ringSprite) this.ringSprite.destroy();
    this.ringSprite = this.add.sprite(this.centerX, this.centerY, "ring");
    // No scaling needed - SVG is pre-sized
    this.ringSprite.setDepth(1);
  }

  private createArrow(): void {
    if (this.arrowContainer) this.arrowContainer.destroy();
    this.arrowContainer = this.add.container(this.centerX, this.centerY).setDepth(3);

    const tailOriginX = 20 / 159; // tail position in the new SVG dimensions

    // No scaling needed - SVG is pre-sized
    this.arrowShadow = this.add
      .sprite(0, 0, "arrow")
      .setOrigin(tailOriginX, 0.5)
      .setAlpha(0.32)
      .setTint(0x000000);
    this.arrowShadow.setPosition(5, 3);

    this.arrowSprite = this.add.sprite(0, 0, "arrow").setOrigin(tailOriginX, 0.5);

    this.arrowContainer.add([this.arrowShadow, this.arrowSprite]);
    this.arrowContainer.setScale(1);
  }

  private createUi(canvasHeight: number): void {
    this.wedgeGraphics?.destroy();
    this.wedgeGraphics = this.add.graphics().setDepth(2);

    this.best = Number(localStorage.getItem("reflex-ring-best") || 0);
    this.scoreText?.destroy();
    this.scoreText = this.add
      .text(this.centerX, 24, this.makeScoreText(), {
        fontFamily: "Fredoka, Arial Black, Arial, sans-serif",
        fontSize: "28px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 6,
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setDepth(5);

    this.add
      .text(this.centerX, canvasHeight - 50, "Tap anywhere when the arrow hits the highlight", {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#3f3f3f",
        align: "center",
      })
      .setOrigin(0.5, 1)
      .setDepth(4);
  }

  private attachDomPointerHandler(): void {
    this.parentEl = this.game.canvas.parentElement as HTMLElement | null;
    this.domPointerHandler = (ev: PointerEvent) => {
      if (ev.target instanceof HTMLCanvasElement) return;
      if (this.gameOver) return;
      this.handleTap();
    };
    if (this.parentEl && this.domPointerHandler) {
      this.parentEl.addEventListener("pointerdown", this.domPointerHandler, { passive: true });
    }
  }

  private spawnPowerup(): void {
    const type = POWERUP_TYPES[Phaser.Math.Between(0, POWERUP_TYPES.length - 1)];
    const config = POWERUP_CONFIG[type];
    const angle = Phaser.Math.FloatBetween(0, Phaser.Math.PI2);
    const r = this.radius * 0.85;
    const x = this.centerX + Math.cos(angle) * r;
    const y = this.centerY + Math.sin(angle) * r;

    const container = this.add.container(x, y).setDepth(10).setAlpha(0);
    const radius = this.radius * 0.18;
    const circle = this.add.circle(0, 0, radius, config.circleColor, 0.92);
    circle.setStrokeStyle(6, 0xffffff, 0.95);
    const label = this.add
      .text(0, 2, config.short, {
        fontFamily: "Fredoka, Arial Black, Arial, sans-serif",
        fontSize: `${Math.round(radius * 0.5)}px`, // Reduced from 0.8 to 0.5
        color: config.textColor,
        fontStyle: "bold",
        align: "center",
      })
      .setOrigin(0.5);
    container.add([circle, label]);

    this.tweens.add({ targets: container, alpha: 1, duration: 220, ease: "Cubic.Out" });

    this.pendingPowerupType = type;
    this.powerupToken = container;
    this.powerupTokenRadius = radius;

    this.time.delayedCall(config.duration + 2000, () => {
      if (this.powerupToken && !this.powerupActive && this.pendingPowerupType === type) {
        this.tweens.add({
          targets: this.powerupToken,
          alpha: 0,
          duration: 180,
          onComplete: () => {
            this.powerupToken?.destroy(true);
            this.powerupToken = undefined;
            this.pendingPowerupType = null;
          },
        });
      }
    });
  }

  private activatePowerup(type: PowerupType): void {
    if (this.powerupActive) return;
    this.powerupActive = true;
    this.activePowerupType = type;
    this.pendingPowerupType = null;

    this.powerupToken?.destroy(true);
    this.powerupToken = undefined;
    this.powerupTokenRadius = 0;

    switch (type) {
      case "slow-time":
        this.savedAngularVelocity = this.angularVelocity;
        this.savedMaxSpeed = this.maxSpeed;
        this.angularVelocity *= 0.75;
        this.maxSpeed *= 0.75;
        break;
      case "wide-wedge":
        this.segmentWidth = this.baseSegmentWidth * 2;
        this.drawWedge(this.targetAngle);
        break;
      case "perfect-touch":
        this.forcePerfectHits = true;
        break;
      case "auto-hit":
        this.autoHitActive = true;
        break;
    }

    const { banner, textColor, duration } = POWERUP_CONFIG[type];
    this.showPowerupStatus(banner, textColor);

    this.powerupTimer?.remove();
    this.powerupTimer = this.time.delayedCall(duration, () => this.expirePowerup());
  }

  private expirePowerup(): void {
    if (!this.powerupActive) {
      this.fadeOutPowerupStatus();
      return;
    }

    if (this.activePowerupType) {
      this.revertPowerupEffects(this.activePowerupType);
    }

    this.powerupActive = false;
    this.activePowerupType = null;

    this.powerupTimer?.remove();
    this.powerupTimer = null;

    this.fadeOutPowerupStatus();
  }

  private revertPowerupEffects(type: PowerupType): void {
    switch (type) {
      case "slow-time":
        if (this.savedAngularVelocity !== null) {
          this.angularVelocity = this.savedAngularVelocity;
        } else {
          this.angularVelocity = Math.sign(this.angularVelocity || 1) * this.baseAngularVelocity;
        }
        if (this.savedMaxSpeed !== null) {
          this.maxSpeed = this.savedMaxSpeed;
        } else {
          this.maxSpeed = this.baseMaxSpeed;
        }
        break;
      case "wide-wedge":
        this.segmentWidth = this.baseSegmentWidth;
        this.drawWedge(this.targetAngle);
        break;
      case "perfect-touch":
        this.forcePerfectHits = false;
        break;
      case "auto-hit":
        this.autoHitActive = false;
        break;
    }

    this.savedAngularVelocity = null;
    this.savedMaxSpeed = null;
  }

  private showPowerupStatus(message: string, color: string): void {
    this.powerupStatusText?.destroy();
    this.currentPowerupLabel = message;
    this.powerupStatusText = this.add
      .text(this.centerX, this.centerY - this.radius - 34, `${message}`, {
        fontFamily: "Fredoka, Arial Black, Arial, sans-serif",
        fontSize: "24px",
        color,
        stroke: "#0f172a",
        strokeThickness: 5,
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(15);
  }

  private fadeOutPowerupStatus(delay = 0): void {
    if (!this.powerupStatusText) return;
    this.tweens.add({
      targets: this.powerupStatusText,
      alpha: 0,
      delay,
      duration: 220,
      onComplete: () => {
        this.powerupStatusText?.destroy();
        this.powerupStatusText = undefined;
        this.currentPowerupLabel = "";
      },
    });
  }

  private drawWedge(angle: number): void {
    this.wedgeGraphics.clear();
    this.wedgeGraphics.fillStyle(this.wedgeColor, 0.85);
    const start = angle - this.segmentWidth / 2;
    const end = angle + this.segmentWidth / 2;
    this.wedgeGraphics.slice(this.centerX, this.centerY, this.radius, start, end, true);
    this.wedgeGraphics.fillPath();
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

  private handleTap = (): void => {
    if (this.gameOver) return;

    const within = this.isWithinWedge(this.currentAngle, this.targetAngle, this.segmentWidth);
    if (within) {
      const isPerfect =
        this.forcePerfectHits || this.isPerfectHit(this.currentAngle, this.targetAngle);
      this.registerHit(isPerfect, isPerfect);
    } else {
      this.onGameOver();
    }
  };

  private registerHit(isPerfect: boolean, showPerfectPopup: boolean): void {
    this.score += isPerfect ? 2 : 1;
    this.scoreText.setText(this.makeScoreText());

    const speed = Math.abs(this.angularVelocity);
    const next = Math.min(speed * 1.03, this.maxSpeed);
    this.angularVelocity = -Math.sign(this.angularVelocity || 1) * next;

    this.tweens.add({
      targets: this.wedgeGraphics,
      alpha: { from: 0.6, to: 1 },
      duration: 90,
      yoyo: true,
    });

    this.hitPulseTween?.stop();
    this.arrowContainer.setScale(1);
    this.hitPulseTween = this.tweens.add({
      targets: this.arrowContainer,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 80,
      yoyo: true,
      ease: "Sine.Out",
      onComplete: () => {
        this.arrowContainer.setScale(1);
        this.hitPulseTween = undefined;
      },
    });

    if (showPerfectPopup && isPerfect) {
      const tip = this.getArrowTipPosition();
      this.showPerfectPopup(tip.x, tip.y);
    }

    this.tappedThisWedge = true;
    this.pickNewTargetAngle(this.targetAngle);
  }

  private onGameOver(): void {
    if (this.gameOver) return;
    this.gameOver = true;
    this.input.off("pointerdown", this.handleTap, this);
    if (this.powerupActive) {
      this.expirePowerup();
    } else {
      this.fadeOutPowerupStatus();
    }

    this.cameras.main.shake(250, 0.012);
    this.cameras.main.flash(120, 255, 50, 50);

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
        stroke: "#000000",
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
      this.resetGameState();
      this.input.on("pointerdown", this.handleTap, this);
      this.input.off("pointerdown", restart);
      trackGameStart("reflex-ring", "Reflex Ring");
    };

    // Delay dispatching the game-over event slightly so the in-game "Game Over"
    // animations (shake/flash) complete and any overlays in the React UI don't
    // immediately navigate away from the running scene.
    const GAME_OVER_DISPATCH_DELAY = 900; // ms
    try {
      this.time.delayedCall(GAME_OVER_DISPATCH_DELAY, () => {
        try {
          dispatchGameOver({ gameId: "reflex-ring", score: this.score, ts: Date.now() });
        } catch {
          // ignore dispatch errors to keep the game responsive
        }
      });
    } catch {
      // ignore scheduling errors
    }

    this.time.delayedCall(900, () => {
      this.input.once("pointerdown", restart);
    });
  }

  private resetGameState(): void {
    this.score = 0;
    this.scoreText.setText(this.makeScoreText());
    this.currentAngle = 0;
    this.angularVelocity = this.baseAngularVelocity;
    this.maxSpeed = this.baseMaxSpeed;
    this.savedAngularVelocity = null;
    this.savedMaxSpeed = null;
    this.segmentWidth = this.baseSegmentWidth;
    this.forcePerfectHits = false;
    this.autoHitActive = false;
    this.activePowerupType = null;
    this.pendingPowerupType = null;
    this.powerupActive = false;
    this.powerupTimer?.remove();
    this.powerupTimer = null;
    this.powerupToken?.destroy(true);
    this.powerupToken = undefined;
    this.powerupTokenRadius = 0;
    this.powerupStatusText?.destroy();
    this.powerupStatusText = undefined;
    this.currentPowerupLabel = "";
    this.hitPulseTween?.stop();
    this.hitPulseTween = undefined;
    this.arrowContainer.setScale(1);
    this.tappedThisWedge = false;
    this.inWedgePrev = false;
    this.gameOver = false;
    this.pickNewTargetAngle(this.currentAngle);
  }

  private isWithinWedge(angle: number, wedgeCenter: number, wedgeWidth: number): boolean {
    const diff = Phaser.Math.Angle.Wrap(angle - wedgeCenter);
    return Math.abs(diff) <= (wedgeWidth * 1.2) / 2;
  }

  private isPerfectHit(angle: number, wedgeCenter: number): boolean {
    const diff = Math.abs(Phaser.Math.Angle.Wrap(angle - wedgeCenter));
    const perfectWindow = this.segmentWidth * PERFECT_WINDOW_RATIO;
    return diff <= perfectWindow / 2;
  }

  private getArrowTipPosition(): { x: number; y: number } {
    const tipRadius = this.radius - 12;
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
      .setDepth(20)
      .setAlpha(0.95);

    this.tweens.add({
      targets: txt,
      y: y - 26,
      alpha: 0,
      duration: 520,
      ease: "Cubic.In",
      onComplete: () => txt.destroy(),
    });
  }

  private pickNewTargetAngle(avoidNear: number): void {
    const minSep = Phaser.Math.DegToRad(MIN_TARGET_SEPARATION_DEG);
    const maxSep = Phaser.Math.DegToRad(Math.min(MAX_TARGET_SEPARATION_DEG, 180));

    let candidate = Phaser.Math.FloatBetween(0, Phaser.Math.PI2);
    let tries = 0;
    while (tries++ < 60) {
      const delta = Math.abs(Phaser.Math.Angle.Wrap(candidate - avoidNear));
      if (delta >= minSep && delta <= maxSep) break;
      candidate = Phaser.Math.FloatBetween(0, Phaser.Math.PI2);
    }

    this.targetAngle = candidate;
    this.wedgeColor = this.wedgePalette[Phaser.Math.Between(0, this.wedgePalette.length - 1)];
    this.drawWedge(this.targetAngle);
    this.inWedgePrev = false;
    this.tappedThisWedge = false;
  }

  private makeScoreText(): string {
    return `Score: ${this.score}   Best: ${this.best}`;
  }
}
