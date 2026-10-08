import Phaser from "phaser";
import { BasePlatformScene } from "../../../platform/scenes/BasePlatformScene";
import { holdZones } from "../../../platform/input";
import {
  BONUS_INTERVAL_MS,
  BONUS_LIFETIME_MS,
  DISC_COOLDOWN_MS,
  PADDLE_COOLDOWN_MS,
  PADDLE_POINTS,
  POWERUP_DURATION_MS,
  POWERUP_INTERVAL_MS,
  POWERUP_LIFETIME_MS,
  SPLIT_INTERVAL_MS,
  SPLIT_WARNING_MS,
  ballSpeed,
  cooledDown,
  discValue,
  discsToSpawn,
  fireballIntervalFor,
  paddleBounce,
  randInt,
  reflect,
  rollPowerUp,
  splitBalls,
  type PowerUp,
} from "../useCases/rules";

const W = 540;
const H = 960;
/** The ceiling sits below the HUD so the ball never plays behind the score. */
const TOP_WALL = 140;
const PADDLE_WIDTH = 120;
const PADDLE_HEIGHT = 24;
const PADDLE_Y = 840;
const PADDLE_SPEED = 520;
const BIG_PADDLE_SCALE = 1.25;
const BALL_RADIUS = 14;
const DISC_RADIUS = 26;
/** Ball centre to power-up centre distance that collects it. */
const PICKUP_RADIUS = 32;
/** Skip speed correction this long after a paddle bounce, so the new angle sticks. */
const BOUNCE_SETTLE_MS = 100;
const ICE_TINT = 0x60a5fa;

const TEX = {
  paddle: "pp-paddle",
  marble: "pp-marble",
  fireball: "pp-fireball",
  dot: "pp-dot",
  big: "pp-big",
  slow: "pp-slow",
  bg: "pp-bg",
  left: "pp-left",
  right: "pp-right",
} as const;

type Ball = Phaser.Physics.Arcade.Image;
type Disc = {
  img: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  ring: Phaser.GameObjects.Graphics;
  value: number;
  lastScored?: number;
};
type Fireball = {
  sprite: Phaser.Physics.Arcade.Image;
  trail: Phaser.GameObjects.Particles.ParticleEmitter;
  collider?: Phaser.Physics.Arcade.Collider;
};
type PowerUpItem = {
  kind: PowerUp;
  sprite: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Particles.ParticleEmitter;
  expiresAt: number;
};

const bodyOf = (obj: Phaser.GameObjects.GameObject) =>
  obj.body as Phaser.Physics.Arcade.Body | null;

export default class PaddlePopScene extends BasePlatformScene {
  private rng: () => number = Math.random;
  /** Bumped every run, so a countdown from an earlier run can't start this one. */
  private runId = 0;
  /** True between "Go!" and the end of the run. */
  private playing = false;
  /** Time played since "Go!", pauses excluded. Every rule's clock. */
  private playMs = 0;
  private score = 0;
  private dir: -1 | 0 | 1 = 0;
  private slowUntil: number | null = null;
  private bigUntil: number | null = null;
  private nextBonusAt = 0;
  private nextFireballAt = 0;
  private nextPowerAt = 0;
  private nextSplitAt = 0;
  private splitWarned = false;

  private paddle!: Phaser.Physics.Arcade.Image;
  private balls!: Phaser.Physics.Arcade.Group;
  private leftBtn!: Phaser.GameObjects.Arc;
  private rightBtn!: Phaser.GameObjects.Arc;
  private lastPaddleHit = new Map<Ball, number>();
  private lastPaddleScore = new Map<Ball, number>();
  private prevPos = new Map<Ball, { x: number; y: number }>();
  private discs = new Set<Disc>();
  private fireballs = new Set<Fireball>();
  private powerUp: PowerUpItem | null = null;
  private slowTrails: Phaser.GameObjects.Particles.ParticleEmitter[] = [];

  constructor() {
    super("PaddlePop");
  }

