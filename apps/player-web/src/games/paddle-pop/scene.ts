import Phaser from "phaser";
import { dispatchGameOver } from "../../utils/gameEvents";

// Config constants
const PLAY_WIDTH = 540;
const PLAY_HEIGHT = 960;
const PADDLE_WIDTH = 120; // ~75% of previous
const PADDLE_HEIGHT = 24;
const PADDLE_Y = 840; // higher above buttons
const BALL_RADIUS = 14;
const BALL_BASE_SPEED = 420; // base speed
const BALL_MAX_SPEED = 850; // cap speed
const SPEED_INCREASE_INTERVAL = 8000; // ms
const SPEED_INCREASE_AMOUNT = 20; // added each interval
const POWERUP_DURATION_MS = 10000; // configurable length
const BONUS_SPAWN_INTERVAL = 6000; // ms between spawns (more frequent)
const BONUS_LIFETIME = 5000; // ms visible

// Types
interface ActivePowerUps {
  slow?: number; // timestamp when expires
  big?: number; // timestamp when expires
}

// removed old BonusType union; values now 1..10

export default class PaddlePopScene extends Phaser.Scene {
  private paddle!: Phaser.Physics.Arcade.Image;
  private ball!: Phaser.Physics.Arcade.Image;
  private scoreText!: Phaser.GameObjects.Text;

  private score: number = 0;
  private activePowerUps: ActivePowerUps = {};
  private lastSpeedInc: number = 0;
  private lastBonusSpawn: number = 0;
  private movingLeft = false;
  private movingRight = false;
  private lastObstacleSpawn = 0;
  private ballSpeedScale = 1; // affected by slow power-up
  private lastPowerSpawn = 0;
  private gameActive = false;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private activePowerupVisual?: Phaser.GameObjects.GameObject; // ensure only one power-up on screen
  private ended = false;
  private bottomFlames?: any;
  private bonusCount = 0;
  private fireballInterval = 4000; // starts at 4s, decreases over time

  constructor() {
    super("PaddlePop");
  }

  preload() {
    this.createArrowTexture("uiLeft", true);
    this.createArrowTexture("uiRight", false);
  }

  create() {
    this.createBackground();
    this.createBorder();
    this.createUI();
    this.createPaddle();
    this.createBall();
    this.createControls();
    this.createBottomFlames();
    this.cursors = this.input.keyboard!.createCursorKeys();
    // this.obstacles = this.physics.add.group();

    // Collisions
    this.physics.add.collider(
      this.ball,
      this.paddle as any,
      this.onBallPaddleHit as any,
      undefined,
      this
    );
    this.physics.world.setBoundsCollision(true, true, true, false); // no bottom bound (miss condition)

    // Countdown start
    this.startCountdown().then(() => {
      this.gameActive = true;
      this.launchBall();
    });
  }

  private createBackground() {
    const g = this.add.graphics();
    g.fillStyle(0x1f2937, 1);
    g.fillRect(0, 0, PLAY_WIDTH, PLAY_HEIGHT);
    // subtle pattern
    g.lineStyle(1, 0x243041, 0.4);
    for (let y = 0; y < PLAY_HEIGHT; y += 48) {
      for (let x = 0; x < PLAY_WIDTH; x += 48) {
        g.strokeRect(x + 8, y + 8, 32, 32);
      }
    }
  }

  private createBorder() {
    const g = this.add.graphics();
    g.lineStyle(10, 0x243041, 0.9);
    // Top
    g.beginPath();
    g.moveTo(5, 5);
    g.lineTo(PLAY_WIDTH - 5, 5);
    g.strokePath();
    // Left
    g.beginPath();
    g.moveTo(5, 5);
    g.lineTo(5, PLAY_HEIGHT - 5);
    g.strokePath();
    // Right
    g.beginPath();
    g.moveTo(PLAY_WIDTH - 5, 5);
    g.lineTo(PLAY_WIDTH - 5, PLAY_HEIGHT - 5);
    g.strokePath();
  }

  private createUI() {
    this.scoreText = this.add
      .text(270, 930, "Score: 0", {
        fontFamily: "Fredoka, sans-serif",
        fontSize: "28px",
        color: "#ffffff",
      })
      .setOrigin(0.5, 1);
  }

