import Phaser from "phaser";
import { dispatchGameOver } from "../../utils/gameEvents";
import { postHighScore } from "../../lib/api";

const GAME_ID = "flash-bash";

const SHAPES = ["circle", "square", "triangle", "star", "diamond", "hexagon"];
const COLORS = [0xff0000, 0x0000ff, 0x00ff00, 0xffff00, 0xff00ff, 0xffa500]; // red, blue, green, yellow, purple, orange

// Dynamic center coords (set in create)
let CENTER_X = 400;
let CENTER_Y = 300;
const FLASH_DURATION = 900; // ms
const INPUT_TIME = 3000; // ms per input

export default class FlashBashGame extends Phaser.Scene {
  private buttons: Phaser.GameObjects.Container[] = [];
  private sequence: number[] = [];
  private playerIndex = 0;
  private score = 0;
  private level = 1;
  private timerBar!: Phaser.GameObjects.Rectangle;
  private timerTween?: Phaser.Tweens.Tween;
  private isPlayerTurn = false;
  private shapeAssignments: { shape: string; color: number }[] = [];
  private scoreText?: Phaser.GameObjects.Text;
  private highScoreText?: Phaser.GameObjects.Text;
  private highScore: number = 0;
  private timerSparkEmitter?: any;
  private starEmitter?: any;
  private bgRect?: Phaser.GameObjects.Rectangle;
  private goText?: Phaser.GameObjects.Text;
  private buttonZones: Phaser.GameObjects.Zone[] = [];
  private lastSparkleTime: number = 0;
  private uiLayer?: Phaser.GameObjects.Layer;

  preload() {
    // No assets needed, using graphics
  }