  preload() {
    this.load.svg(TEX.bg, "/assets/paddle-pop/background.svg", { scale: 1 });
    this.load.svg(TEX.slow, "/assets/paddle-pop/powerup-slow.svg", { scale: 1 });
  }

  protected startRun() {
    // The scene object survives restarts: reset every per-run field first.
    this.rng = this.host.rng();
    this.playing = false;
    this.playMs = 0;
    this.score = 0;
    this.dir = 0;
    this.slowUntil = null;
    this.bigUntil = null;
    this.nextBonusAt = BONUS_INTERVAL_MS;
    this.nextFireballAt = fireballIntervalFor(0);
    this.nextPowerAt = POWERUP_INTERVAL_MS;
    this.nextSplitAt = SPLIT_INTERVAL_MS;
    this.splitWarned = false;
    this.lastPaddleHit.clear();
    this.lastPaddleScore.clear();
    this.prevPos.clear();
    this.discs.clear();
    this.fireballs.clear();
    this.powerUp = null;
    this.slowTrails = [];

    this.makeTextures();
    this.add
      .image(W / 2, H / 2, TEX.bg)
      .setDisplaySize(W, H)
      .setDepth(-100);
    this.drawWalls();
    this.createPaddle();
    this.balls = this.physics.add.group();
    this.createBall(W / 2, PADDLE_Y - 60);
    this.createButtons();
    this.createBottomFlames();

    this.physics.world.setBounds(0, TOP_WALL, W, H - TOP_WALL, true, true, true, false);
    // Paddle bounce: only for balls on their way down into it.
    this.physics.add.collider(
      this.balls,
      this.paddle,
      (ball: unknown) => this.bounceOffPaddle(ball as Ball),
      (ball: unknown) => (bodyOf(ball as Ball)?.velocity.y ?? 0) > 0,
    );

    this.hud.setScore(0);
    this.hud.setBest(this.host.best.get());
    holdZones(this, { onChange: (d) => this.setDirection(d) });

    // 3-2-1, then the ball goes.
    const run = ++this.runId;
    void this.hud.countdown(3).then(() => {
      if (run !== this.runId || this.runEnded) return; // a newer run took over
      this.playing = true;
      const first = this.activeBalls()[0];
      if (first) this.launch(first);
    });
  }

  update(_time: number, delta: number) {
    this.lockPaddle();
    if (this.runEnded || !this.playing) return;
    this.playMs += delta;
    const now = this.playMs;

    if (this.dir !== 0) {
      const half = this.paddle.displayWidth / 2;
      const x = this.paddle.x + (this.dir * PADDLE_SPEED * delta) / 1000;
      this.paddle.x = Phaser.Math.Clamp(x, half, W - half);
    }

    this.expirePowerUps(now);
    this.steerBalls(now);
    this.catchTunnelling();
    if (!this.keepBallsInPlay()) return;
    this.hitDiscs(now);
    this.checkPowerUp(now);
    this.checkFireballs();
    this.runSchedules(now);

    for (const ball of this.activeBalls()) this.prevPos.set(ball, { x: ball.x, y: ball.y });
  }

  // Setup

