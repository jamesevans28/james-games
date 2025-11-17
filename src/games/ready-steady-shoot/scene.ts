import Phaser from "phaser";
import { dispatchGameOver } from "../../utils/gameEvents";

// Utility types
type ShotState = "angle" | "power" | "lift" | "flying" | "idle" | "over";

export default class ReadySteadyShootGame extends Phaser.Scene {
  private state: ShotState = "angle";
  private ball!: Phaser.Physics.Arcade.Image;
  private rim!: Phaser.Physics.Arcade.StaticGroup;
  private rimLeft!: Phaser.Physics.Arcade.Image;
  private rimRight!: Phaser.Physics.Arcade.Image;
  private rimLeftCollider?: Phaser.Physics.Arcade.Collider;
  private rimRightCollider?: Phaser.Physics.Arcade.Collider;
  private hoopPassZone!: Phaser.GameObjects.Zone;

  // Hoop layout constants (kept on instance so graphics and physics stay in sync)
  private hoopX: number = 420;
  private hoopY: number = 680; // raised slightly
  private rimRadius: number = 24;
  private boardW: number = 18;
  private boardH: number = 140;

  private backboard!: Phaser.Physics.Arcade.StaticGroup;
  private hoopSensor!: Phaser.GameObjects.Zone; // net area for swish check
  private ground!: Phaser.Physics.Arcade.StaticGroup;

  private stick!: Phaser.GameObjects.Graphics;
  private hoopGfx!: Phaser.GameObjects.Graphics;
  private bgGfx!: Phaser.GameObjects.Graphics;

  private angleArrow!: Phaser.GameObjects.Graphics;
  private powerBarBg!: Phaser.GameObjects.Graphics;
  private powerBarFill!: Phaser.GameObjects.Graphics;

  private angleRad: number = Phaser.Math.DegToRad(30); // initial 30deg up
  private power: number = 0; // 0..1
  private angleSelecting: boolean = false; // true when user is holding to select angle
  private powerSelecting: boolean = false; // true when user is holding to select power

  // Shot speed limits (tuned to prevent limp or wildly overpowered shots)
  // Units match Phaser Arcade velocity (px/sec). Adjust if tuning needed.
  private MIN_SHOT_SPEED: number = 1100;
  private MAX_SHOT_SPEED: number = 1500;

  private score: number = 0;
  private best: number = 0;
  private lives: number = 3;

  private swishCandidate: boolean = true; // becomes false when rim/backboard touched during flight
  // Track whether the ball rose above the hoop during this flight; used to ensure
  // we only score when the ball actually passes through the hoop from above.
  private ballWasAboveHoop: boolean = false;

  constructor() {
    super("ReadySteadyShoot");
  }

  preload() {}