  create() {
    // Update center coordinates based on current size
    CENTER_X = this.scale.width / 2;
    CENTER_Y = this.scale.height / 2;

    // Create space background
    this.createSpaceBackground();
    // Ensure camera/background color as fallback
    this.cameras.main.setBackgroundColor("#020214");
    // Keep background filling full screen on resize
    this.scale.on("resize", (gameSize: Phaser.Structs.Size) => {
      const w = gameSize.width;
      const h = gameSize.height;
      CENTER_X = w / 2;
      CENTER_Y = h / 2;
      if (this.bgRect) {
        this.bgRect.setSize(w, h).setPosition(0, 0);
      }
    });

    // Score & high score at top (push below page header bar)
    this.highScore = Number(localStorage.getItem(`${GAME_ID}-best`) || 0);
    // Create a dedicated UI layer to guarantee top-most rendering
    this.uiLayer = this.add.layer();
    this.uiLayer.setDepth(2000);

    const topPad = Math.max(72, Math.floor(this.scale.height * 0.06));
    this.scoreText = this.add
      .text(16, topPad, `Score: ${this.score}`, {
        fontSize: "24px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(2000)
      .setStroke("#000000", 3)
      .setVisible(true)
      .setAlpha(1);
    this.highScoreText = this.add
      .text(16, topPad + 28, `Best: ${this.highScore}`, { fontSize: "18px", color: "#ffffff" })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(2000)
      .setStroke("#000000", 3)
      .setVisible(true)
      .setAlpha(1);
    this.uiLayer.add([this.scoreText, this.highScoreText]);

    // Create timer bar at bottom (full width with padding)
    const barWidth = Math.max(200, this.scale.width - 40);
    const barY = this.scale.height - 28;
    this.timerBar = this.add.rectangle(this.scale.width / 2, barY, barWidth, 18, 0x00ff00);
    this.timerBar.setOrigin(0.5);
    (this.timerBar as any).setStrokeStyle(2, 0x000000);
    this.timerBar.setDepth(4);

    // Create a small particle texture for sparkles
    const particleG = this.add.graphics();
    particleG.fillStyle(0xffffff, 1);
    particleG.fillCircle(3, 3, 3);
    particleG.generateTexture("spark", 8, 8);
    particleG.destroy();

    // Particle emitter for timer sparkle (initially off)
    // Use the same pattern as other scenes: create emitter config with frequency -1 for manual bursts
    this.timerSparkEmitter = this.add.particles(0, 0, "spark", {
      speed: { min: 20, max: 60 },
      lifespan: 800,
      scale: { start: 1, end: 0 },
      quantity: 2,
      blendMode: "ADD",
      frequency: -1,
    }) as unknown as Phaser.GameObjects.Particles.ParticleEmitter;
    if ((this.timerSparkEmitter as any).setDepth) (this.timerSparkEmitter as any).setDepth(6);

    // Create buttons (larger and placed left/right)
    this.createButtons();

    // Start game
    this.startNewSequence();
  }

  createSpaceBackground() {
    const w = this.scale.width;
    const h = this.scale.height;
    // Dark space background (store ref and ensure behind everything)
    this.bgRect = this.add.rectangle(0, 0, w, h, 0x020214).setOrigin(0);
    this.bgRect.setDepth(-1000);

    // Starfield (particle emitter for scrolling effect)
    const starG = this.add.graphics();
    starG.fillStyle(0xffffff, 1);
    starG.fillCircle(1, 1, 1);
    starG.generateTexture("starTiny", 4, 4);
    starG.destroy();

    // emitter: continuous slow falling stars to simulate movement
    this.starEmitter = this.add.particles(0, 0, "starTiny", {
      x: { min: 0, max: w },
      y: { min: -50, max: -10 },
      // Give particles plenty of time to travel fully down the screen
      lifespan: { min: Math.max(6000, h * 20), max: Math.max(9000, h * 30) },
      speedY: { min: 20, max: 60 },
      scale: { start: 1, end: 1 },
      quantity: 3,
      frequency: 60,
      blendMode: "ADD",
      alpha: { start: 0.9, end: 0.2 },
    });
    if (this.starEmitter && (this.starEmitter as any).setDepth)
      (this.starEmitter as any).setDepth(-500);

    // Prefill the screen with stars so it's populated immediately
    try {
      const mgr = this.starEmitter as any; // ParticleEmitterManager
      const prefill = Math.max(120, Math.floor((w * h) / 6000));
      for (let i = 0; i < prefill; i++) {
        const rx = Math.random() * w;
        const ry = Math.random() * h;
        if (mgr.emitParticleAt) {
          mgr.emitParticleAt(rx, ry, 1);
        }
      }
    } catch {}

    // subtle nebula shapes for depth
    const g = this.add.graphics();
    g.fillStyle(0x111133, 0.12);
    g.fillCircle(w * 0.25, h * 0.3, Math.min(w, h) * 0.4);
    g.fillStyle(0x331122, 0.06);
    g.fillCircle(w * 0.75, h * 0.6, Math.min(w, h) * 0.45);
    if ((g as any).setDepth) (g as any).setDepth(-600);
  }

  createButtons() {
    // Randomize shape-color assignments
    this.shapeAssignments = [];
    const shapesCopy = [...SHAPES];
    const colorsCopy = [...COLORS];
    Phaser.Utils.Array.Shuffle(shapesCopy);
    Phaser.Utils.Array.Shuffle(colorsCopy);
    for (let i = 0; i < 6; i++) {
      this.shapeAssignments.push({ shape: shapesCopy[i], color: colorsCopy[i] });
    }
    // Destroy any existing buttons/zones before creating new ones
    if (this.buttons && this.buttons.length) {
      for (const c of this.buttons) c.destroy();
    }
    if (this.buttonZones && this.buttonZones.length) {
      for (const z of this.buttonZones) z.destroy();
    }
    this.buttons = [];
    this.buttonZones = [];

    // Place three buttons down left and three down right, larger for touch
    const w = this.scale.width;
    const h = this.scale.height;
    const leftX = Math.max(64, w * 0.12);
    const rightX = Math.min(w - 64, w * 0.88);
    const ys = [h * 0.25, h * 0.5, h * 0.75];
    const radius = Math.max(44, Math.min(w, h) * 0.08);

    for (let i = 0; i < 6; i++) {
      const side = i < 3 ? "left" : "right";
      const colIndex = i % 3;
      const x = side === "left" ? leftX : rightX;
      const y = ys[colIndex];
      const container = this.add.container(x, y);

      // Shadow
      const shadow = this.add.circle(4, 4, radius + 4, 0x000000, 0.35);
      container.add(shadow);

      // Button bg (now black to blend in)
      const bg = this.add.circle(0, 0, radius, 0x000000);
      bg.setStrokeStyle(6, 0x1a1a1a);
      container.add(bg);

      // Draw shape (scaled to radius) but keep hidden until sequence finishes
      const shape = this.drawShape(
        0,
        0,
        this.shapeAssignments[i].shape,
        this.shapeAssignments[i].color
      );
      // scale shapes to fit larger buttons
      const baseScale = (radius / 30) * 0.8; // slightly smaller to fit within the circle
      shape.setScale(baseScale);
      shape.setVisible(false);
      shape.setAlpha(0);
      container.add(shape);
      // store for easy lookup
      (container as any).__shape = shape;
      (container as any).__baseScale = baseScale;
      (container as any).__radius = radius;

      container.setSize(radius * 2, radius * 2);
      container.setInteractive(new Phaser.Geom.Circle(0, 0, radius), Phaser.Geom.Circle.Contains);
      container.setDepth(5);
      // Use an invisible top-level zone as the primary touch target to improve cross-device reliability
      const zone = this.add
        .zone(x, y, radius * 2.2, radius * 2.2)
        .setOrigin(0.5)
        .setInteractive();
      zone.setDepth(50); // ensure it receives input above particles
      zone.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.onButtonPress(i, pointer));
      this.buttonZones.push(zone);
      container.on("pointerover", () => {
        bg.setFillStyle(0x111111);
        this.tweens.add({
          targets: container,
          scale: 1.05,
          duration: 120,
          yoyo: true,
        });
      });
      container.on("pointerout", () => bg.setFillStyle(0x000000));

      this.buttons.push(container);
    }
  }

  drawShape(x: number, y: number, shape: string, color: number): Phaser.GameObjects.Graphics {
    const graphics = this.add.graphics({ x: 0, y: 0 });
    graphics.lineStyle(4, 0x000000, 1); // black stroke
    graphics.fillStyle(color);
    // Draw centered at 0,0 then position the graphics at (x,y)
    switch (shape) {
      case "circle":
        graphics.fillCircle(0, 0, 30);
        graphics.strokeCircle(0, 0, 30);
        break;
      case "square":
        graphics.fillRect(-30, -30, 60, 60);
        graphics.strokeRect(-30, -30, 60, 60);
        break;
      case "triangle":
        graphics.beginPath();
        graphics.moveTo(0, -30);
        graphics.lineTo(-30, 30);
        graphics.lineTo(30, 30);
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();
        break;
      case "star":
        graphics.fillPoints([
          { x: 0, y: -30 },
          { x: 10, y: -10 },
          { x: 30, y: -10 },
          { x: 15, y: 5 },
          { x: 20, y: 30 },
          { x: 0, y: 15 },
          { x: -20, y: 30 },
          { x: -15, y: 5 },
          { x: -30, y: -10 },
          { x: -10, y: -10 },
        ]);
        graphics.strokePoints([
          { x: 0, y: -30 },
          { x: 10, y: -10 },
          { x: 30, y: -10 },
          { x: 15, y: 5 },
          { x: 20, y: 30 },
          { x: 0, y: 15 },
          { x: -20, y: 30 },
          { x: -15, y: 5 },
          { x: -30, y: -10 },
          { x: -10, y: -10 },
        ]);
        break;
      case "diamond":
        graphics.beginPath();
        graphics.moveTo(0, -30);
        graphics.lineTo(30, 0);
        graphics.lineTo(0, 30);
        graphics.lineTo(-30, 0);
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();
        break;
      case "hexagon":
        graphics.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          const px = 30 * Math.cos(angle);
          const py = 30 * Math.sin(angle);
          if (i === 0) graphics.moveTo(px, py);
          else graphics.lineTo(px, py);
        }
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();
        break;
    }
    graphics.setPosition(x, y);
    return graphics;
  }