  private createPaddle() {
    // Create a rounded glossy paddle texture
    const key = "paddleTex";
    if (!this.textures.exists(key)) {
      const g = this.add.graphics();
      const w = PADDLE_WIDTH,
        h = PADDLE_HEIGHT,
        r = 12;
      g.fillStyle(0x2563eb, 1);
      g.fillRoundedRect(0, 0, w, h, r);
      // highlight stripe
      g.fillStyle(0x60a5fa, 0.6);
      g.fillRoundedRect(6, 4, w - 12, h / 3, r / 2);
      // subtle inner shadow
      g.lineStyle(2, 0x1e3a8a, 0.8);
      g.strokeRoundedRect(1, 1, w - 2, h - 2, r);
      g.generateTexture(key, w, h);
      g.destroy();
    }
    this.paddle = this.physics.add.image(PLAY_WIDTH / 2, PADDLE_Y, key);
    this.paddle.setImmovable(true);
    this.paddle.setPushable(false);
    this.paddle.setCollideWorldBounds(true);
    (this.paddle.body as Phaser.Physics.Arcade.Body).allowGravity = false;
  }

  private createBall() {
    const g = this.add.graphics();
    g.fillStyle(0x9ca3af, 1);
    g.fillCircle(BALL_RADIUS, BALL_RADIUS, BALL_RADIUS);
    g.lineStyle(2, 0xffffff, 0.6);
    g.strokeCircle(BALL_RADIUS, BALL_RADIUS, BALL_RADIUS - 2);
    g.generateTexture("marble", BALL_RADIUS * 2 + 2, BALL_RADIUS * 2 + 2);
    g.destroy();
    this.ball = this.physics.add
      .image(PLAY_WIDTH / 2, PADDLE_Y - 60, "marble")
      .setCircle(BALL_RADIUS);
    this.ball.setBounce(1, 1);
    this.ball.setCollideWorldBounds(true);
  }

  private createControls() {
    const { width, height } = this.scale;

    // Visual button indicators
    const makeBtn = (x: number, y: number, key: string) => {
      const c = this.add.container(x, y).setDepth(30);
      const bg = this.add.circle(0, 0, 44, 0xffffff, 0.12).setStrokeStyle(3, 0xffffff, 0.6);
      const icon = this.add.image(0, 0, key).setScale(0.5).setTint(0xffffff).setAlpha(0.9);
      c.add([bg, icon]);
      return c;
    };

    const pad = 60;
    const leftBtn = makeBtn(pad, height - pad, "uiLeft");
    const rightBtn = makeBtn(width - pad, height - pad, "uiRight");

    // Large invisible tap zones covering left and right halves of screen
    const leftZone = this.add
      .zone(0, 0, width / 2, height)
      .setOrigin(0, 0)
      .setDepth(5)
      .setInteractive();
    const rightZone = this.add
      .zone(width / 2, 0, width / 2, height)
      .setOrigin(0, 0)
      .setDepth(5)
      .setInteractive();

    // Left zone controls
    leftZone.on("pointerdown", () => {
      if (this.gameActive) {
        this.movingLeft = true;
        (leftBtn.list[0] as Phaser.GameObjects.Arc).setFillStyle(0xffffff, 0.25);
      }
    });
    leftZone.on("pointerup", () => {
      this.movingLeft = false;
      (leftBtn.list[0] as Phaser.GameObjects.Arc).setFillStyle(0xffffff, 0.12);
    });
    leftZone.on("pointerout", () => {
      this.movingLeft = false;
      (leftBtn.list[0] as Phaser.GameObjects.Arc).setFillStyle(0xffffff, 0.12);
    });

    // Right zone controls
    rightZone.on("pointerdown", () => {
      if (this.gameActive) {
        this.movingRight = true;
        (rightBtn.list[0] as Phaser.GameObjects.Arc).setFillStyle(0xffffff, 0.25);
      }
    });
    rightZone.on("pointerup", () => {
      this.movingRight = false;
      (rightBtn.list[0] as Phaser.GameObjects.Arc).setFillStyle(0xffffff, 0.12);
    });
    rightZone.on("pointerout", () => {
      this.movingRight = false;
      (rightBtn.list[0] as Phaser.GameObjects.Arc).setFillStyle(0xffffff, 0.12);
    });

    // Global pointerup to ensure flags are reset
    this.input.on("pointerup", () => {
      this.movingLeft = false;
      this.movingRight = false;
    });
  }

  private movePaddle(dir: number, dt: number) {
    const speed = 520;
    const half = this.paddle.displayWidth / 2;
    this.paddle.x = Phaser.Math.Clamp(this.paddle.x + dir * speed * dt, half, PLAY_WIDTH - half);
  }