  private makeTextures() {
    const make = (
      key: string,
      w: number,
      h: number,
      draw: (g: Phaser.GameObjects.Graphics) => void,
    ) => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      draw(g);
      g.generateTexture(key, w, h);
      g.destroy();
    };
    make(TEX.paddle, PADDLE_WIDTH, PADDLE_HEIGHT, (g) => {
      g.fillStyle(0x2563eb, 1).fillRoundedRect(0, 0, PADDLE_WIDTH, PADDLE_HEIGHT, 12);
      g.fillStyle(0x60a5fa, 0.6).fillRoundedRect(6, 4, PADDLE_WIDTH - 12, PADDLE_HEIGHT / 3, 6);
      g.lineStyle(2, 0x1e3a8a, 0.8).strokeRoundedRect(
        1,
        1,
        PADDLE_WIDTH - 2,
        PADDLE_HEIGHT - 2,
        12,
      );
    });
    make(TEX.marble, BALL_RADIUS * 2 + 2, BALL_RADIUS * 2 + 2, (g) => {
      g.fillStyle(0x9ca3af, 1).fillCircle(BALL_RADIUS, BALL_RADIUS, BALL_RADIUS);
      g.lineStyle(2, 0xffffff, 0.6).strokeCircle(BALL_RADIUS, BALL_RADIUS, BALL_RADIUS - 2);
    });
    make(TEX.fireball, 40, 40, (g) => {
      g.fillStyle(0xff4500, 0.8).fillCircle(20, 20, 20);
      g.fillStyle(0xff7a00, 0.9).fillCircle(20, 20, 14);
      g.fillStyle(0xffe066, 1).fillCircle(20, 20, 8);
    });
    make(TEX.dot, 6, 6, (g) => g.fillStyle(0xffffff, 1).fillCircle(3, 3, 3));
    make(TEX.big, 40, 40, (g) => {
      g.fillStyle(0xf59e0b, 1).fillRoundedRect(2, 13, 36, 14, 6);
      g.lineStyle(2, 0xfdba74, 1).strokeRoundedRect(3, 14, 34, 12, 6);
    });
    const size = 90;
    make(TEX.left, size, size, (g) =>
      g.fillStyle(0xffffff, 1).fillTriangle(0, size / 2, size, 0, size, size),
    );
    make(TEX.right, size, size, (g) =>
      g.fillStyle(0xffffff, 1).fillTriangle(0, 0, size, size / 2, 0, size),
    );
  }

  private drawWalls() {
    const g = this.add.graphics();
    g.lineStyle(10, 0x243041, 0.9);
    g.beginPath();
    g.moveTo(5, H);
    g.lineTo(5, TOP_WALL - 5);
    g.lineTo(W - 5, TOP_WALL - 5);
    g.lineTo(W - 5, H);
    g.strokePath();
  }

  private createPaddle() {
    this.paddle = this.physics.add.image(W / 2, PADDLE_Y, TEX.paddle);
    this.paddle.setImmovable(true);
    const body = bodyOf(this.paddle);
    if (body) body.allowGravity = false;
  }

  private createBall(x: number, y: number): Ball {
    const ball = this.physics.add.image(x, y, TEX.marble).setCircle(BALL_RADIUS);
    ball.setBounce(1, 1);
    ball.setCollideWorldBounds(true);
    this.balls.add(ball);
    if (this.slowUntil !== null) ball.setTint(ICE_TINT);
    return ball;
  }

  private createButtons() {
    // Just hints: holding anywhere on that half of the screen moves the paddle.
    const pad = 60;
    const make = (x: number, key: string) => {
      const bg = this.add.circle(0, 0, 44, 0xffffff, 0.12).setStrokeStyle(3, 0xffffff, 0.6);
      const icon = this.add.image(0, 0, key).setScale(0.5).setAlpha(0.9);
      this.add.container(x, H - pad, [bg, icon]).setDepth(30);
      return bg;
    };
    this.leftBtn = make(pad, TEX.left);
    this.rightBtn = make(W - pad, TEX.right);
  }

  private createBottomFlames() {
    this.add
      .particles(0, H - 8, TEX.dot, {
        x: { min: 0, max: W },
        speedY: { min: -140, max: -80 },
        speedX: { min: -20, max: 20 },
        lifespan: { min: 400, max: 900 },
        alpha: { start: 0.9, end: 0 },
        scale: { start: 1.2, end: 0 },
        blendMode: "ADD",
        quantity: 8,
        frequency: 60,
        tint: [0xffe066, 0xffa200, 0xff4500],
      })
      .setDepth(900);
  }

  // Paddle and balls

  private setDirection(d: -1 | 0 | 1) {
    this.dir = d;
    this.leftBtn.setFillStyle(0xffffff, d === -1 ? 0.25 : 0.12);
    this.rightBtn.setFillStyle(0xffffff, d === 1 ? 0.25 : 0.12);
  }

  /** The paddle only moves sideways; its body follows its scale (big power-up) by itself. */
  private lockPaddle() {
    this.paddle.y = PADDLE_Y;
    bodyOf(this.paddle)?.setVelocity(0, 0);
  }

  private activeBalls(): Ball[] {
    return (this.balls.getChildren() as Ball[]).filter((b) => b.active);
  }

  private speed(now = this.playMs): number {
    return ballSpeed(now, this.slowUntil !== null);
  }

  private launch(ball: Ball) {
    const angle = -Math.PI / 3 - this.rng() * (Math.PI / 3); // upwards, ±30° from straight up
    const s = this.speed();
    ball.setVelocity(Math.cos(angle) * s, Math.sin(angle) * s);
  }

  private bounceOffPaddle(ball: Ball) {
    if (!this.playing || this.runEnded || !ball.active) return;
    const body = bodyOf(ball);
    if (!body) return;

    // Sit the ball on top of the paddle, then send it up at an angle set by where it hit.
    const y = PADDLE_Y - this.paddle.displayHeight / 2 - BALL_RADIUS - 2;
    body.position.y = y - body.height / 2;
    ball.y = y;

    const now = this.playMs;
    this.lastPaddleHit.set(ball, now);
    const offset = (ball.x - this.paddle.x) / (this.paddle.displayWidth / 2);
    const v = paddleBounce(offset, this.speed());
    ball.setVelocity(v.vx, v.vy);

    if (cooledDown(this.lastPaddleScore.get(ball), now, PADDLE_COOLDOWN_MS)) {
      this.lastPaddleScore.set(ball, now);
      this.addScore(PADDLE_POINTS);
      this.host.audio.play("hit");
    }
  }

  /** Every ball travels at the current speed (ramp and slow power-up). */
  private steerBalls(now: number) {
    const desired = this.speed(now);
    for (const ball of this.activeBalls()) {
      if (now - (this.lastPaddleHit.get(ball) ?? -Infinity) < BOUNCE_SETTLE_MS) continue;
      const body = bodyOf(ball);
      if (!body) continue;
      const current = body.velocity.length();
      if (current < 1) {
        ball.setVelocity(0, -desired);
        continue;
      }
      const f = desired / current;
      ball.setVelocity(body.velocity.x * f, body.velocity.y * f);
    }
  }

  /** A fast ball can jump past the paddle between frames; count crossing its top as a hit. */
  private catchTunnelling() {
    const hitY = PADDLE_Y - this.paddle.displayHeight / 2 - BALL_RADIUS - 1;
    const reach = this.paddle.displayWidth / 2 + BALL_RADIUS;
    for (const ball of this.activeBalls()) {
      const body = bodyOf(ball);
      if (!body || body.velocity.y <= 0) continue;
      const prevY = this.prevPos.get(ball)?.y ?? ball.y;
      if (prevY <= hitY && ball.y >= hitY && Math.abs(ball.x - this.paddle.x) <= reach) {
        this.bounceOffPaddle(ball);
      }
    }
  }

  /** Walls, and balls lost into the lava. Returns false once the last ball is gone. */
  private keepBallsInPlay(): boolean {
    const r = BALL_RADIUS;
    for (const ball of this.activeBalls()) {
      const body = bodyOf(ball);
      if (body) {
        if (ball.x < r) {
          ball.x = r;
          body.velocity.x = Math.abs(body.velocity.x);
        } else if (ball.x > W - r) {
          ball.x = W - r;
          body.velocity.x = -Math.abs(body.velocity.x);
        }
        if (ball.y < TOP_WALL + r) {
          ball.y = TOP_WALL + r;
          body.velocity.y = Math.abs(body.velocity.y);
        }
      }
      if (ball.y > H + 40) this.removeBall(ball);
    }
    if (this.activeBalls().length > 0) return true;
    this.finish();
    return false;
  }

  private removeBall(ball: Ball) {
    this.lastPaddleHit.delete(ball);
    this.lastPaddleScore.delete(ball);
    this.prevPos.delete(ball);
    ball.destroy();
    if (this.activeBalls().length > 0) this.host.audio.play("miss");
  }

  private addScore(points: number) {
    this.score += points;
    this.hud.setScore(this.score);
  }

  // Schedules (all on play time)

  private runSchedules(now: number) {
    if (now >= this.nextBonusAt) {
      this.nextBonusAt += BONUS_INTERVAL_MS;
      const n = discsToSpawn(this.rng, this.discs.size);
      for (let i = 0; i < n; i++) this.spawnDisc();
    }
    if (now >= this.nextFireballAt) {
      this.spawnFireball();
      this.nextFireballAt = now + fireballIntervalFor(now);
    }
    if (now >= this.nextPowerAt) {
      this.nextPowerAt += POWERUP_INTERVAL_MS;
      const kind = this.powerUp ? null : rollPowerUp(this.rng);
      if (kind) this.spawnPowerUp(kind, randInt(this.rng, 60, W - 60), randInt(this.rng, 220, 520));
    }
    if (!this.splitWarned && now >= this.nextSplitAt - SPLIT_WARNING_MS) {
      this.splitWarned = true;
      this.cameras.main.shake(SPLIT_WARNING_MS, 0.006);
    }
    if (now >= this.nextSplitAt) {
      this.nextSplitAt += SPLIT_INTERVAL_MS;
      this.splitWarned = false;
      this.multiball();
    }
  }

  private multiball() {
    const balls = this.activeBalls();
    const motion = balls.map((b) => {
      const v = bodyOf(b)?.velocity;
      return { x: b.x, y: b.y, vx: v?.x ?? 0, vy: v?.y ?? 0 };
    });
    const fallback = -2.6 + this.rng() * 2; // upwards-ish
    const next = splitBalls(motion, this.speed(), fallback);
    if (next.length <= balls.length) return;
    next.forEach((m, i) => (balls[i] ?? this.createBall(m.x, m.y)).setVelocity(m.vx, m.vy));
    this.hud.popup("Multiball!", W / 2, 420);
    this.host.audio.ding();
  }

  // Bonus discs: bumpers worth 1–10 each time a ball bounces off them

  private spawnDisc() {
    const value = discValue(this.rng);
    const x = randInt(this.rng, 60, W - 60);
    const y = randInt(this.rng, TOP_WALL + 60, 720);
    const key = `pp-disc-${value}`;
    if (!this.textures.exists(key)) {
      // map 1..10 across warm to cool hues
      const hue = Phaser.Math.Linear(20, 300, (value - 1) / 9) / 360;
      const color = Phaser.Display.Color.HSLToColor(hue, 0.75, 0.55).color;
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(color, 0.95).fillCircle(DISC_RADIUS, DISC_RADIUS, DISC_RADIUS);
      g.lineStyle(3, 0xffffff, 0.85).strokeCircle(DISC_RADIUS, DISC_RADIUS, DISC_RADIUS);
      g.generateTexture(key, DISC_RADIUS * 2, DISC_RADIUS * 2);
      g.destroy();
    }
    const disc: Disc = {
      img: this.add.image(x, y, key),
      label: this.add
        .text(x, y, `+${value}`, {
          fontFamily: this.host.fonts.display,
          fontSize: "24px",
          fontStyle: "800",
          color: "#000000",
        })
        .setOrigin(0.5),
      ring: this.add.graphics(),
      value,
    };
    this.discs.add(disc);

    // Countdown ring, then the disc pops.
    this.tweens.addCounter({
      from: 1,
      to: 0,
      duration: BONUS_LIFETIME_MS,
      onUpdate: (tween) => {
        const left = tween.getValue() ?? 0;
        disc.ring.clear();
        disc.ring.lineStyle(4, 0xffffff, 0.8);
        disc.ring.beginPath();
        disc.ring.arc(x, y, 32, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left, false);
        disc.ring.strokePath();
      },
      onComplete: () => this.expireDisc(disc),
    });
  }

  private expireDisc(disc: Disc) {
    if (!this.discs.delete(disc)) return;
    this.burst(disc.img.x, disc.img.y, TEX.marble, 12, { min: 80, max: 160 }, 0.4);
    disc.img.destroy();
    disc.label.destroy();
    disc.ring.destroy();
  }

  private hitDiscs(now: number) {
    if (this.discs.size === 0) return;
    const balls = this.activeBalls();
    for (const disc of this.discs) {
      const rSum = DISC_RADIUS + BALL_RADIUS;
      for (const ball of balls) {
        const body = bodyOf(ball);
        if (!body) continue;
        const dx = ball.x - disc.img.x;
        const dy = ball.y - disc.img.y;
        const dist = Math.hypot(dx, dy);
        if (dist > rSum) continue;

        // Incoming direction from last frame's movement, else the velocity.
        const prev = this.prevPos.get(ball);
        let inX = ball.x - (prev?.x ?? ball.x);
        let inY = ball.y - (prev?.y ?? ball.y);
        if (Math.hypot(inX, inY) < 1e-3) {
          inX = body.velocity.x;
          inY = body.velocity.y;
        }
        const inLen = Math.hypot(inX, inY);
        if (inLen < 1e-3) continue;
        const dirX = inX / inLen;
        const dirY = inY / inLen;
        const nx = dist > 1e-6 ? dx / dist : -dirX;
        const ny = dist > 1e-6 ? dy / dist : -dirY;
        const out = reflect(dirX, dirY, nx, ny);

        // Push the ball outside the disc and send it off along the reflection.
        const px = disc.img.x + nx * (rSum + 0.5);
        const py = disc.img.y + ny * (rSum + 0.5);
        body.position.set(px - body.width / 2, py - body.height / 2);
        ball.setPosition(px, py);
        const s = this.speed(now);
        ball.setVelocity(out.x * s, out.y * s);

        // It always bounces; it only scores once per contact.
        if (cooledDown(disc.lastScored, now, DISC_COOLDOWN_MS)) {
          disc.lastScored = now;
          this.addScore(disc.value);
          this.hud.popup(`+${disc.value}`, disc.img.x, disc.img.y - 30);
          this.host.audio.play("score");
          this.cameras.main.shake(70, 0.008);
        }
      }
    }
  }

  // Fireballs: touch the paddle and it's over

  private spawnFireball() {
    const x = randInt(this.rng, 60, W - 60);
    const sprite = this.physics.add.image(x, -30, TEX.fireball).setBlendMode(Phaser.BlendModes.ADD);
    const side = this.rng() < 0.5 ? -1 : 1;
    sprite.setVelocity(side * randInt(this.rng, 60, 120), randInt(this.rng, 180, 280));
    sprite.setAngularVelocity(Phaser.Math.Between(-120, 120));
    const body = bodyOf(sprite);
    if (body) body.allowGravity = false;
    const trail = this.add.particles(0, 0, TEX.dot, {
      speed: { min: 50, max: 120 },
      lifespan: { min: 200, max: 500 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.9, end: 0 },
      follow: sprite,
      tint: [0xffe066, 0xffa200, 0xff4500],
      blendMode: "ADD",
      frequency: 30,
      angle: { min: 210, max: 330 },
    });
    const fireball: Fireball = { sprite, trail };
    fireball.collider = this.physics.add.overlap(sprite, this.paddle, () =>
      this.onFireballHit(fireball),
    );
    this.fireballs.add(fireball);
  }

  /** Removes the fireball, its trail and its paddle collider. */
  private killFireball(fireball: Fireball) {
    if (!this.fireballs.delete(fireball)) return;
    fireball.collider?.destroy();
    fireball.trail.destroy();
    fireball.sprite.destroy();
  }

  private checkFireballs() {
    for (const fireball of this.fireballs) {
      if (fireball.sprite.y > H + 60) this.killFireball(fireball);
    }
  }

  private onFireballHit(fireball: Fireball) {
    if (!this.playing || this.runEnded) return;
    const { x, y } = fireball.sprite;
    this.burst(x, y, TEX.marble, 16, { min: 120, max: 240 }, 0.6, [0xffe066, 0xff7a00, 0xff4500]);
    this.killFireball(fireball);
    this.finish();
  }

  // Power-ups

  private spawnPowerUp(kind: PowerUp, x: number, y: number) {
    const sprite = this.add
      .image(x, y, kind === "slow" ? TEX.slow : TEX.big)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: sprite,
      scale: 1.15,
      yoyo: true,
      duration: 400,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    const glow = this.add.particles(0, 0, TEX.dot, {
      follow: sprite,
      lifespan: { min: 300, max: 700 },
      speed: { min: 20, max: 60 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: kind === "slow" ? 0x93c5fd : 0xf59e0b,
      frequency: 90,
      blendMode: "ADD",
      quantity: 1,
    });
    this.powerUp = { kind, sprite, glow, expiresAt: this.playMs + POWERUP_LIFETIME_MS };
  }

  private removePowerUp() {
    const p = this.powerUp;
    if (!p) return;
    this.powerUp = null;
    this.tweens.killTweensOf(p.sprite);
    p.glow.destroy();
    p.sprite.destroy();
  }

  private checkPowerUp(now: number) {
    const p = this.powerUp;
    if (!p) return;
    if (now >= p.expiresAt) {
      this.removePowerUp();
      return;
    }
    const caught = this.activeBalls().some(
      (b) => Phaser.Math.Distance.Between(b.x, b.y, p.sprite.x, p.sprite.y) < PICKUP_RADIUS,
    );
    if (!caught) return;
    this.removePowerUp();
    this.host.audio.ding();
    if (p.kind === "slow") this.applySlow(now);
    else this.applyBig(now);
  }

  private applySlow(now: number) {
    this.slowUntil = now + POWERUP_DURATION_MS;
    this.slowTrails.forEach((e) => e.destroy());
    this.slowTrails = this.activeBalls().map((ball) => {
      ball.setTint(ICE_TINT);
      return this.add.particles(0, 0, TEX.marble, {
        scale: { start: 0.3, end: 0 },
        lifespan: 300,
        frequency: 80,
        follow: ball,
        tint: 0x93c5fd,
        blendMode: "ADD",
      });
    });
    this.hud.popup("Slow!", W / 2, 420, this.host.colors.sky);
  }

  private applyBig(now: number) {
    this.bigUntil = now + POWERUP_DURATION_MS;
    this.tweens.killTweensOf(this.paddle);
    this.tweens.add({
      targets: this.paddle,
      scaleX: BIG_PADDLE_SCALE,
      duration: 250,
      ease: "Quad.easeOut",
    });
    // Flash a few times. Phaser 4: fill is a tint mode, and clearTint() doesn't reset it.
    let bright = false;
    this.time.addEvent({
      delay: 100,
      repeat: 7, // an even number of flips, so it ends un-tinted
      callback: () => {
        bright = !bright;
        if (bright) this.paddle.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
        else this.paddle.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
      },
    });
    this.hud.popup("Big paddle!", W / 2, 420, this.host.colors.sun);
  }

  private expirePowerUps(now: number) {
    if (this.slowUntil !== null && now >= this.slowUntil) {
      this.slowUntil = null;
      this.slowTrails.forEach((e) => e.destroy());
      this.slowTrails = [];
      for (const ball of this.activeBalls()) ball.clearTint();
    }
    if (this.bigUntil !== null && now >= this.bigUntil) {
      this.bigUntil = null;
      this.tweens.killTweensOf(this.paddle);
      this.paddle.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
      this.tweens.add({ targets: this.paddle, scaleX: 1, duration: 200, ease: "Quad.easeIn" });
    }
  }

  // Effects and the end

  private burst(
    x: number,
    y: number,
    key: string,
    count: number,
    speed: { min: number; max: number },
    scale: number,
    tint?: number[],
  ) {
    const e = this.add.particles(x, y, key, {
      speed,
      scale: { start: scale, end: 0 },
      lifespan: 450,
      blendMode: "ADD",
      emitting: false,
      ...(tint ? { tint } : {}),
    });
    e.explode(count);
    this.time.delayedCall(600, () => e.destroy());
  }

  /** Freeze the field and hand the score to the platform (it shows the score dialog). */
  private finish() {
    if (this.runEnded) return;
    this.playing = false;
    this.setDirection(0);
    this.physics.pause();
    this.endRun(this.score);
  }
}