  startNewSequence() {
    this.level++;
    this.sequence.push(Phaser.Math.Between(0, 5));
    this.playerIndex = 0;
    this.isPlayerTurn = false;
    this.createButtons(); // Reassign shapes/colors
    this.playSequence();
  }

  playSequence() {
    let i = 0;
    const playNext = () => {
      if (i >= this.sequence.length) {
        this.isPlayerTurn = true;
        this.startTimer();
        // Reveal the button shapes now that the sequence has finished
        this.revealButtonShapes();
        // Show GO text in center until player taps
        if (this.goText) this.goText.destroy();
        this.goText = this.add
          .text(CENTER_X, CENTER_Y, "GO!", {
            fontSize: "56px",
            color: "#ffffff",
            stroke: "#000000",
            strokeThickness: 8,
          })
          .setOrigin(0.5)
          .setDepth(12);
        return;
      }
      const index = this.sequence[i];
      this.flashShape(index);
      i++;
      this.time.delayedCall(FLASH_DURATION + 200, playNext);
    };
    playNext();
  }

  flashShape(index: number) {
    const shape = this.drawShape(
      CENTER_X,
      CENTER_Y,
      this.shapeAssignments[index].shape,
      this.shapeAssignments[index].color
    );
    // Add bounce animation
    shape.setDepth(10);
    this.tweens.add({
      targets: shape,
      scale: 1.2,
      duration: FLASH_DURATION / 2,
      yoyo: true,
      ease: "Bounce.easeOut",
    });
    this.time.delayedCall(FLASH_DURATION, () => shape.destroy());
  }