  private launchBall() {
    const angle = Phaser.Math.FloatBetween(-Math.PI / 3, (-2 * Math.PI) / 3); // upward random
    const vx = Math.cos(angle) * BALL_BASE_SPEED;
    const vy = Math.sin(angle) * BALL_BASE_SPEED;
    this.ball.setVelocity(vx, vy);
  }

  private startCountdown(): Promise<void> {
    return new Promise((resolve) => {
      const seq = ["3", "2", "1", "GO!"];
      let idx = 0;
      const text = this.add
        .text(PLAY_WIDTH / 2, PLAY_HEIGHT / 2, seq[idx], {
          fontFamily: "Fredoka, sans-serif",
          fontSize: "72px",
          color: "#ffffff",
        })
        .setOrigin(0.5);
      const ev = this.time.addEvent({
        delay: 800,
        repeat: seq.length - 1,
        callback: () => {
          if (!text.active) {
            ev.remove();
            return;
          }
          idx++;
          text.setText(seq[idx]);
          if (idx === seq.length - 1) {
            this.time.delayedCall(500, () => {
              if (text.active) text.destroy();
              resolve();
            });
          }
        },
      });
    });
  }

  private onBallPaddleHit = (ballObj: any, paddleObj: any) => {
    const ball = ballObj as Phaser.Physics.Arcade.Image;
    const paddle = paddleObj as Phaser.Physics.Arcade.Image;
    const relative = (ball.x - paddle.x) / (paddle.displayWidth / 2); // -1..1
    const speed = (ball.body!.velocity as Phaser.Math.Vector2).length();
    const angle = Phaser.Math.DegToRad(270 + relative * 60); // vary rebound angle
    const newVx = Math.cos(angle) * speed;
    const newVy = Math.sin(angle) * speed;
    ball.setVelocity(newVx, newVy);
    // Increment score
    this.score += 1;
    this.scoreText.setText(`Score: ${this.score}`);
  };

  update(time: number, delta: number): void {
    const dt = delta / 1000;
    // Gate gameplay until GO!
    if (this.gameActive) {
      // keyboard + touch
      const leftKey = this.cursors?.left?.isDown;
      const rightKey = this.cursors?.right?.isDown;
      const left = !!leftKey || this.movingLeft;
      const right = !!rightKey || this.movingRight;
      if (left && !right) this.movePaddle(-1, dt);
      else if (right && !left) this.movePaddle(1, dt);
    }

    // Speed increase over time
    if (this.gameActive && time - this.lastSpeedInc > SPEED_INCREASE_INTERVAL) {
      this.lastSpeedInc = time;
      const v = this.ball.body!.velocity;
      const currentSpeed = v.length();
      const target = Math.min(currentSpeed + SPEED_INCREASE_AMOUNT, BALL_MAX_SPEED);
      const factor = target / currentSpeed;
      this.ball.setVelocity(v.x * factor, v.y * factor);
    }

    // Keep ball speed consistent (respect power-up scale)
    if (this.gameActive && this.ball.body) {
      const v = this.ball.body.velocity;
      const current = v.length();
      const base = Phaser.Math.Clamp(current, BALL_BASE_SPEED * 0.6, BALL_MAX_SPEED);
      const desired = Phaser.Math.Clamp(
        base * this.ballSpeedScale,
        BALL_BASE_SPEED * 0.5,
        BALL_MAX_SPEED
      );
      const f = desired / (current || desired);
      this.ball.setVelocity(v.x * f, v.y * f);
    }

    // Ball fell off bottom -> end game (no auto-restart)
    if (this.gameActive && this.ball.y > PLAY_HEIGHT) {
      this.endGame();
      return;
    }

    // Power-up expiration visuals (placeholder)
    const now = time;
    if (this.activePowerUps.slow && now > this.activePowerUps.slow) {
      this.activePowerUps.slow = undefined;
      this.ball.clearTint();
      this.ballSpeedScale = 1;
    }
    if (this.activePowerUps.big && now > this.activePowerUps.big) {
      this.activePowerUps.big = undefined;
      this.resetPaddleSize();
    }

    // Spawn bonus discs
    if (time - this.lastBonusSpawn > BONUS_SPAWN_INTERVAL) {
      this.lastBonusSpawn = time;
      const numToSpawn = Math.random() < 0.4 ? 2 : 1; // sometimes 2
      for (let i = 0; i < numToSpawn && this.bonusCount < 3; i++) {
        this.spawnBonus();
      }
    } // Spawn obstacles occasionally
    if (time - this.lastObstacleSpawn > this.fireballInterval) {
      this.lastObstacleSpawn = time;
      this.spawnObstacle();
      // Ramp frequency: decrease interval every 10s
      if (time % 10000 < 100) {
        // roughly every 10s
        this.fireballInterval = Math.max(2000, this.fireballInterval - 200);
      }
    }

    // Spawn power-ups periodically
    // Power-ups: infrequent and at most one on screen
    if (this.gameActive && time - this.lastPowerSpawn > 5000) {
      this.lastPowerSpawn = time;
      if (!this.activePowerupVisual || !this.activePowerupVisual.active) {
        if (Math.random() < 0.35) {
          // most of the time none
          const kind = Math.random() < 0.5 ? ("slow" as const) : ("big" as const);
          const x = Phaser.Math.Between(60, PLAY_WIDTH - 60);
          const y = Phaser.Math.Between(220, 520);
          this.spawnPowerUpAt(x, y, kind);
        }
      }
    }
  }

