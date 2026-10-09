import Phaser from "phaser";
import { BasePlatformScene } from "../../../platform/scenes/BasePlatformScene";
import { tapZones } from "../../../platform/input";
import {
  approach,
  comboNext,
  gravityAt,
  HOOP_SPEED,
  nextHoop,
  passQuality,
  pointsFor,
  type PassQuality,
} from "../useCases/rules";

const GAME_WIDTH = 540;
const GAME_HEIGHT = 960;

const BALL_X = GAME_WIDTH * 0.32;
const BALL_START_Y = GAME_HEIGHT / 2;
const BALL_RADIUS = 31;
const LIFT_FORCE = 520; // upward speed (px/s) a tap gives the ball
/** The ball's top stops here: the HUD lives above it. */
const CEILING_Y = 140;
/** Longest frame step the physics takes, so a hitch can't tunnel the ball through a rim. */
const MAX_DT = 0.05;

const INITIAL_HOOP_LEAD = 520; // how far past the right edge the first hoop waits
const QUEUE_NEXT_AT = 120; // queue the next hoop once this one is this close to the ball
const BACKGROUND_SCROLL = 55;

// Ring geometry, matching the 240 × 100 ring SVGs.
const RING_W = 240;
const RING_H = 100;
const RING_OUTER = 100;
const RING_INNER_X = 58;
const RING_INNER_Y = 38;
const RIM_EDGE_X = RING_OUTER - 10; // the solid rim ends, either side of the centre
const RIM_RADIUS = 24;
const RIM_BOUNCE = 0.5;

const DEPTH_RING_BACK = 5;
const DEPTH_BALL = 9;
const DEPTH_RING_FRONT = 12;
const DEPTH_HINT = 20;

interface Hoop {
  x: number;
  y: number;
  back: Phaser.GameObjects.Image;
  front: Phaser.GameObjects.Image;
  scored: boolean;
  nextQueued: boolean;
  touched: boolean;
  inside: boolean;
  /** Ball x minus ring x when the ball entered the opening. */
  entryOffset: number;
}

export default class HoopCityScene extends BasePlatformScene {
  private rng: () => number = Math.random;
  private skyline!: Phaser.GameObjects.TileSprite;
  private clouds!: Phaser.GameObjects.TileSprite;
  private ball!: Phaser.GameObjects.Container;
  private ballShadow!: Phaser.GameObjects.Ellipse;
  private hint: Phaser.GameObjects.Container | null = null;
  private velocityY = 0;
  /** Play time since the first tap (pauses excluded): drives gravity. */
  private elapsedMs = 0;
  /** Time spent waiting for the first tap: drives the idle bob. */
  private idleMs = 0;
  private started = false;
  private hoops: Hoop[] = [];
  private score = 0;
  private combo = 1;
  /** Remix knobs (T11.2), read each run; 1 is the normal game. */
  private gravityScale = 1;
  private gapScale = 1;

  constructor() {
    super("HoopCityScene");
  }

  preload() {
    this.load.svg("hoop-city-ring-back", "/assets/hoop-city/ring-back.svg", { scale: 1 });
    this.load.svg("hoop-city-ring-front", "/assets/hoop-city/ring-front.svg", { scale: 1 });
  }

  protected startRun() {
    // The scene object survives restarts: reset every per-run field first.
    this.rng = this.host.rng();
    this.gravityScale = this.host.remix.get("gravity");
    this.gapScale = this.host.remix.get("ringGap");
    this.velocityY = 0;
    this.elapsedMs = 0;
    this.idleMs = 0;
    this.started = false;
    this.hoops = [];
    this.score = 0;
    this.combo = 1;
    this.hint = null;

    this.buildBackground();
    this.createBall();
    this.createHint();
    this.spawnHoop(INITIAL_HOOP_LEAD);

    this.hud.setScore(0);
    this.hud.setBest(this.host.best.get());

    tapZones(this, { count: 1, onTap: () => this.lift() });
  }

