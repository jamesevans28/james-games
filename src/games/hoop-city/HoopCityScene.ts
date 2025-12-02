import Phaser from "phaser";
import { dispatchGameOver } from "../../utils/gameEvents";
import { trackGameStart } from "../../utils/analytics";

const GAME_WIDTH = 540;
const GAME_HEIGHT = 960;
const GAME_ID = "hoop-city";
const GAME_NAME = "Hoop City";

const BALL_X = GAME_WIDTH * 0.32;
const BALL_RADIUS = 31; // Increased by ~10%
const INITIAL_GRAVITY = 680;
const GRAVITY_RAMP = 90; // gravity strengthens over time so players must keep tapping
const MAX_GRAVITY = 1100;
const LIFT_FORCE = 520; // how strong the tap lift is - short burst

const HOOP_SPEED = 140; // how fast hoops move left to mimic traveling right
const INITIAL_HOOP_LEAD = 520; // how far ahead the very first hoop spawns

const BACKGROUND_SCROLL = 55;
const BEST_KEY = `${GAME_ID}-best-score`;

interface HoopEntity {
  container: Phaser.GameObjects.Container;
  backSprite: Phaser.GameObjects.Image;
  frontSprite: Phaser.GameObjects.Image;
  outerRadius: number;
  innerRadiusX: number;
  innerRadiusY: number;
  scored: boolean;
  nextQueued: boolean;
  touched: boolean;
  inside: boolean;
  everInside: boolean;
  canResetPosition: boolean;
}