  startTimer() {
    this.timerBar.setScale(1, 1);
    this.timerBar.setFillStyle(0x00ff00);
    this.timerTween = this.tweens.add({
      targets: this.timerBar,
      scaleX: 0,
      duration: INPUT_TIME,
      onUpdate: (tween) => {
        const progress = tween.progress; // 0 -> 1
        // Color shift from green to red over time
        if (progress < 0.5) this.timerBar.setFillStyle(0x66ff33);
        else if (progress < 0.8) this.timerBar.setFillStyle(0xffcc00);
        else this.timerBar.setFillStyle(0xff0000);

        // Emit sparkles at both edges of the shrinking bar, throttled
        const now = this.time.now;
        if (now - this.lastSparkleTime > 80) {
          try {
            const displayWidth = (this.timerBar.width || 0) * (this.timerBar.scaleX || 0);
            const leftX = this.timerBar.x - displayWidth / 2;
            const rightX = this.timerBar.x + displayWidth / 2;
            const edgeY = this.timerBar.y;
            (this.timerSparkEmitter as any).explode(2, leftX, edgeY);
            (this.timerSparkEmitter as any).explode(2, rightX, edgeY);
          } catch {}
          this.lastSparkleTime = now;
        }
      },
      onComplete: () => {
        this.gameOver();
      },
    });
  }