  create() {
    // Generate simple textures used for physics (1x1 px) and the ball sprite
    const gfx = this.add.graphics({ x: 0, y: 0 }).setVisible(false);
    // 1x1 white pixel for invisible static bodies
    gfx.fillStyle(0xffffff, 1);
    gfx.fillRect(0, 0, 2, 2);
    gfx.generateTexture("px", 2, 2);
    // Ball texture (28x28 circle)
    gfx.clear();
    gfx.fillStyle(0xf97316, 1);
    gfx.fillCircle(14, 14, 14);
    gfx.lineStyle(2, 0x000000, 1);
    gfx.strokeCircle(14, 14, 14);
    // Basketball lines
    gfx.strokeLineShape(new Phaser.Geom.Line(14, 0, 14, 28)); // vertical center
    gfx.strokeLineShape(new Phaser.Geom.Line(0, 14, 28, 14)); // horizontal center
    // Curved lines using arc
    gfx.beginPath();
    gfx.arc(14, 14, 14, Phaser.Math.DegToRad(-45), Phaser.Math.DegToRad(45), false);
    gfx.strokePath();
    gfx.beginPath();
    gfx.arc(14, 14, 14, Phaser.Math.DegToRad(135), Phaser.Math.DegToRad(225), false);
    gfx.strokePath();
    gfx.generateTexture("ball", 28, 28);
    gfx.destroy();

    // Background court
    this.bgGfx = this.add.graphics();
    this.drawBackground();

    // Hoop and backboard (right side, opposite player)
    this.hoopGfx = this.add.graphics();
    this.hoopGfx.setDepth(1); // middle depth
    const hoopX = this.hoopX;
    const hoopY = this.hoopY; // lowered slightly
    const rimRadius = this.rimRadius;
    const boardW = this.boardW;
    const boardH = this.boardH; // taller to allow rim lower visually

    // Physics bodies for rim - two side colliders leaving a center gap so ball can drop through
    this.rim = this.physics.add.staticGroup();
    this.rimLeft = this.physics.add
      .staticImage(hoopX - rimRadius + 6, hoopY, "px")
      .setOrigin(0.5)
      .setVisible(false);
    this.rimLeft.setSize(rimRadius - 8, 6);
    this.rimRight = this.physics.add
      .staticImage(hoopX + rimRadius - 6, hoopY, "px")
      .setOrigin(0.5)
      .setVisible(true);
    this.rimRight.setSize(rimRadius - 8, 6);
    this.rim.add(this.rimLeft);
    this.rim.add(this.rimRight);

    this.backboard = this.physics.add.staticGroup();
    const board = this.physics.add
      .staticImage(hoopX + rimRadius + boardW / 2 + 4, hoopY - boardH / 2 - 10, "px")
      .setSize(boardW, boardH)
      .setOrigin(0.5)
      .setVisible(true);
    this.backboard.add(board);

    // Hoop sensor (net pass-through area) — use a Zone with overlap detection
    this.hoopSensor = this.add.zone(hoopX, hoopY + 14, rimRadius * 2 - 6, 12).setOrigin(0.5);
    this.physics.add.existing(this.hoopSensor, true);

    // Ground to stop ball falling forever - below player
    this.ground = this.physics.add.staticGroup();
    const ground = this.physics.add
      .staticImage(270, 950, "px")
      .setSize(540, 10)
      .setOrigin(0.5)
      .setVisible(false);
    this.ground.add(ground);

    // Ball at left stick figure - disable physics until shot
    this.ball = this.physics.add
      .image(120, 860, "ball")
      .setCircle(14)
      .setBounce(0.75, 0.7)
      .setCollideWorldBounds(true)
      .setDamping(false)
      .setDrag(0.5, 0)
      .setDepth(2)
      .setVisible(false); // hidden until lift/shoot

    // Disable physics initially
    this.ball.body!.enable = false;

    // Draw stick figure (left)
    this.stick = this.add.graphics();
    this.drawStickFigure();

    // Angle arrow & power bar
    this.angleArrow = this.add.graphics();
    this.powerBarBg = this.add.graphics();
    this.powerBarFill = this.add.graphics();
    this.layoutUI();

    // Text HUD
    this.best = Number(localStorage.getItem("ready-steady-shoot-best") || 0) || 0;
    this.scoreText = this.add.text(20, 20, "Score: 0", {
      fontFamily: "Fredoka, sans-serif",
      fontSize: "18px",
      color: "#000",
    });
    this.bestText = this.add
      .text(520, 20, `Best: ${this.best}`, {
        fontFamily: "Fredoka, sans-serif",
        fontSize: "18px",
        color: "#000",
      })
      .setOrigin(1, 0);

    // Lives (bigger basketballs)
    this.livesGroup = this.add.group();
    this.drawLives();

    // Colliders (individual rim edges so we can selectively disable them)
    this.rimLeftCollider = this.physics.add.collider(this.ball, this.rimLeft, () => {
      this.swishCandidate = false;
      const body = this.ball.body as Phaser.Physics.Arcade.Body;
      const dx = this.ball.x - this.hoopX;
      body.velocity.x += dx * 4;
      body.velocity.y *= 0.85;
      body.velocity.x *= 0.95;
    });
    this.rimRightCollider = this.physics.add.collider(this.ball, this.rimRight, () => {
      this.swishCandidate = false;
      const body = this.ball.body as Phaser.Physics.Arcade.Body;
      const dx = this.ball.x - this.hoopX;
      body.velocity.x += dx * 4;
      body.velocity.y *= 0.85;
      body.velocity.x *= 0.95;
    });
    this.physics.add.collider(this.ball, this.backboard, () => {
      this.swishCandidate = false;
      const body = this.ball.body as Phaser.Physics.Arcade.Body;
      body.velocity.x = -Math.abs(body.velocity.x) * 0.75;
      body.velocity.y *= 0.92;
    });
    this.physics.add.collider(this.ball, this.ground, () => {
      // When ball hits ground after shot, consider it a miss unless we've scored already.
      if (this.state === "flying") {
        this.onMiss();
      }
    });

    // Overlap through hoop sensor (ball center passes through net area while falling)
    this.physics.add.overlap(this.ball, this.hoopSensor as any, () => {
      // Only award score when the ball was previously above the hoop and is now
      // falling through the hoop (prevents scoring from rim/backboard collisions).
      const body = this.ball.body as Phaser.Physics.Arcade.Body;
      if (
        this.state === "flying" &&
        body.velocity.y! > 0 &&
        this.ballWasAboveHoop &&
        this.ball.y > this.hoopY
      ) {
        // When the ball passes through the rim center, remove horizontal momentum
        // and slow its fall so it drops straight down behind the net.
        // zero horizontal velocity
        body.velocity.x = 0;
        // slow vertical fall (but keep a minimum downward speed)
        body.velocity.y = Math.max(100, body.velocity.y * 0.5);
        // reduce bounciness so it doesn't pop back up
        this.ball.setBounce(0.2, 0.2);
        // add horizontal drag to ensure no leftover sideways motion
        this.ball.setDrag(200, 0);

        // clear the flag so we don't double-score
        this.ballWasAboveHoop = false;

        this.onScore(this.swishCandidate ? 2 : 1);
      }
    });

    // Pass zone above the rim to allow disabling rim colliders momentarily so the ball can fall through
    this.hoopPassZone = this.add
      .zone(this.hoopX, this.hoopY - 6, this.rimRadius * 1.4, 12)
      .setOrigin(0.5);
    this.physics.add.existing(this.hoopPassZone, true);
    this.physics.add.overlap(this.ball, this.hoopPassZone as any, () => {
      if (this.state === "flying" && this.ball.body?.velocity.y! > 0) {
        // disable rim colliders so ball can drop through cleanly
        if (this.rimLeftCollider) this.rimLeftCollider.active = false;
        if (this.rimRightCollider) this.rimRightCollider.active = false;
        this.time.delayedCall(260, () => {
          if (this.rimLeftCollider) this.rimLeftCollider.active = true;
          if (this.rimRightCollider) this.rimRightCollider.active = true;
        });
      }
    });

    // Input flow: tap/hold for angle, release to lock; tap/hold for power, release to shoot.
    this.input.on("pointerdown", this.onPointerDown, this);
    this.input.on("pointerup", this.onPointerUp, this);
  }