export default class HoopCityScene extends Phaser.Scene {
  private skyline?: Phaser.GameObjects.TileSprite;
  private clouds?: Phaser.GameObjects.TileSprite;
  private ballContainer!: Phaser.GameObjects.Container;
  private ballShadow!: Phaser.GameObjects.Ellipse;
  private velocityY = 0;
  private currentGravity = INITIAL_GRAVITY;
  private hoops: HoopEntity[] = [];
  private score = 0;
  private best = 0;
  private currentMultiplier = 1;
  private scoreText!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;
  private isGameOver = false;
  private started = false;
  private liftKey?: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: "HoopCityScene" });
  }

  preload() {
    this.load.svg("hoop-city-ring-back", "/assets/hoop-city/ring-back.svg", { scale: 1 });
    this.load.svg("hoop-city-ring-front", "/assets/hoop-city/ring-front.svg", { scale: 1 });
  }

  create() {
    this.cameras.main.setBackgroundColor(0x030813);
    this.buildBackground();
    this.buildUI();
    this.createBall();
    this.spawnInitialHoops();

    this.input.on("pointerdown", this.handleLift, this);
    this.liftKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.liftKey?.on("down", this.handleLift, this);

    trackGameStart(GAME_ID, GAME_NAME);
  }

  update(_time: number, delta: number) {
    if (this.isGameOver) return;
    const dt = delta / 1000;
    this.updateBall(dt);
    this.updateHoops(dt);
    this.updateBackground(dt);
  }

  private buildBackground() {
    this.createSkyTexture();
    this.createSkylineTexture();

    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x06142a)
      .setDepth(0);

    this.clouds = this.add
      .tileSprite(0, 240, GAME_WIDTH, 200, "hoop-city-clouds")
      .setOrigin(0, 0.5);
    this.clouds.setDepth(1);

    this.skyline = this.add
      .tileSprite(0, GAME_HEIGHT - 220, GAME_WIDTH, 280, "hoop-city-skyline")
      .setOrigin(0, 0.5);
    this.skyline.setDepth(2);
  }

  private createSkyTexture() {
    if (this.textures.exists("hoop-city-clouds")) return;
    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(0x0b2040, 1);
    graphics.fillRect(0, 0, 512, 200);
    graphics.fillStyle(0x132d58, 0.8);
    for (let i = 0; i < 6; i++) {
      const width = Phaser.Math.Between(70, 140);
      const height = Phaser.Math.Between(30, 70);
      const x = Phaser.Math.Between(0, 512 - width);
      const y = Phaser.Math.Between(20, 160);
      graphics.fillEllipse(x, y, width, height);
    }
    graphics.generateTexture("hoop-city-clouds", 512, 200);
    graphics.destroy();
  }

  private createSkylineTexture() {
    if (this.textures.exists("hoop-city-skyline")) return;
    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(0x081528, 1);
    graphics.fillRect(0, 0, 512, 280);
    graphics.fillStyle(0x0f223d, 1);
    const buildingCount = 20;
    for (let i = 0; i < buildingCount; i++) {
      const width = Phaser.Math.Between(20, 60);
      const height = Phaser.Math.Between(60, 240);
      const x = Phaser.Math.Between(0, 512 - width);
      const y = 280 - height;
      graphics.fillRect(x, y, width, height);
      graphics.fillStyle(0x1c355c, 0.6);
      for (let win = 0; win < 6; win++) {
        const winX = x + Phaser.Math.Between(4, width - 8);
        const winY = y + Phaser.Math.Between(6, height - 12);
        graphics.fillRect(winX, winY, 4, 6);
      }
      graphics.fillStyle(0x0f223d, 1);
    }
    graphics.generateTexture("hoop-city-skyline", 512, 280);
    graphics.destroy();
  }

  private buildUI() {
    this.scoreText = this.add
      .text(GAME_WIDTH / 2, 70, "Score: 0", {
        fontSize: "36px",
        fontFamily: "Poppins, Arial, sans-serif",
        color: "#fffef2",
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.best = this.loadBestScore();
    this.bestText = this.add
      .text(GAME_WIDTH / 2, 118, `Best: ${this.best}`, {
        fontSize: "24px",
        fontFamily: "Poppins, Arial, sans-serif",
        color: "#9fb3d8",
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.infoText = this.add
      .text(GAME_WIDTH / 2, 180, "Tap or press space to stay airborne", {
        fontSize: "20px",
        fontFamily: "Poppins, Arial, sans-serif",
        color: "#cddaf4",
      })
      .setOrigin(0.5)
      .setDepth(20);
  }

  private createBall() {
    const container = this.add.container(BALL_X, GAME_HEIGHT / 2);
    const base = this.add.circle(0, 0, BALL_RADIUS, 0xffc94c);
    const shade = this.add.circle(8, 6, BALL_RADIUS * 0.7, 0xf59e0b, 0.9);
    const highlight = this.add.circle(-10, -10, BALL_RADIUS * 0.4, 0xfff4d6, 0.8);
    base.setDepth(9);
    shade.setDepth(9);
    highlight.setDepth(9);
    container.add([shade, base, highlight]);
    container.setDepth(9); // Between back ring (5) and front ring (12)

    this.ballShadow = this.add.ellipse(
      BALL_X + 40,
      GAME_HEIGHT - 110,
      BALL_RADIUS * 1.4,
      BALL_RADIUS * 0.5,
      0x000000,
      0.25
    );
    this.ballShadow.setDepth(3);

    this.ballContainer = container;
    this.velocityY = 0;
    this.currentGravity = INITIAL_GRAVITY;
  }

  private spawnInitialHoops() {
    // Start with a single hoop so the next one only appears once the current is cleared.
    this.spawnHoop(INITIAL_HOOP_LEAD);
  }

  private spawnHoop(offsetX = 0) {
    const x = GAME_WIDTH + (offsetX || 0);
    const y = Phaser.Math.Between(220, GAME_HEIGHT - 200);
    const outerRadius = 100;
    const innerRadiusX = 58;
    const innerRadiusY = 38; // Matches new SVG geometry

    const container = this.add.container(x, y).setDepth(8);

    // Back part of ring (behind ball) - depth 5, positioned in world space
    const backSprite = this.add.image(x, y, "hoop-city-ring-back");
    backSprite.setDisplaySize(240, 100);
    backSprite.setDepth(5);

    // Front part of ring (in front of ball) - depth 12, positioned in world space
    const frontSprite = this.add.image(x, y, "hoop-city-ring-front");
    frontSprite.setDisplaySize(240, 100);
    frontSprite.setDepth(12);

    const hoop: HoopEntity = {
      container,
      backSprite,
      frontSprite,
      outerRadius,
      innerRadiusX,
      innerRadiusY,
      scored: false,
      nextQueued: false,
      touched: false,
      inside: false,
      everInside: false,
      canResetPosition: false,
    };
    this.hoops.push(hoop);
  }

  private handleLift() {
    if (this.isGameOver) return;
    if (!this.started) {
      this.started = true;
      this.infoText.setVisible(false);
    }
    // Apply upward velocity instantly without any conflicting tweens
    this.velocityY = -LIFT_FORCE;
  }

  private updateBall(dt: number) {
    this.currentGravity = Math.min(MAX_GRAVITY, this.currentGravity + GRAVITY_RAMP * dt);
    this.velocityY += this.currentGravity * dt;
    this.ballContainer.y += this.velocityY * dt;

    // Only reset horizontal position after the current hoop has passed
    const activeHoop = this.hoops[0];
    if (activeHoop?.canResetPosition && Math.abs(this.ballContainer.x - BALL_X) > 2) {
      this.ballContainer.x = Phaser.Math.Linear(this.ballContainer.x, BALL_X, 0.08);
    }

    this.ballShadow.x = Phaser.Math.Linear(this.ballShadow.x, this.ballContainer.x + 40, 0.15);
    const clampedShadowY = Phaser.Math.Clamp(
      this.ballContainer.y + 160,
      GAME_HEIGHT - 220,
      GAME_HEIGHT - 80
    );
    this.ballShadow.y = Phaser.Math.Linear(this.ballShadow.y, clampedShadowY, 0.2);
    this.ballShadow.scaleX = Phaser.Math.Clamp(1 - (this.ballContainer.y - 200) / 900, 0.3, 1);
    this.ballShadow.scaleY = this.ballShadow.scaleX;

    if (this.ballContainer.y - BALL_RADIUS <= 0) {
      this.ballContainer.y = BALL_RADIUS;
      this.triggerGameOver();
      return;
    }
    if (this.ballContainer.y + BALL_RADIUS >= GAME_HEIGHT) {
      this.ballContainer.y = GAME_HEIGHT - BALL_RADIUS;
      this.triggerGameOver();
    }
  }

  private updateHoops(dt: number) {
    for (const hoop of this.hoops) {
      hoop.container.x -= HOOP_SPEED * dt;

      // Update absolute positions of back and front sprites for proper depth
      hoop.backSprite.x = hoop.container.x;
      hoop.backSprite.y = hoop.container.y;
      hoop.frontSprite.x = hoop.container.x;
      hoop.frontSprite.y = hoop.container.y;

      // Ensure depths are maintained (Back < Ball < Front)
      hoop.backSprite.setDepth(5);
      hoop.frontSprite.setDepth(12);

      const dx = this.ballContainer.x - hoop.container.x;
      const dy = this.ballContainer.y - hoop.container.y;

      // Collision only on left and right edges (the visible rim sides in 2D view)
      const rimEdgeWidth = 24; // Width of collision zone at each edge
      const leftEdgeX = -hoop.outerRadius + 10; // Left edge position relative to hoop center
      const rightEdgeX = hoop.outerRadius - 10; // Right edge position relative to hoop center

      // Check if ball is near left edge
      const leftEdgeDx = dx - leftEdgeX;
      const leftEdgeDistance = Math.sqrt(leftEdgeDx * leftEdgeDx + dy * dy);

      if (leftEdgeDistance < rimEdgeWidth + BALL_RADIUS) {
        // Bounce off left edge
        const angle = Math.atan2(dy, leftEdgeDx);
        const bounceStrength = 0.5;
        this.velocityY = Math.sin(angle) * Math.abs(this.velocityY) * bounceStrength;
        // Push ball away
        const pushDist = rimEdgeWidth + BALL_RADIUS + 3;
        this.ballContainer.x = hoop.container.x + leftEdgeX + Math.cos(angle) * pushDist;
        this.ballContainer.y = hoop.container.y + Math.sin(angle) * pushDist;
        this.playRimBounceEffect(hoop);

        if (!hoop.touched) {
          hoop.touched = true;
          this.currentMultiplier = 1; // Reset combo on touch
        }
      }

      // Check if ball is near right edge
      const rightEdgeDx = dx - rightEdgeX;
      const rightEdgeDistance = Math.sqrt(rightEdgeDx * rightEdgeDx + dy * dy);

      if (rightEdgeDistance < rimEdgeWidth + BALL_RADIUS) {
        // Bounce off right edge
        const angle = Math.atan2(dy, rightEdgeDx);
        const bounceStrength = 0.5;
        this.velocityY = Math.sin(angle) * Math.abs(this.velocityY) * bounceStrength;
        // Push ball away
        const pushDist = rimEdgeWidth + BALL_RADIUS + 3;
        this.ballContainer.x = hoop.container.x + rightEdgeX + Math.cos(angle) * pushDist;
        this.ballContainer.y = hoop.container.y + Math.sin(angle) * pushDist;
        this.playRimBounceEffect(hoop);

        if (!hoop.touched) {
          hoop.touched = true;
          this.currentMultiplier = 1; // Reset combo on touch
        }
      }

      if (!hoop.nextQueued && hoop.container.x <= this.ballContainer.x + 120) {
        hoop.nextQueued = true;
        // Add a larger delay/gap between hoops
        this.spawnHoop(Phaser.Math.Between(350, 550));
      }

      // Determine whether ball center is inside the hoop's inner ellipse
      const nx = dx / hoop.innerRadiusX;
      const ny = dy / hoop.innerRadiusY;
      const insideEllipse = nx * nx + ny * ny <= 1;

      // Track entering the inner opening
      if (!hoop.inside && insideEllipse) {
        hoop.inside = true;
        hoop.everInside = true;
      } else if (hoop.inside && !insideEllipse) {
        // Ball just exited the inner ellipse - score immediately!
        if (!hoop.scored) {
          hoop.scored = true;
          const points = this.currentMultiplier;
          this.incrementScore(points);
          this.showScorePopup(this.ballContainer.x, this.ballContainer.y - 50, points);
          this.playHoopScoreEffect(hoop);
          if (!hoop.touched) this.currentMultiplier++;
        }
        hoop.inside = false;
      }

      // Mark hoop as allowing position reset once it fully passes the ball
      if (
        hoop.scored &&
        !hoop.canResetPosition &&
        hoop.container.x < this.ballContainer.x - hoop.innerRadiusX
      ) {
        hoop.canResetPosition = true;
      }

      // If the hoop's inner opening has fully passed the ball horizontally and we were never inside, it's a miss
      if (
        !hoop.scored &&
        !hoop.everInside &&
        hoop.container.x + hoop.innerRadiusX < this.ballContainer.x - 1
      ) {
        this.triggerGameOver();
        return;
      }
    }

    this.hoops = this.hoops.filter((hoop) => {
      if (hoop.container.x < -hoop.outerRadius * 2) {
        hoop.backSprite.destroy();
        hoop.frontSprite.destroy();
        hoop.container.destroy();
        return false;
      }
      return true;
    });
  }

  private updateBackground(dt: number) {
    if (this.skyline) {
      this.skyline.tilePositionX += BACKGROUND_SCROLL * dt;
    }
    if (this.clouds) {
      this.clouds.tilePositionX += BACKGROUND_SCROLL * 0.5 * dt;
    }
  }

  private incrementScore(points: number = 1) {
    this.score += points;
    this.scoreText.setText(`Score: ${this.score}`);
    if (this.score > this.best) {
      this.best = this.score;
      this.bestText.setText(`Best: ${this.best}`);
      this.saveBestScore();
    }
  }

  private showScorePopup(x: number, y: number, points: number) {
    const text = this.add
      .text(x, y, `+${points}`, {
        fontSize: "48px",
        fontFamily: "Poppins, Arial, sans-serif",
        color: "#ffcc00",
        stroke: "#000000",
        strokeThickness: 4,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.tweens.add({
      targets: text,
      y: y - 80,
      alpha: 0,
      scale: 1.5,
      duration: 800,
      ease: "Back.easeOut",
      onComplete: () => text.destroy(),
    });
  }

  private playHoopScoreEffect(hoop: HoopEntity) {
    this.tweens.add({
      targets: [hoop.backSprite, hoop.frontSprite],
      scaleX: 1.08,
      scaleY: 1.08,
      alpha: 0.85,
      yoyo: true,
      duration: 180,
      ease: "Sine.easeOut",
    });
    const sparkle = this.add
      .circle(hoop.container.x, hoop.container.y, 10, 0xffffff, 0.8)
      .setDepth(12);
    this.tweens.add({
      targets: sparkle,
      scale: 0,
      alpha: 0,
      duration: 300,
      onComplete: () => sparkle.destroy(),
    });
  }

  private playRimBounceEffect(hoop: HoopEntity) {
    const hit = this.add.graphics({ x: hoop.container.x, y: hoop.container.y });
    hit.setDepth(12);
    hit.lineStyle(3, 0xfff7ae, 1);
    hit.strokeEllipse(0, 0, hoop.outerRadius * 2, hoop.outerRadius * 0.7);
    this.tweens.add({
      targets: hit,
      alpha: 0,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 220,
      onComplete: () => hit.destroy(),
    });
  }

  private triggerGameOver() {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.tweens.add({
      targets: [this.ballContainer],
      alpha: 0.3,
      duration: 300,
      ease: "Sine.easeOut",
    });

    const overlay = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x010205, 0.7)
      .setDepth(50);
    const message = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "Game Over", {
        fontSize: "48px",
        color: "#fff3c4",
        fontFamily: "Poppins, Arial, sans-serif",
      })
      .setOrigin(0.5)
      .setDepth(51);

    this.time.delayedCall(300, () => {
      dispatchGameOver({ gameId: GAME_ID, score: this.score, ts: Date.now() });
    });

    this.input.once("pointerdown", () => {
      overlay.destroy();
      message.destroy();
    });
  }

  private loadBestScore() {
    try {
      const stored = window.localStorage?.getItem(BEST_KEY);
      return stored ? Number(stored) || 0 : 0;
    } catch {
      return 0;
    }
  }

  private saveBestScore() {
    try {
      window.localStorage?.setItem(BEST_KEY, String(this.best));
    } catch {
      // ignore storage failures
    }
  }
}