  update(_time: number, delta: number) {
    if (this.runEnded) return;
    const dt = Math.min(delta / 1000, MAX_DT);
    this.updateBackground(dt);

    if (!this.started) {
      // Float gently until the first tap; no gravity, no hoops moving.
      this.idleMs += delta;
      this.ball.y = BALL_START_Y + Math.sin(this.idleMs / 300) * 12;
      this.updateShadow(dt);
      return;
    }

    this.elapsedMs += delta;
    this.updateBall(dt);
    if (this.runEnded) return;
    this.updateHoops(dt);
  }

  private lift() {
    if (this.runEnded) return;
    if (!this.started) {
      this.started = true;
      this.hideHint();
    }
    this.velocityY = -LIFT_FORCE;
    this.host.audio.pop();
  }

  // --- Building the scene -------------------------------------------------

  private buildBackground() {
    this.createSkyTexture();
    this.createSkylineTexture();

    this.clouds = this.add
      .tileSprite(0, 240, GAME_WIDTH, 200, "hoop-city-clouds")
      .setOrigin(0, 0.5)
      .setDepth(1);

    // Scenery only: the ball passes in front of the buildings.
    this.skyline = this.add
      .tileSprite(0, GAME_HEIGHT - 220, GAME_WIDTH, 280, "hoop-city-skyline")
      .setOrigin(0, 0.5)
      .setDepth(2);
  }