  // HUD elements
  private scoreText!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;
  private livesGroup!: Phaser.GameObjects.Group;

  private drawLives() {
    this.livesGroup.clear(true, true);
    for (let i = 0; i < this.lives; i++) {
      const g = this.add.graphics({ x: 220 + i * 32, y: 28 });
      g.fillStyle(0xf97316, 1);
      g.fillCircle(0, 0, 10);
      g.lineStyle(2, 0x000000, 1);
      g.strokeCircle(0, 0, 10);
      // Basketball lines on lives
      g.strokeLineShape(new Phaser.Geom.Line(0, -10, 0, 10));
      g.strokeLineShape(new Phaser.Geom.Line(-10, 0, 10, 0));
      g.beginPath();
      g.arc(0, 0, 10, Phaser.Math.DegToRad(-45), Phaser.Math.DegToRad(45), false);
      g.strokePath();
      g.beginPath();
      g.arc(0, 0, 10, Phaser.Math.DegToRad(135), Phaser.Math.DegToRad(225), false);
      g.strokePath();
      this.livesGroup.add(g);
    }
  }

  private drawBackground() {
    const g = this.bgGfx;
    g.clear();
    // sky
    g.fillStyle(0x7cc7ff, 1);
    g.fillRect(0, 0, 540, 960);
    // sun (lower position)
    g.fillStyle(0xffe066, 1);
    g.fillCircle(80, 180, 32);
    // clouds (lower position)
    g.fillStyle(0xffffff, 1);
    const cloud = (x: number, y: number) => {
      g.fillCircle(x, y, 20);
      g.fillCircle(x + 20, y + 6, 24);
      g.fillCircle(x - 18, y + 8, 18);
    };
    cloud(200, 200);
    cloud(360, 170);

    // concrete court ground - below the player
    g.fillStyle(0x808080, 1);
    g.fillRect(0, 820, 540, 140);

    // painted lines on court
    g.lineStyle(3, 0xffffff, 0.8);
    g.strokeRect(20, 840, 500, 100);
    g.strokeLineShape(new Phaser.Geom.Line(270, 840, 270, 940));
    g.strokeCircle(270, 890, 40);
  }