  private spawnBonus() {
    const value = Phaser.Math.Between(1, 10) as number;
    const color = this.colorForValue(value);
    // Create a textured disc and physics body so the ball bounces off
    const texKey = `bonus-${value}`;
    if (!this.textures.exists(texKey)) {
      const g = this.add.graphics();
      g.fillStyle(color, 0.95);
      g.fillCircle(26, 26, 26);
      g.lineStyle(3, 0xffffff, 0.85);
      g.strokeCircle(26, 26, 26);
      g.generateTexture(texKey, 52, 52);
      g.destroy();
    }
    const bx = Phaser.Math.Between(60, PLAY_WIDTH - 60);
    const by = Phaser.Math.Between(140, 720);
    const bonus = this.physics.add.image(bx, by, texKey);
    bonus.setImmovable(true);
    (bonus.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    bonus.setCircle(26, 0, 0);
    const label = this.add
      .text(bx, by, `+${value}`, {
        fontFamily: "Fredoka, sans-serif",
        fontSize: "24px",
        color: "#000",
      })
      .setOrigin(0.5);
    // grow-in animation
    bonus.setScale(0);
    label.setScale(0);
    this.tweens.add({ targets: [bonus, label], scale: 1, duration: 250, ease: "Back.Out" });
    this.bonusCount++;

    // Countdown ring
    const ring = this.add.graphics();
    const start = this.time.now;
    const drawRing = () => {
      const t = (this.time.now - start) / BONUS_LIFETIME;
      ring.clear();
      ring.lineStyle(4, 0xffffff, 0.8);
      ring.beginPath();
      ring.arc(bonus.x, bonus.y, 32, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - t), false);
      ring.strokePath();
      if (t < 1) requestAnimationFrame(drawRing);
    };
    drawRing();

    // Collider so ball bounces off and scores, but bonus persists
    bonus.setData("lastScore", 0);
    this.physics.add.collider(this.ball, bonus, () => {
      if (!bonus.active) return;
      const last = bonus.getData("lastScore") as number;
      if (this.time.now - last > 300) {
        bonus.setData("lastScore", this.time.now);
        this.score += value;
        this.scoreText.setText(`Score: ${this.score}`);
        this.cameras.main.shake(70, 0.008);
      }
    });

    // Lifetime
    this.time.delayedCall(BONUS_LIFETIME, () => {
      if (bonus.active) {
        // small explosion
        const explode = this.add.particles(bonus.x, bonus.y, "marble", {
          speed: { min: 80, max: 160 },
          scale: { start: 0.4, end: 0 },
          lifespan: 400,
          quantity: 12,
          blendMode: "ADD",
        });
        this.time.delayedCall(450, () => explode.destroy());
        bonus.destroy();
        label.destroy();
        ring.destroy();
        this.bonusCount = Math.max(0, this.bonusCount - 1);
      }
    });
  }

  private colorForValue(v: number): number {
    // map values 1..10 across a hue range for distinct colors
    const hue = Phaser.Math.Linear(20, 300, (v - 1) / 9); // warm to cool
    const sat = 0.75,
      light = 0.55;
    const col = Phaser.Display.Color.HSLToColor(hue / 360, sat, light).color;
    return col;
  }

  // (removed unused placeholder spawnPowerUp method)

  private resetPaddleSize() {
    this.paddle.setScale(1, 1);
  }