  onButtonPress(index: number, pointer?: Phaser.Input.Pointer) {
    if (!this.isPlayerTurn) return;
    // Remove the GO text on the first player input
    if (this.goText) {
      this.goText.destroy();
      this.goText = undefined;
    }
    this.timerTween?.stop();
    this.flashShape(index);
    // +1 for every press
    this.score += 1;
    const c = this.buttons[index];
    const r = ((c as any).__radius as number) || 30;
    const spawnX = pointer && (pointer as any).worldX !== undefined ? (pointer as any).worldX : c.x;
    const spawnY = pointer && (pointer as any).worldY !== undefined ? (pointer as any).worldY : c.y;
    this.showPointPopup("+1", spawnX, spawnY - r * 0.6);
    if (this.scoreText) this.scoreText.setText(`Score: ${this.score}`);
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem(`${GAME_ID}-best`, String(this.highScore));
      if (this.highScoreText) this.highScoreText.setText(`Best: ${this.highScore}`);
    }
    if (index === this.sequence[this.playerIndex]) {
      this.playerIndex++;
      if (this.playerIndex >= this.sequence.length) {
        // Sequence complete messaging then +3 after 0.5s and a ding
        this.showSequenceComplete();
        this.time.delayedCall(500, () => {
          this.score += 3;
          this.showBonus();
          this.playDing();
          if (this.scoreText) this.scoreText.setText(`Score: ${this.score}`);
          if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem(`${GAME_ID}-best`, String(this.highScore));
            if (this.highScoreText) this.highScoreText.setText(`Best: ${this.highScore}`);
          }
          this.time.delayedCall(500, () => this.startNewSequence());
        });
      } else {
        this.startTimer();
      }
    } else {
      this.gameOver();
    }
  }

  showBonus() {
    const text = this.add.text(CENTER_X, CENTER_Y - 40, "+3", {
      fontSize: "48px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 6,
    });
    text.setOrigin(0.5);
    text.setDepth(30);
    this.tweens.add({
      targets: text,
      y: text.y - 30,
      alpha: 0,
      duration: 700,
      ease: "Cubic.easeOut",
    });
    this.time.delayedCall(800, () => text.destroy());
  }

  showPointPopup(label: string, x?: number, y?: number) {
    const sx = x ?? CENTER_X;
    const sy = (y ?? CENTER_Y) - 10;
    const txt = this.add.text(sx, sy, label, {
      fontSize: "32px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 6,
    });
    txt.setOrigin(0.5);
    txt.setDepth(2000).setAlpha(1).setScrollFactor(0);
    if (this.uiLayer) this.uiLayer.add(txt);
    this.tweens.add({
      targets: txt,
      y: txt.y - 40,
      alpha: 0,
      duration: 600,
      ease: "Cubic.easeOut",
    });
    this.time.delayedCall(650, () => txt.destroy());
  }

  gameOver() {
    // 1s explosion before dispatch/restart
    this.showExplosion();
    dispatchGameOver({ gameId: GAME_ID, score: this.score });
    // try posting score to backend (non-blocking)
    const playerName = (localStorage.getItem("playerName") || "Player").slice(0, 20);
    try {
      postHighScore({ name: playerName, gameId: GAME_ID, score: this.score }).catch(() => {});
    } catch {}
    // brief pause before restart
    this.isPlayerTurn = false;
    this.timerTween?.stop();
    this.time.delayedCall(1000, () => this.scene.restart());
  }

  revealButtonShapes() {
    // Pop-in animation one-by-one over ~0.5 seconds total
    const count = this.buttons.length || 1;
    const step = Math.max(1, Math.floor(500 / count));
    this.buttons.forEach((c, idx) => {
      const shape = (c as any).__shape as Phaser.GameObjects.Graphics | undefined;
      const baseScale = (c as any).__baseScale as number | undefined;
      if (!shape) return;
      const targetScale = baseScale ?? shape.scaleX;
      this.time.delayedCall(idx * step, () => {
        shape.setVisible(true);
        shape.setAlpha(0);
        shape.setScale(targetScale * 0.2);
        this.playPop();
        // Two-stage pop: overshoot then settle (shortened)
        this.tweens.add({ targets: shape, alpha: 1, duration: 80, ease: "Cubic.easeOut" as any });
        this.tweens.add({
          targets: shape,
          scale: targetScale * 1.12,
          duration: 100,
          ease: "Back.Out" as any,
          yoyo: false,
        });
        this.tweens.add({
          targets: shape,
          scale: targetScale,
          duration: 100,
          delay: 100,
          ease: "Cubic.easeOut" as any,
        });
      });
    });
  }

  private playPop() {
    const ctx = (this.sound as any).context as AudioContext | undefined;
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(700, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  private showExplosion() {
    // ring shockwave
    const ring = this.add
      .circle(CENTER_X, CENTER_Y, 20, 0xffffff, 0.2)
      .setStrokeStyle(4, 0xff9900, 1);
    ring.setDepth(20);
    this.tweens.add({
      targets: ring,
      scale: 6,
      alpha: 0,
      duration: 1000,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });
    // particle burst
    try {
      (this.timerSparkEmitter as any)?.explode(50, CENTER_X, CENTER_Y);
    } catch {}
  }

  private playDing() {
    const ctx = (this.sound as any).context as AudioContext | undefined;
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(880, t); // A5
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.4, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.26);
  }

  private showSequenceComplete() {
    const txt = this.add
      .text(CENTER_X, CENTER_Y, "Sequence\nComplete", {
        fontSize: "40px",
        color: "#ffffff",
        align: "center",
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    txt.setDepth(20);
    this.tweens.add({ targets: txt, alpha: 0.9, duration: 120, ease: "Cubic.easeOut" });
    this.time.delayedCall(800, () => txt.destroy());
  }
}