  /** Textures live in the game, not the scene, so they're drawn once and reused on restart. */
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
    for (let i = 0; i < 20; i++) {
      const width = Phaser.Math.Between(20, 60);
      const height = Phaser.Math.Between(60, 240);
      const x = Phaser.Math.Between(0, 512 - width);
      const y = 280 - height;
      graphics.fillStyle(0x0f223d, 1);
      graphics.fillRect(x, y, width, height);
      graphics.fillStyle(0x1c355c, 0.6);
      for (let win = 0; win < 6; win++) {
        const winX = x + Phaser.Math.Between(4, width - 8);
        const winY = y + Phaser.Math.Between(6, height - 12);
        graphics.fillRect(winX, winY, 4, 6);
      }
    }
    graphics.generateTexture("hoop-city-skyline", 512, 280);
    graphics.destroy();
  }

  private createBall() {
    const shade = this.add.circle(8, 6, BALL_RADIUS * 0.7, 0xf59e0b, 0.9);
    const base = this.add.circle(0, 0, BALL_RADIUS, 0xffc94c);
    const highlight = this.add.circle(-10, -10, BALL_RADIUS * 0.4, 0xfff4d6, 0.8);
    // Between the back of the ring and its front, so the ball goes through it.
    this.ball = this.add
      .container(BALL_X, BALL_START_Y, [shade, base, highlight])
      .setDepth(DEPTH_BALL);

    this.ballShadow = this.add
      .ellipse(BALL_X + 40, GAME_HEIGHT - 110, BALL_RADIUS * 1.4, BALL_RADIUS * 0.5, 0x000000, 0.25)
      .setDepth(3);
  }

  private createHint() {
    const { fonts, colors } = this.host;
    const y = BALL_START_Y + 130;
    const title = this.add
      .text(GAME_WIDTH / 2, y, "Tap to start", {
        fontFamily: fonts.display,
        fontSize: "48px",
        fontStyle: "800",
        color: colors.sun,
        stroke: colors.ink,
        strokeThickness: 8,
      })
      .setOrigin(0.5);
    const sub = this.add
      .text(GAME_WIDTH / 2, y + 56, "Tap to bounce up.\nDrop the ball through every hoop!", {
        fontFamily: fonts.body,
        fontSize: "22px",
        color: colors.paper,
        align: "center",
        stroke: colors.ink,
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0);
    this.hint = this.add.container(0, 0, [title, sub]).setDepth(DEPTH_HINT);
    this.tweens.add({
      targets: title,
      scale: 1.08,
      yoyo: true,
      repeat: -1,
      duration: 600,
      ease: "Sine.InOut",
    });
  }

  private hideHint() {
    const hint = this.hint;
    if (!hint) return;
    this.hint = null;
    this.tweens.killTweensOf(hint.list);
    this.tweens.add({
      targets: hint,
      alpha: 0,
      duration: 200,
      onComplete: () => hint.destroy(),
    });
  }

  private spawnHoop(offsetX: number) {
    const { gap, y } = nextHoop(this.rng, this.gapScale);
    const x = GAME_WIDTH + (offsetX || gap);
    const back = this.add
      .image(x, y, "hoop-city-ring-back")
      .setDisplaySize(RING_W, RING_H)
      .setDepth(DEPTH_RING_BACK);
    const front = this.add
      .image(x, y, "hoop-city-ring-front")
      .setDisplaySize(RING_W, RING_H)
      .setDepth(DEPTH_RING_FRONT);
    this.hoops.push({
      x,
      y,
      back,
      front,
      scored: false,
      nextQueued: false,
      touched: false,
      inside: false,
      entryOffset: 0,
    });
  }

  // --- Per frame ----------------------------------------------------------

  private updateBall(dt: number) {
    this.velocityY += gravityAt(this.elapsedMs, this.gravityScale) * dt;
    this.ball.y += this.velocityY * dt;

    // A rim bounce can nudge the ball sideways; drift back once no ring is near.
    const nearRing = this.hoops.some((h) => Math.abs(h.x - this.ball.x) < RING_OUTER + BALL_RADIUS);
    if (!nearRing) this.ball.x = approach(this.ball.x, BALL_X, 0.08, dt);

    if (this.ball.y - BALL_RADIUS < CEILING_Y) {
      this.ball.y = CEILING_Y + BALL_RADIUS;
      this.velocityY = Math.max(0, this.velocityY);
    }
    this.updateShadow(dt);

    if (this.ball.y + BALL_RADIUS >= GAME_HEIGHT) {
      this.ball.y = GAME_HEIGHT - BALL_RADIUS;
      this.gameOver();
    }
  }

  private updateShadow(dt: number) {
    const shadow = this.ballShadow;
    shadow.x = approach(shadow.x, this.ball.x + 40, 0.15, dt);
    const targetY = Phaser.Math.Clamp(this.ball.y + 160, GAME_HEIGHT - 220, GAME_HEIGHT - 80);
    shadow.y = approach(shadow.y, targetY, 0.2, dt);
    shadow.setScale(Phaser.Math.Clamp(1 - (this.ball.y - 200) / 900, 0.3, 1));
  }

  private updateHoops(dt: number) {
    // Iterate a copy: queuing the next hoop adds to the list.
    for (const hoop of [...this.hoops]) {
      hoop.x -= HOOP_SPEED * dt;
      hoop.back.x = hoop.x;
      hoop.front.x = hoop.x;

      this.collideRim(hoop, -RIM_EDGE_X);
      this.collideRim(hoop, RIM_EDGE_X);

      if (!hoop.nextQueued && hoop.x <= this.ball.x + QUEUE_NEXT_AT) {
        hoop.nextQueued = true;
        this.spawnHoop(0);
      }

      // Is the ball's centre inside the ring's opening?
      const dx = this.ball.x - hoop.x;
      const dy = this.ball.y - hoop.y;
      const nx = dx / RING_INNER_X;
      const ny = dy / RING_INNER_Y;
      const inside = nx * nx + ny * ny <= 1;
      if (inside && !hoop.inside) {
        hoop.inside = true;
        hoop.entryOffset = dx;
      } else if (!inside && hoop.inside) {
        hoop.inside = false;
        // Judge the pass on where the ball was mid-way through the opening.
        if (!hoop.scored) this.scorePass(hoop, (hoop.entryOffset + dx) / 2);
      }

      // The opening has gone past the ball without a pass: that's a miss.
      if (!hoop.scored && hoop.x + RING_INNER_X < this.ball.x - 1) {
        this.gameOver();
        return;
      }
    }

    this.hoops = this.hoops.filter((hoop) => {
      if (hoop.x > -RING_OUTER * 2) return true;
      hoop.back.destroy();
      hoop.front.destroy();
      return false;
    });
  }

  /** Bounce the ball off one solid end of the rim (`edgeX` from the ring centre). */
  private collideRim(hoop: Hoop, edgeX: number) {
    const ex = this.ball.x - (hoop.x + edgeX);
    const ey = this.ball.y - hoop.y;
    const reach = RIM_RADIUS + BALL_RADIUS;
    if (ex * ex + ey * ey >= reach * reach) return;

    const angle = Math.atan2(ey, ex);
    this.velocityY = Math.sin(angle) * Math.abs(this.velocityY) * RIM_BOUNCE;
    const push = reach + 3;
    this.ball.x = hoop.x + edgeX + Math.cos(angle) * push;
    this.ball.y = hoop.y + Math.sin(angle) * push;
    this.playRimBounceEffect(hoop);
    if (!hoop.touched) {
      hoop.touched = true;
      this.host.audio.thud();
    }
  }

  private updateBackground(dt: number) {
    this.skyline.tilePositionX += BACKGROUND_SCROLL * dt;
    this.clouds.tilePositionX += BACKGROUND_SCROLL * 0.5 * dt;
  }

  // --- Scoring and the end ------------------------------------------------

  private scorePass(hoop: Hoop, offset: number) {
    const quality: PassQuality = passQuality(
      hoop.x + offset,
      hoop.x,
      RING_INNER_X * 2,
      hoop.touched,
    );
    if (quality === "miss") return;

    hoop.scored = true;
    const points = pointsFor(this.combo, quality);
    this.combo = comboNext(this.combo, quality);
    this.score += points;
    this.hud.setScore(this.score);

    const { colors } = this.host;
    const perfect = quality === "perfect";
    this.hud.popup(
      perfect ? `Perfect! +${points}` : `+${points}`,
      this.ball.x,
      Math.max(CEILING_Y + 60, this.ball.y - 60), // keep it clear of the HUD
      perfect ? colors.sun : colors.paper,
    );
    this.host.audio.play("score");
    if (perfect) this.host.haptics.success();
    this.playHoopScoreEffect(hoop);
  }

  private playHoopScoreEffect(hoop: Hoop) {
    this.tweens.add({
      targets: [hoop.back, hoop.front],
      scaleX: hoop.front.scaleX * 1.08,
      scaleY: hoop.front.scaleY * 1.08,
      alpha: 0.85,
      yoyo: true,
      duration: 180,
      ease: "Sine.easeOut",
    });
    const sparkle = this.add.circle(hoop.x, hoop.y, 10, 0xffffff, 0.8).setDepth(DEPTH_RING_FRONT);
    this.tweens.add({
      targets: sparkle,
      scale: 0,
      alpha: 0,
      duration: 300,
      onComplete: () => sparkle.destroy(),
    });
  }

  private playRimBounceEffect(hoop: Hoop) {
    const hit = this.add.graphics({ x: hoop.x, y: hoop.y }).setDepth(DEPTH_RING_FRONT);
    hit.lineStyle(3, 0xfff7ae, 1);
    hit.strokeEllipse(0, 0, RING_OUTER * 2, RING_OUTER * 0.7);
    this.tweens.add({
      targets: hit,
      alpha: 0,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 220,
      onComplete: () => hit.destroy(),
    });
  }

  private gameOver() {
    if (this.runEnded) return;
    this.tweens.add({ targets: this.ball, alpha: 0.3, duration: 300, ease: "Sine.easeOut" });
    this.endRun(this.score);
  }
}