  private spawnObstacle() {
    // Create fireball texture if missing
    const key = "fireball";
    if (!this.textures.exists(key)) {
      const g = this.add.graphics();
      g.clear();
      // Layered circles to simulate glow
      g.fillStyle(0xff4500, 0.8);
      g.fillCircle(20, 20, 20);
      g.fillStyle(0xff7a00, 0.9);
      g.fillCircle(20, 20, 14);
      g.fillStyle(0xffe066, 1.0);
      g.fillCircle(20, 20, 8);
      g.generateTexture(key, 40, 40);
      g.destroy();
    }
    const x = Phaser.Math.Between(60, PLAY_WIDTH - 60);
    const sprite = this.physics.add.image(x, -30, key).setBlendMode(Phaser.BlendModes.ADD);
    sprite.setScale(1);
    const vx =
      Phaser.Math.Between(0, 1) === 0
        ? Phaser.Math.Between(-120, -60)
        : Phaser.Math.Between(60, 120);
    const vy = Phaser.Math.Between(180, 280);
    sprite.setVelocity(vx, vy);
    sprite.setAngularVelocity(Phaser.Math.Between(-120, 120));
    (sprite.body as Phaser.Physics.Arcade.Body).allowGravity = false;

    // Flame trail
    const trailKey = "flameDot";
    if (!this.textures.exists(trailKey)) {
      const g2 = this.add.graphics();
      g2.fillStyle(0xffffff, 1);
      g2.fillCircle(2, 2, 2);
      g2.generateTexture(trailKey, 4, 4);
      g2.destroy();
    }
    const emitter = this.add.particles(0, 0, trailKey, {
      speed: { min: 50, max: 120 },
      lifespan: { min: 200, max: 500 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.9, end: 0 },
      follow: sprite,
      tint: [0xffe066, 0xffa200, 0xff4500],
      blendMode: "ADD",
      frequency: 30,
      angle: { min: 210, max: 330 },
    });

    this.physics.add.collider(sprite, this.paddle as any, () => {
      // Freeze player control and ball
      this.gameActive = false;
      this.movingLeft = false;
      this.movingRight = false;
      this.ball.setVelocity(0, 0);
      (this.ball.body as Phaser.Physics.Arcade.Body).enable = false;
      // Explosion and delayed end game so player can see it
      const explode = this.add.particles(sprite.x, sprite.y, "marble", {
        speed: { min: 120, max: 240 },
        scale: { start: 0.6, end: 0 },
        lifespan: 500,
        quantity: 16,
        tint: [0xffe066, 0xff7a00, 0xff4500],
        blendMode: "ADD",
      });
      this.time.delayedCall(500, () => explode.destroy());
      sprite.destroy();
      this.time.delayedCall(550, () => this.endGame());
    });

    this.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        if (sprite.y > PLAY_HEIGHT + 60) {
          sprite.destroy();
          emitter.destroy();
        }
      },
    });
  }

  // Power-up API: spawn and apply effects
  private spawnPowerUpAt(x: number, y: number, kind: "slow" | "big") {
    // Create textures once
    const iceKey = "pu-ice";
    const bigKey = "pu-big";
    if (!this.textures.exists(iceKey)) {
      const gg = this.add.graphics();
      // Glowing ice crystal (diamond)
      gg.fillStyle(0x93c5fd, 1);
      gg.fillPoints(
        [
          { x: 0, y: -16 },
          { x: 12, y: 0 },
          { x: 0, y: 16 },
          { x: -12, y: 0 },
        ],
        true
      );
      gg.lineStyle(2, 0xbfdbfe, 1);
      gg.strokePoints(
        [
          { x: 0, y: -16 },
          { x: 12, y: 0 },
          { x: 0, y: 16 },
          { x: -12, y: 0 },
          { x: 0, y: -16 },
        ],
        false
      );
      gg.generateTexture(iceKey, 40, 40);
      gg.destroy();
    }
    if (!this.textures.exists(bigKey)) {
      const gg2 = this.add.graphics();
      // Orange glowing bar
      gg2.fillStyle(0xf59e0b, 1);
      gg2.fillRoundedRect(0, 0, 36, 14, 6);
      gg2.lineStyle(2, 0xfdba74, 1);
      gg2.strokeRoundedRect(1, 1, 34, 12, 6);
      gg2.generateTexture(bigKey, 40, 40);
      gg2.destroy();
    }
    const key = kind === "slow" ? iceKey : bigKey;
    const sprite = this.add.image(x, y, key).setScale(1.0).setBlendMode(Phaser.BlendModes.ADD);
    this.activePowerupVisual = sprite;
    // pulse to highlight
    this.tweens.add({
      targets: sprite,
      scale: 1.15,
      yoyo: true,
      duration: 400,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    // subtle glow particles
    const glowKey = "sparkDot";
    if (!this.textures.exists(glowKey)) {
      const g2 = this.add.graphics();
      g2.fillStyle(0xffffff, 1);
      g2.fillCircle(2, 2, 2);
      g2.generateTexture(glowKey, 4, 4);
      g2.destroy();
    }
    const tint = kind === "slow" ? 0x93c5fd : 0xf59e0b;
    const emitter = this.add.particles(0, 0, glowKey, {
      follow: sprite,
      lifespan: { min: 300, max: 700 },
      speed: { min: 20, max: 60 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 1, end: 0 },
      tint,
      frequency: 90,
      blendMode: "ADD",
      quantity: 1,
    });
    // overlap polling
    const check = this.time.addEvent({
      delay: 80,
      loop: true,
      callback: () => {
        if (!sprite.active) {
          check.remove();
          return;
        }
        if (Phaser.Math.Distance.Between(this.ball.x, this.ball.y, sprite.x, sprite.y) < 24) {
          if (kind === "slow") this.applySlow();
          else this.applyBigPaddle();
          sprite.destroy();
          emitter.destroy();
          check.remove();
        }
      },
    });
    // auto-despawn quickly
    this.time.delayedCall(3500, () => {
      if (sprite.active) {
        sprite.destroy();
        emitter.destroy();
        check.remove();
      }
    });
  }

  private applySlow() {
    this.ballSpeedScale = 0.75;
    this.ball.setTint(0x60a5fa); // icy blue
    this.activePowerUps.slow = this.time.now + POWERUP_DURATION_MS;
    // sparkle trail
    const particles = this.add.particles(0, 0, "marble", {
      scale: { start: 0.3, end: 0 },
      lifespan: 300,
      frequency: 80,
      follow: this.ball,
      tint: 0x93c5fd,
      blendMode: "ADD",
    });
    this.time.delayedCall(POWERUP_DURATION_MS, () => particles.destroy());
  }

  private applyBigPaddle() {
    this.activePowerUps.big = this.time.now + POWERUP_DURATION_MS;
    this.tweens.add({
      targets: this.paddle,
      scaleX: 1.25,
      duration: 250,
      yoyo: false,
      ease: "Quad.easeOut",
    });
    // flash with alpha instead of visible
    const flash = this.time.addEvent({
      delay: 100,
      repeat: 8,
      callback: () => {
        this.paddle.setAlpha(this.paddle.alpha === 1 ? 0.3 : 1);
      },
    });
    this.time.delayedCall(POWERUP_DURATION_MS, () => {
      flash.remove();
      this.paddle.setAlpha(1);
      this.resetPaddleSize();
    });
  }

  private createBottomFlames() {
    // Particle flame wall along the bottom
    const key = "flameDot2";
    if (!this.textures.exists(key)) {
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 1);
      g.fillCircle(3, 3, 3);
      g.generateTexture(key, 6, 6);
      g.destroy();
    }
    this.bottomFlames = this.add.particles(0, PLAY_HEIGHT - 8, key, {
      x: { min: 0, max: PLAY_WIDTH },
      speedY: { min: -140, max: -80 },
      speedX: { min: -20, max: 20 },
      lifespan: { min: 400, max: 900 },
      alpha: { start: 0.9, end: 0 },
      scale: { start: 1.2, end: 0 },
      gravityY: 0,
      blendMode: "ADD",
      quantity: 8,
      frequency: 60,
      tint: [0xffe066, 0xffa200, 0xff4500],
    });
    this.bottomFlames.setDepth(9999);
  }

  private createArrowTexture(key: string, left: boolean) {
    const g = this.add.graphics({ x: 0, y: 0 });
    g.fillStyle(0xffffff, 1);
    const size = 90;
    if (left) {
      g.fillTriangle(0, size / 2, size, 0, size, size);
    } else {
      g.fillTriangle(0, 0, size, size / 2, 0, size);
    }
    g.generateTexture(key, size, size);
    g.destroy();
  }

  private endGame() {
    if (this.ended) return;
    this.ended = true;
    this.gameActive = false;
    dispatchGameOver({ gameId: "paddle-pop", score: this.score, ts: Date.now() });
    // Stop all motion and timers; no auto-restart
    this.physics.world.pause();
    this.time.paused = true;
    // Optionally stop bottom flames visual
    this.bottomFlames?.pause?.();
    // Freeze scene updates
    this.scene.pause();
  }
}