  private drawStickFigure() {
    const g = this.stick;
    g.clear();
    g.lineStyle(4, 0x000000, 1);

    // Position depends on state
    if (this.state === "angle" || this.state === "power" || this.state === "idle") {
      // Ready position - arm down holding ball
      // head
      g.strokeCircle(90, 832, 18);
      // body
      g.strokeLineShape(new Phaser.Geom.Line(90, 850, 90, 892));
      // arm holding ball
      g.strokeLineShape(new Phaser.Geom.Line(90, 872, 120, 860));
      // legs
      g.strokeLineShape(new Phaser.Geom.Line(90, 892, 75, 922));
      g.strokeLineShape(new Phaser.Geom.Line(90, 892, 105, 922));

      // ball in hand (only in ready pose)
      g.fillStyle(0xf97316, 1);
      g.fillCircle(120, 860, 14);
      g.lineStyle(2, 0x000000, 1);
      g.strokeCircle(120, 860, 14);
    } else if (this.state === "flying") {
      // Shooting position - arm raised (ball is now physics sprite)
      // head
      g.strokeCircle(90, 832, 18);
      // body
      g.strokeLineShape(new Phaser.Geom.Line(90, 850, 90, 892));
      // arm raised up
      g.strokeLineShape(new Phaser.Geom.Line(90, 872, 110, 812));
      // legs
      g.strokeLineShape(new Phaser.Geom.Line(90, 892, 75, 922));
      g.strokeLineShape(new Phaser.Geom.Line(90, 892, 105, 922));
    }
  }

  private layoutUI() {
    // Draw hoop visuals - side-on view with net
    const hoopX = this.hoopX;
    const hoopY = this.hoopY;
    const rimRadius = this.rimRadius;
    const boardW = this.boardW;
    const boardH = this.boardH;
    const g = this.hoopGfx;
    g.clear();

    // Backboard (side view - thin vertical rectangle) - draw based on physics board center so visuals match
    g.lineStyle(6, 0xffffff, 1);
    const boardCenterX = hoopX + rimRadius + boardW / 2 + 4;
    const boardCenterY = hoopY - boardH / 2 - 0;
    const boardTopLeftX = boardCenterX - boardW / 2;
    const boardTopLeftY = boardCenterY - boardH / 2;
    g.strokeRect(boardTopLeftX, boardTopLeftY, boardW, boardH);

    // Backboard pole attachment (thin box going right to screen edge)
    g.fillStyle(0x666666, 1);
    g.fillRect(hoopX + rimRadius + 25, hoopY - 30, 540 - (hoopX + rimRadius + 4), 8); // horizontal bar to right edge
    g.fillRect(540 - 8, hoopY - 30, 8, 60); // vertical pole down at right edge

    // Rim (horizontal line instead of circle)
    g.lineStyle(4, 0xff6600, 1);
    g.strokeLineShape(new Phaser.Geom.Line(hoopX - rimRadius, hoopY, hoopX + rimRadius, hoopY));

    // Net (wider at top, narrower at bottom)
    g.lineStyle(2, 0xffffff, 0.7);
    const netTop = hoopY + 2;
    const netBottom = hoopY + 32;
    const netTopWidth = rimRadius * 2 - 6; // wider at top
    const netBottomWidth = rimRadius * 1.2; // narrower at bottom
    const netTopLeft = hoopX - netTopWidth / 2;
    const netTopRight = hoopX + netTopWidth / 2;
    const netBottomLeft = hoopX - netBottomWidth / 2;
    const netBottomRight = hoopX + netBottomWidth / 2;

    // Vertical net lines (more at top, fewer at bottom)
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const topX = netTopLeft + (netTopRight - netTopLeft) * t;
      const bottomX = netBottomLeft + (netBottomRight - netBottomLeft) * t;
      g.strokeLineShape(new Phaser.Geom.Line(topX, netTop, bottomX, netBottom));
    }

