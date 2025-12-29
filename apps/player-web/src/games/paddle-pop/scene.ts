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
  private scoreText!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;
  private balls!: Phaser.Physics.Arcade.Group;

  private score: number = 0;
  private bestScore: number = 0;
  private activePowerUps: ActivePowerUps = {};
  private lastSpeedInc: number = 0;
  private lastBonusSpawn: number = 0;
  private movingLeft = false;
  private movingRight = false;
  private lastObstacleSpawn = 0;
  private slowMultiplier = 1; // affected by slow power-up
  private currentNominalSpeed = BALL_BASE_SPEED;
  private lastPowerSpawn = 0;
  private gameActive = false;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private activePowerupVisual?: Phaser.GameObjects.GameObject; // ensure only one power-up on screen
  private ended = false;
  private bottomFlames?: any;
  private bonusCount = 0;
  private fireballInterval = 4000; // starts at 4s, decreases over time
  private splitEvent?: Phaser.Time.TimerEvent;
  private splitWarningEvent?: Phaser.Time.TimerEvent;
  private ballLastPaddleHit = new Map<Phaser.Physics.Arcade.Image, number>();
  private ballLastPaddleScore = new Map<Phaser.Physics.Arcade.Image, number>();
  private ballPrevPos = new Map<Phaser.Physics.Arcade.Image, { x: number; y: number }>();
  private activeBonusDiscs = new Set<Phaser.GameObjects.Image>();

  constructor() {
    super("PaddlePop");
  }

  preload() {
    this.load.svg("paddle-pop-bg", "/assets/paddle-pop/background.svg", { scale: 1 });
    this.load.svg("paddle-pop-pu-slow", "/assets/paddle-pop/powerup-slow.svg", { scale: 1 });
    this.createArrowTexture("uiLeft", true);
    this.createArrowTexture("uiRight", false);
  }

  create() {
    this.createBackground();
    this.createBorder();
    this.createUI();
    this.createPaddle();
    this.createBalls();
    this.createControls();
    this.createBottomFlames();
    this.cursors = this.input.keyboard!.createCursorKeys();
    // this.obstacles = this.physics.add.group();

    // Paddle bounce: use a collider for reliable contact detection, but gate it so we only
    // process hits when the ball is moving downward into the paddle.
    this.physics.add.collider(
      this.balls,
      this.paddle as any,
      this.onBallPaddleHit as any,
      (ballObj: any) => {
        const ball = ballObj as Phaser.Physics.Arcade.Image;
        const body = ball.body as Phaser.Physics.Arcade.Body | undefined;
        return !!body && body.velocity.y > 0;
      },
      this
    );
    // Explicitly set world bounds to match our fixed playfield (needed for reliable side bounces)
    this.physics.world.setBounds(0, 0, PLAY_WIDTH, PLAY_HEIGHT, true, true, true, false);

    // Countdown start
    this.startCountdown().then(() => {
      this.gameActive = true;
      const now = this.time.now;
      this.lastSpeedInc = now;
      this.lastBonusSpawn = now;
      this.lastObstacleSpawn = now;
      this.lastPowerSpawn = now;

      const splitIntervalMs = 35000;
      const warningMs = 3000;

      this.splitWarningEvent = this.time.addEvent({
        delay: splitIntervalMs - warningMs,
        loop: true,
        callback: () => {
          if (!this.gameActive) return;
          this.cameras.main.shake(warningMs, 0.006);
        },
        callbackScope: this,
      });

      this.splitEvent = this.time.addEvent({
        delay: splitIntervalMs,
        loop: true,
        callback: this.splitOneBallIntoThree,
        callbackScope: this,
      });
      this.launchInitialBall();
    });
  }

  private createBackground() {
    this.add
      .image(PLAY_WIDTH / 2, PLAY_HEIGHT / 2, "paddle-pop-bg")
      .setDisplaySize(PLAY_WIDTH, PLAY_HEIGHT)
      .setDepth(-100);
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
    this.bestScore = Number(localStorage.getItem("paddle-pop-best") || 0) || 0;
    this.scoreText = this.add
      .text(270, 930, "Score: 0", {
        fontFamily: "Fredoka, sans-serif",
        fontSize: "28px",
        color: "#ffffff",
      })
      .setOrigin(0.5, 1);

    this.bestText = this.add
      .text(270, 958, `High: ${this.bestScore}`, {
        fontFamily: "Fredoka, sans-serif",
        fontSize: "18px",
        color: "#ffffff",
      })
      .setOrigin(0.5, 1)
      .setAlpha(0.85);
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
    const body = this.paddle.body as Phaser.Physics.Arcade.Body;
    body.allowGravity = false;
    body.immovable = true;
    body.setSize(this.paddle.displayWidth, this.paddle.displayHeight, true);
  }

  private createBalls() {
    if (!this.textures.exists("marble")) {
      const g = this.add.graphics();
      g.fillStyle(0x9ca3af, 1);
      g.fillCircle(BALL_RADIUS, BALL_RADIUS, BALL_RADIUS);
      g.lineStyle(2, 0xffffff, 0.6);
      g.strokeCircle(BALL_RADIUS, BALL_RADIUS, BALL_RADIUS - 2);
      g.generateTexture("marble", BALL_RADIUS * 2 + 2, BALL_RADIUS * 2 + 2);
      g.destroy();
    }

    this.balls = this.physics.add.group();
    this.createBallAt(PLAY_WIDTH / 2, PADDLE_Y - 60, this.currentNominalSpeed);
  }

  private getActiveBalls(): Phaser.Physics.Arcade.Image[] {
    return (this.balls.getChildren() as Phaser.Physics.Arcade.Image[]).filter((b) => b.active);
  }

  private getBallNominalSpeed(ball: Phaser.Physics.Arcade.Image): number {
    const s = Number(ball.getData("nominalSpeed"));
    return Number.isFinite(s) && s > 0 ? s : this.currentNominalSpeed;
  }

  private createBallAt(x: number, y: number, nominalSpeed: number) {
    const ball = this.physics.add.image(x, y, "marble").setCircle(BALL_RADIUS);
    ball.setBounce(1, 1);
    ball.setCollideWorldBounds(true);
    ball.setData("nominalSpeed", nominalSpeed);
    const body = ball.body as Phaser.Physics.Arcade.Body;
    body.onWorldBounds = true;
    body.checkCollision.up = true;
    body.checkCollision.left = true;
    body.checkCollision.right = true;
    body.checkCollision.down = true;
    this.balls.add(ball);
    return ball;
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

  private launchBall(ball: Phaser.Physics.Arcade.Image) {
    const angle = Phaser.Math.FloatBetween(-Math.PI / 3, (-2 * Math.PI) / 3); // upward random
    const desiredSpeed = Phaser.Math.Clamp(
      this.getBallNominalSpeed(ball) * this.slowMultiplier,
      BALL_BASE_SPEED * 0.5,
      BALL_MAX_SPEED
    );
    const vx = Math.cos(angle) * desiredSpeed;
    const vy = Math.sin(angle) * desiredSpeed;
    ball.setVelocity(vx, vy);
  }

  private launchInitialBall() {
    const balls = this.getActiveBalls();
    if (!balls.length) return;
    this.launchBall(balls[0]);
  }

  private addScore(delta: number) {
    this.score += delta;
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      localStorage.setItem("paddle-pop-best", String(this.bestScore));
    }
    this.scoreText.setText(`Score: ${this.score}`);
    this.bestText.setText(`High: ${this.bestScore}`);
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

  private bounceBallOffPaddle(
    ball: Phaser.Physics.Arcade.Image,
    paddle: Phaser.Physics.Arcade.Image
  ) {
    if (!this.gameActive || !ball.active || !paddle.active) return;

    const body = ball.body as Phaser.Physics.Arcade.Body | undefined;
    if (!body) return;

    // Force it upward no matter what.
    const paddleTop = paddle.y - paddle.displayHeight / 2;
    const desiredY = paddleTop - BALL_RADIUS - 2;
    body.position.y = desiredY - body.height / 2;
    ball.y = desiredY;

    this.ballLastPaddleHit.set(ball, this.time.now);

    const relativeRaw = (ball.x - paddle.x) / (paddle.displayWidth / 2); // -1..1
    const relative = Phaser.Math.Clamp(relativeRaw, -1, 1);

    const speed = Phaser.Math.Clamp(
      this.getBallNominalSpeed(ball) * this.slowMultiplier,
      BALL_BASE_SPEED * 0.5,
      BALL_MAX_SPEED
    );

    const maxVx = speed * 0.85;
    const vx = Phaser.Math.Clamp(relative * maxVx, -maxVx, maxVx);
    const vy = -Math.max(speed * 0.45, Math.sqrt(Math.max(0, speed * speed - vx * vx)));
    ball.setVelocity(vx, vy);

    const lastScoreAt = this.ballLastPaddleScore.get(ball) || 0;
    if (this.time.now - lastScoreAt > 120) {
      this.ballLastPaddleScore.set(ball, this.time.now);
      this.addScore(1);
    }
  }

  private onBallPaddleHit = (ballObj: any, paddleObj: any) => {
    const ball = ballObj as Phaser.Physics.Arcade.Image;
    const paddle = paddleObj as Phaser.Physics.Arcade.Image;

    const body = ball.body as Phaser.Physics.Arcade.Body | undefined;
    if (!body) return;
    if (body.velocity.y <= 0) return;

    this.bounceBallOffPaddle(ball, paddle);
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

    // Keep paddle locked to bottom line (defensive)
    if (this.paddle?.active) {
      this.paddle.y = PADDLE_Y;
      const body = this.paddle.body as Phaser.Physics.Arcade.Body | undefined;
      if (body) {
        body.setVelocity(0, 0);
        // Keep physics body in sync with visual size (important when scaling for big power-up)
        body.setSize(this.paddle.displayWidth, this.paddle.displayHeight, true);
      }
    }

    // Speed increase over time
    if (
      this.gameActive &&
      !this.activePowerUps.slow &&
      time - this.lastSpeedInc > SPEED_INCREASE_INTERVAL
    ) {
      this.lastSpeedInc = time;
      this.currentNominalSpeed = Math.min(
        this.currentNominalSpeed + SPEED_INCREASE_AMOUNT,
        BALL_MAX_SPEED
      );
      for (const ball of this.getActiveBalls()) {
        ball.setData("nominalSpeed", this.currentNominalSpeed);
      }
    }

    // Keep each ball speed consistent (respect slow multiplier)
    if (this.gameActive) {
      for (const ball of this.getActiveBalls()) {
        // Skip normalization briefly after paddle hit to let bounce take effect
        const lastHit = this.ballLastPaddleHit.get(ball) || 0;
        if (time - lastHit < 100) continue;

        const body = ball.body as Phaser.Physics.Arcade.Body | undefined;
        if (!body) continue;
        const v = body.velocity;
        const current = v.length();
        const desired = Phaser.Math.Clamp(
          this.getBallNominalSpeed(ball) * this.slowMultiplier,
          BALL_BASE_SPEED * 0.5,
          BALL_MAX_SPEED
        );
        if (current < 1) {
          ball.setVelocity(0, -desired);
          continue;
        }
        const f = desired / current;
        ball.setVelocity(v.x * f, v.y * f);
      }
    }

    // Continuous collision check to prevent tunneling through the paddle at high speed.
    // If a ball crosses the paddle top between frames, treat it as a paddle hit.
    if (this.gameActive && this.paddle?.active) {
      const paddle = this.paddle;
      const paddleTop = paddle.y - paddle.displayHeight / 2;
      const hitY = paddleTop - BALL_RADIUS - 1;
      const halfW = paddle.displayWidth / 2;
      for (const ball of this.getActiveBalls()) {
        const body = ball.body as Phaser.Physics.Arcade.Body | undefined;
        if (!body) continue;
        if (body.velocity.y <= 0) continue;

        const prev = this.ballPrevPos.get(ball);
        const prevY = prev?.y ?? ball.y;
        if (prevY <= hitY && ball.y >= hitY) {
          if (Math.abs(ball.x - paddle.x) <= halfW + BALL_RADIUS) {
            this.bounceBallOffPaddle(ball, paddle);
          }
        }
      }
    }

    // Balls fell off bottom -> remove; game continues while any remain
    if (this.gameActive) {
      for (const ball of this.getActiveBalls()) {
        // Safety clamp/bounce for left/right/top (prevents edge tunneling)
        const body = ball.body as Phaser.Physics.Arcade.Body | undefined;
        if (body) {
          const r = BALL_RADIUS;
          if (ball.x < r) {
            ball.x = r;
            body.velocity.x = Math.abs(body.velocity.x || 0);
          } else if (ball.x > PLAY_WIDTH - r) {
            ball.x = PLAY_WIDTH - r;
            body.velocity.x = -Math.abs(body.velocity.x || 0);
          }
          if (ball.y < r) {
            ball.y = r;
            body.velocity.y = Math.abs(body.velocity.y || 0);
          }
        }

        if (ball.y > PLAY_HEIGHT + 40) {
          ball.destroy();
        }
      }
      if (this.getActiveBalls().length === 0) {
        this.endGame();
        return;
      }
    }

    // Manual scoring-disc hits (deterministic bounce + scoring)
    if (this.gameActive && this.activeBonusDiscs.size) {
      this.handleBonusDiscHits(time);
    }

    // Power-up expiration visuals (placeholder)
    const now = time;
    if (this.activePowerUps.slow && now > this.activePowerUps.slow) {
      this.activePowerUps.slow = undefined;
      this.slowMultiplier = 1;
      for (const ball of this.getActiveBalls()) ball.clearTint();
    }
    if (this.activePowerUps.big && now > this.activePowerUps.big) {
      this.activePowerUps.big = undefined;
      this.resetPaddleSize();
    }

    // Spawn bonus discs (after countdown)
    if (this.gameActive && time - this.lastBonusSpawn > BONUS_SPAWN_INTERVAL) {
      this.lastBonusSpawn = time;
      const numToSpawn = Math.random() < 0.4 ? 2 : 1; // sometimes 2
      for (let i = 0; i < numToSpawn && this.bonusCount < 3; i++) {
        this.spawnBonus();
      }
    } // Spawn obstacles occasionally
    if (this.gameActive && time - this.lastObstacleSpawn > this.fireballInterval) {
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

    // Track previous positions for tunneling checks
    if (this.gameActive) {
      for (const ball of this.getActiveBalls()) {
        this.ballPrevPos.set(ball, { x: ball.x, y: ball.y });
      }
    }
  }

  private handleBonusDiscHits(time: number) {
    const discs = Array.from(this.activeBonusDiscs).filter((d) => d.active);
    if (!discs.length) return;

    const balls = this.getActiveBalls();
    if (!balls.length) return;

    for (const disc of discs) {
      const value = Number(disc.getData("value") || 0);
      const discRadius = Number(disc.getData("radius") || 26);
      const lastHit = Number(disc.getData("lastHit") || 0);
      if (time - lastHit < 140) continue;

      for (const ball of balls) {
        const body = ball.body as Phaser.Physics.Arcade.Body | undefined;
        if (!body) continue;

        const dx = ball.x - disc.x;
        const dy = ball.y - disc.y;
        const rSum = discRadius + BALL_RADIUS;
        const dist2 = dx * dx + dy * dy;
        if (dist2 > rSum * rSum) continue;

        // Incoming direction from previous frame (fallback to velocity)
        const prev = this.ballPrevPos.get(ball);
        let inX = ball.x - (prev?.x ?? ball.x);
        let inY = ball.y - (prev?.y ?? ball.y);
        let inLen = Math.sqrt(inX * inX + inY * inY);
        if (inLen < 1e-3) {
          inX = body.velocity.x;
          inY = body.velocity.y;
          inLen = Math.sqrt(inX * inX + inY * inY);
        }
        if (inLen < 1e-3) break;
        const dirX = inX / inLen;
        const dirY = inY / inLen;

        // Normal from disc to ball at impact (if center overlap, use opposite incoming)
        const nLen = Math.sqrt(dist2);
        let nx = nLen > 1e-6 ? dx / nLen : -dirX;
        let ny = nLen > 1e-6 ? dy / nLen : -dirY;

        // Reflect direction about normal
        const dot = dirX * nx + dirY * ny;
        let rx = dirX - 2 * dot * nx;
        let ry = dirY - 2 * dot * ny;
        const rLen = Math.max(1e-6, Math.sqrt(rx * rx + ry * ry));
        rx /= rLen;
        ry /= rLen;

        // Push ball outside disc so it can't remain intersecting
        const outX = disc.x + nx * (rSum + 0.5);
        const outY = disc.y + ny * (rSum + 0.5);
        body.position.set(outX - body.width / 2, outY - body.height / 2);
        ball.setPosition(outX, outY);

        const speed = Phaser.Math.Clamp(
          this.getBallNominalSpeed(ball) * this.slowMultiplier,
          BALL_BASE_SPEED * 0.5,
          BALL_MAX_SPEED
        );
        ball.setVelocity(rx * speed, ry * speed);

        disc.setData("lastHit", time);
        if (value > 0) {
          this.addScore(value);
          this.cameras.main.shake(70, 0.008);
        }
        break;
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
    const bonus = this.add.image(bx, by, texKey);
    bonus.setData("value", value);
    bonus.setData("radius", 26);
    bonus.setData("lastHit", 0);
    this.activeBonusDiscs.add(bonus);
    const label = this.add
      .text(bx, by, `+${value}`, {
        fontFamily: "Fredoka, sans-serif",
        fontSize: "24px",
        color: "#000",
      })
      .setOrigin(0.5);
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
        this.activeBonusDiscs.delete(bonus);
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
    const body = this.paddle.body as Phaser.Physics.Arcade.Body | undefined;
    body?.setSize(this.paddle.displayWidth, this.paddle.displayHeight, true);
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
      for (const ball of this.getActiveBalls()) {
        ball.setVelocity(0, 0);
        const body = ball.body as Phaser.Physics.Arcade.Body | undefined;
        if (body) body.enable = false;
      }
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
    const iceKey = "paddle-pop-pu-slow";
    const bigKey = "pu-big";
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
        for (const ball of this.getActiveBalls()) {
          if (Phaser.Math.Distance.Between(ball.x, ball.y, sprite.x, sprite.y) < 24) {
            if (kind === "slow") this.applySlow();
            else this.applyBigPaddle();
            sprite.destroy();
            emitter.destroy();
            check.remove();
            break;
          }
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
    this.slowMultiplier = 0.75;
    for (const ball of this.getActiveBalls()) ball.setTint(0x60a5fa); // icy blue
    this.activePowerUps.slow = this.time.now + POWERUP_DURATION_MS;
    // sparkle trail
    const emitters = this.getActiveBalls().map((ball) =>
      this.add.particles(0, 0, "marble", {
        scale: { start: 0.3, end: 0 },
        lifespan: 300,
        frequency: 80,
        follow: ball,
        tint: 0x93c5fd,
        blendMode: "ADD",
      })
    );
    this.time.delayedCall(POWERUP_DURATION_MS, () => emitters.forEach((e) => e.destroy()));
  }

  private splitOneBallIntoThree() {
    if (!this.gameActive) return;
    const balls = this.getActiveBalls();
    if (!balls.length) return;

    const source = balls[0];
    const body = source.body as Phaser.Physics.Arcade.Body | undefined;
    const v = body?.velocity;
    const baseAngle =
      v && v.length() > 1 ? Math.atan2(v.y, v.x) : Phaser.Math.FloatBetween(-2.6, -0.6);
    const speed = Phaser.Math.Clamp(
      this.getBallNominalSpeed(source) * this.slowMultiplier,
      BALL_BASE_SPEED * 0.5,
      BALL_MAX_SPEED
    );
    const spread = Phaser.Math.DegToRad(25);
    const angles = [baseAngle, baseAngle + spread, baseAngle - spread];

    source.setVelocity(Math.cos(angles[0]) * speed, Math.sin(angles[0]) * speed);
    const nominal = this.getBallNominalSpeed(source);
    const b1 = this.createBallAt(source.x + 10, source.y, nominal);
    const b2 = this.createBallAt(source.x - 10, source.y, nominal);
    b1.setVelocity(Math.cos(angles[1]) * speed, Math.sin(angles[1]) * speed);
    b2.setVelocity(Math.cos(angles[2]) * speed, Math.sin(angles[2]) * speed);
    if (this.activePowerUps.slow) {
      b1.setTint(0x60a5fa);
      b2.setTint(0x60a5fa);
    }
  }

  private applyBigPaddle() {
    this.activePowerUps.big = this.time.now + POWERUP_DURATION_MS;
    // Ensure paddle stays fully visible during the whole effect
    this.paddle.setAlpha(1);
    this.tweens.add({
      targets: this.paddle,
      scaleX: 1.25,
      duration: 250,
      yoyo: false,
      ease: "Quad.easeOut",
      onUpdate: () => {
        const body = this.paddle.body as Phaser.Physics.Arcade.Body | undefined;
        body?.setSize(this.paddle.displayWidth, this.paddle.displayHeight, true);
      },
    });
    // Flash without changing transparency (avoid leaving paddle semi-transparent)
    const flash = this.time.addEvent({
      delay: 100,
      repeat: 8,
      callback: () => {
        // Toggle a quick "bright" flash while keeping alpha at 1
        if (this.paddle.isTinted) this.paddle.clearTint();
        else this.paddle.setTintFill(0xffffff);
        this.paddle.setAlpha(1);
      },
    });
    this.time.delayedCall(POWERUP_DURATION_MS, () => {
      flash.remove();
      this.paddle.clearTint();
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
    this.splitEvent?.remove(false);
    this.splitWarningEvent?.remove(false);
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