    // Angle arrow
    this.redrawAngleArrow();
    // Power bar
    this.redrawPowerBar();
  }

  private redrawAngleArrow() {
    const g = this.angleArrow;
    g.clear();
    const origin = new Phaser.Math.Vector2(this.ball.x, this.ball.y);
    const len = 140;
    const end = new Phaser.Math.Vector2(
      origin.x + Math.cos(this.angleRad) * len,
      origin.y + Math.sin(this.angleRad) * len
    );

    // Blocky arrow body
    g.fillStyle(0x22c55e, 1);
    const arrowWidth = 16;
    const perpX = (-Math.sin(this.angleRad) * arrowWidth) / 2;
    const perpY = (Math.cos(this.angleRad) * arrowWidth) / 2;

    // Arrow shaft as rectangle
    g.beginPath();
    g.moveTo(origin.x + perpX, origin.y + perpY);
    g.lineTo(origin.x - perpX, origin.y - perpY);
    g.lineTo(end.x - perpX, end.y - perpY);
    g.lineTo(end.x + perpX, end.y + perpY);
    g.closePath();
    g.fillPath();

    // Arrow head as triangle
    const headSize = 24;
    const tipX = end.x + Math.cos(this.angleRad) * headSize;
    const tipY = end.y + Math.sin(this.angleRad) * headSize;
    const perpHeadX = -Math.sin(this.angleRad) * headSize;
    const perpHeadY = Math.cos(this.angleRad) * headSize;

    g.beginPath();
    g.moveTo(end.x + perpHeadX, end.y + perpHeadY);
    g.lineTo(tipX, tipY);
    g.lineTo(end.x - perpHeadX, end.y - perpHeadY);
    g.closePath();
    g.fillPath();
  }

  private redrawPowerBar() {
    const w = 24;
    const h = 200;
    const x = 40;
    const y = 800;
    this.powerBarBg.clear();
    this.powerBarBg.lineStyle(3, 0x000000, 0.8);
    this.powerBarBg.strokeRect(x - w / 2, y - h, w, h);

    this.powerBarFill.clear();
    this.powerBarFill.fillStyle(0x3b82f6, 1);
    const filled = h * this.power;
    this.powerBarFill.fillRect(x - w / 2 + 2, y - filled, w - 4, filled - 2);
  }

  private onPointerDown = () => {
    if (this.state === "over") return;
    if (this.state === "idle") this.state = "angle";
    if (this.state === "angle") {
      this.angleSelecting = true;
    } else if (this.state === "power") {
      this.powerSelecting = true;
    }
  };

  private onPointerUp = () => {
    if (this.state === "angle") {
      this.angleSelecting = false;
      // Lock angle and move to power selection
      this.state = "power";
    } else if (this.state === "power") {
      this.powerSelecting = false;
      // Lock power and shoot
      this.shoot();
    }
  };

  private shoot() {
    if (this.state === "over") return;
    // Begin lift animation
    this.state = "lift";
    this.ball.setVisible(true);
    // Start at hand (matching ready pose coordinates)
    this.ball.setPosition(120, 860);
    this.tweens.add({
      targets: this.ball,
      x: 110,
      y: 812,
      duration: 180,
      ease: "Quad.easeOut",
      onUpdate: () => {
        // redraw arrow to follow ball during lift (if angle/power phase visuals desired to hide after shot we could clear later)
      },
      onComplete: () => {
        // Now fire from EXACT lifted position
        // Compute base velocity from angle + power, then add a small sideways randomness.
        const baseSpeed = 3600 * this.power;
        let vx = Math.cos(this.angleRad) * baseSpeed;
        let vy = Math.sin(this.angleRad) * baseSpeed;
        const sidewaysBoost = 50 + Math.random() * 100;
        const sidewaysDir = Math.random() > 0.5 ? 1 : -1;
        vx = vx + sidewaysBoost * sidewaysDir;

        // Clamp shot magnitude to configured min/max to avoid limp or wildly powerful shots.
        const mag = Math.hypot(vx, vy);
        if (mag > 0) {
          if (mag < this.MIN_SHOT_SPEED) {
            const scale = this.MIN_SHOT_SPEED / mag;
            vx *= scale;
            vy *= scale;
          } else if (mag > this.MAX_SHOT_SPEED) {
            const scale = this.MAX_SHOT_SPEED / mag;
            vx *= scale;
            vy *= scale;
          }
        }

        this.ball.body!.enable = true;
        this.ball.setVelocity(vx, vy);
        this.swishCandidate = true;
        // Reset the above-hoop flag for this new flight; it will be set to true
        // if/when the ball rises above the hoop during its trajectory.
        this.ballWasAboveHoop = false;
        this.state = "flying";
        // Remove hand-drawn ball (stick figure will no longer render ball in flying state)
        this.drawStickFigure();
      },
    });
  }

  private onScore(points: number) {
    // Prevent double-scoring for same shot
    if (this.state !== "flying") return;
    // Ensure flag is cleared (defensive) so further overlaps don't re-score
    this.ballWasAboveHoop = false;
    this.score += points;
    this.scoreText.setText(`Score: ${this.score}`);
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem("ready-steady-shoot-best", String(this.best));
      this.bestText.setText(`Best: ${this.best}`);
    }
    // Reset for next shot
    this.state = "idle";
    this.time.delayedCall(500, () => {
      this.ball.body!.enable = false; // Disable physics again
      this.ball.setVelocity(0, 0);
      this.ball.setPosition(120, 860); // Reset to hand position (raised player)
      this.ball.setVisible(false);
      this.angleRad = Phaser.Math.DegToRad(30);
      this.power = 0;
      this.redrawAngleArrow();
      this.redrawPowerBar();
      this.drawStickFigure(); // Reset to ready pose
    });
  }

  private onMiss() {
    if (this.state !== "flying") return;
    this.lives -= 1;
    this.drawLives();
    if (this.lives <= 0) {
      this.state = "over";
      // Simple game over banner
      const banner = this.add
        .text(270, 480, "Game Over", {
          fontFamily: "Fredoka, sans-serif",
          fontSize: "36px",
          color: "#fff",
        })
        .setOrigin(0.5);
      // Dispatch to React UI
      dispatchGameOver({ gameId: "ready-steady-shoot", score: this.score, ts: Date.now() });
      this.time.delayedCall(1500, () => {
        banner.destroy();
        // Reset game
        this.score = 0;
        this.scoreText.setText("Score: 0");
        this.lives = 3;
        this.drawLives();
        this.state = "angle";
      });
    } else {
      this.state = "idle";
      this.time.delayedCall(500, () => {
        this.ball.body!.enable = false; // Disable physics again
        this.ball.setVelocity(0, 0);
        this.ball.setPosition(120, 860); // Reset to hand position
        this.ball.setVisible(false);
        this.angleRad = Phaser.Math.DegToRad(30);
        this.power = 0;
        this.redrawAngleArrow();
        this.redrawPowerBar();
        this.drawStickFigure(); // Reset to ready pose
      });
    }
  }

  update(_time: number, delta: number): void {
    // Update ball depth for layering behind hoop (ball behind hoop when it passes the hoop Y)
    this.ball.setDepth(this.ball.y > this.hoopY ? 0 : 2);

    // Check if ball has stopped moving - end game if stationary
    if (this.state === "flying" && this.ball.body?.enable) {
      const body = this.ball.body as Phaser.Physics.Arcade.Body;
      // Enforce maximum speed so collisions or sideways randomness can't create extreme velocities.
      const mag = Math.hypot(body.velocity.x, body.velocity.y);
      if (mag > this.MAX_SHOT_SPEED) {
        const scale = this.MAX_SHOT_SPEED / mag;
        body.velocity.x *= scale;
        body.velocity.y *= scale;
      }

      // Track whether the ball has gone above the hoop during this flight. We only
      // want to count a score if the ball actually passed above the rim first and
      // then fell back down through it.
      if (this.ball.y < this.hoopY - 4) {
        this.ballWasAboveHoop = true;
      }

      // If ball has practically stopped, treat as miss
      if (Math.abs(body.velocity.x) < 5 && Math.abs(body.velocity.y) < 5) {
        this.onMiss();
      }
    }

    // Animate angle selection - decreases slowly from 30deg to -90deg while holding (anti-clockwise)
    if (this.state === "angle" && this.angleSelecting) {
      const min = Phaser.Math.DegToRad(-90);
      this.angleRad -= delta * 0.0008; // slow decrease (anti-clockwise)
      if (this.angleRad < min) {
        this.angleRad = min;
      }
      this.redrawAngleArrow();
    }

    // Animate power selection - rises slowly from 0 to 1.0 while holding
    if (this.state === "power" && this.powerSelecting) {
      const max = 1.0;
      this.power += delta * 0.0006; // slow rise
      if (this.power > max) {
        this.power = max;
      }
      this.redrawPowerBar();
    }
  }
}
