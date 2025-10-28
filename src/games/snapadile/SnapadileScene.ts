import Phaser from "phaser";

interface Croc extends Phaser.Types.Physics.Arcade.SpriteWithDynamicBody {
  sourceId: string;
  speed: number;
}

export default class SnapadileScene extends Phaser.Scene {
  private center!: Phaser.Math.Vector2;
  private raftRadius = 60; // pixels around center to count as hit
  private lives = 3;
  private score = 0;
  private best = 0;

  private scoreText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private gameOverText?: Phaser.GameObjects.Text;

  private spawnTimer?: Phaser.Time.TimerEvent;
  private spawnInterval = 1000; // ms, decreases over time
  private minSpawnInterval = 300;
  private difficultyTimer?: Phaser.Time.TimerEvent;
  private maxConcurrent = 1;
  private rippleTimer?: Phaser.Time.TimerEvent; // kept for potential future control

  private crocs!: Phaser.Physics.Arcade.Group;
  private occupiedSpawns = new Set<string>();

  private spawnPoints: { id: string; x: number; y: number }[] = [];

  constructor() {
    super("Snapadile");
  }

  preload() {
    // Load cartoon-style PNG assets (generated into public/assets/snapadile)
    this.load.image("raft", "/assets/snapadile/raft.png");
    this.load.image("croc", "/assets/snapadile/croc.png");
  }

  create() {
    const { width, height } = this.scale;
    this.center = new Phaser.Math.Vector2(width / 2, height / 2);

    // Water background
    this.cameras.main.setBackgroundColor("#0b2f4f");

    // Physics group
    this.crocs = this.physics.add.group();

    // Add raft in center (larger)
    const raft = this.add.image(this.center.x, this.center.y, "raft");
    const raftTarget = Math.min(width, height) * 0.22; // bigger than before
    const raftScale = raftTarget / Math.max(raft.width, raft.height);
    raft.setScale(raftScale);
    this.raftRadius = Math.max(raft.width, raft.height) * raftScale * 0.52; // slightly beyond raft edge

    // UI
    this.best = Number(localStorage.getItem("snapadile-best") || 0);
    this.scoreText = this.add
      .text(16, 12, this.makeScoreText(), {
        fontFamily: "sans-serif",
        fontSize: "28px",
        color: "#ffffff",
      })
      .setDepth(10);

    this.livesText = this.add
      .text(width - 16, 12, "❤❤❤", {
        fontFamily: "sans-serif",
        fontSize: "28px",
        color: "#ff7b7b",
      })
      .setOrigin(1, 0)
      .setDepth(10);

    // Spawn points: 3 per side, centers top/bottom, 4 corners
    this.computeSpawnPoints(width, height);

    // Timers
    this.spawnTimer = this.time.addEvent({
      delay: this.spawnInterval,
      loop: true,
      callback: this.trySpawn,
      callbackScope: this,
    });
    this.difficultyTimer = this.time.addEvent({
      delay: 4000,
      loop: true,
      callback: this.increaseDifficulty,
      callbackScope: this,
    });

    // Water ripples near the raft for ambience
    this.rippleTimer = this.time.addEvent({
      delay: 900,
      loop: true,
      callback: () => this.spawnRipple(this.center.x, this.center.y),
    });
    this.startWaves();
  }

  private computeSpawnPoints(w: number, h: number) {
    const margin = 24;
    const ys = [h * 0.25, h * 0.5, h * 0.75];
    // const xs = [w * 0.25, w * 0.5, w * 0.75]; // reserved if needed later

    // Left/Right sides (3 each)
    ys.forEach((y, i) => {
      this.spawnPoints.push({ id: `L${i}`, x: margin, y });
      this.spawnPoints.push({ id: `R${i}`, x: w - margin, y });
    });

    // Top/Bottom centers
    this.spawnPoints.push({ id: "T", x: w / 2, y: margin });
    this.spawnPoints.push({ id: "B", x: w / 2, y: h - margin });

    // Corners
    this.spawnPoints.push({ id: "TL", x: margin, y: margin });
    this.spawnPoints.push({ id: "TR", x: w - margin, y: margin });
    this.spawnPoints.push({ id: "BL", x: margin, y: h - margin });
    this.spawnPoints.push({ id: "BR", x: w - margin, y: h - margin });
  }

  private trySpawn() {
    if (this.isGameOver()) return;

    // Respect max concurrent
    if (this.crocs.countActive(true) >= this.maxConcurrent) return;

    const available = this.spawnPoints.filter((p) => !this.occupiedSpawns.has(p.id));
    if (available.length === 0) return;
    const point = Phaser.Utils.Array.GetRandom(available);

    const croc = this.crocs.create(point.x, point.y, "croc") as Croc & {
      retreating?: boolean;
      wiggleTween?: Phaser.Tweens.Tween;
    };
    croc.sourceId = point.id;
    croc.setDepth(2);
    this.occupiedSpawns.add(point.id);

    // Make croc large and easy to tap: big relative to viewport width
    const targetWidth = Math.min(this.scale.width, this.scale.height) * 0.44; // ~80% of previous
    const s = targetWidth / croc.width;
    croc.setScale(s);

    // Face towards center
    const angle = Phaser.Math.Angle.Between(croc.x, croc.y, this.center.x, this.center.y);
    croc.setRotation(angle);

    // Movement speed increases over time
    const baseSpeed = 200;
    const speedBonus = (1_000 - this.spawnInterval) * 0.2; // faster spawns -> faster crocs
    croc.speed = baseSpeed + speedBonus;

    const dir = new Phaser.Math.Vector2(this.center.x - croc.x, this.center.y - croc.y).normalize();
    croc.setVelocity(dir.x * croc.speed, dir.y * croc.speed);

    // Tap to retreat (destroy) and score
    croc.setInteractive({ useHandCursor: true });
    croc.on("pointerdown", (pointer: Phaser.Input.Pointer) =>
      this.hitCroc(croc, pointer.worldX, pointer.worldY)
    );

    // Subtle wiggle without rotating whole sprite (avoids spinning)
    croc.setRotation(angle); // lock direction
    croc.wiggleTween = this.tweens.add({
      targets: croc,
      scaleY: croc.scaleY * 0.96,
      scaleX: croc.scaleX * 1.02,
      yoyo: true,
      repeat: -1,
      duration: 220,
      ease: "Sine.InOut",
    });
  }

  private hitCroc(croc: Croc & { retreating?: boolean }, tapX?: number, tapY?: number) {
    if (!croc.active) return;
    if (croc.retreating) return;

    // Score immediately on hit
    this.score += 1;
    this.scoreText.setText(this.makeScoreText());

    // Play hit sound + ripple + whack burst (remove screen flash)
    this.playBeep(740, 90);
    this.spawnRipple(croc.x, croc.y, 0x72f5a1);
    if (tapX !== undefined && tapY !== undefined) {
      this.spawnWhack(tapX, tapY);
    }

    // Set retreating: disable interaction and send it back off-screen away from center
    croc.retreating = true;
    croc.disableInteractive();

    // Quick squash for feedback
    this.tweens.add({
      targets: croc,
      scaleX: croc.scaleX * 0.95,
      scaleY: croc.scaleY * 0.95,
      yoyo: true,
      duration: 80,
    });

    const away = new Phaser.Math.Vector2(
      croc.x - this.center.x,
      croc.y - this.center.y
    ).normalize();
    const retreatSpeed = croc.speed * 1.4;
    croc.setVelocity(away.x * retreatSpeed, away.y * retreatSpeed);
  }

  private increaseDifficulty() {
    if (this.isGameOver()) return;

    // Decrease spawn interval to a floor
    this.spawnInterval = Math.max(this.minSpawnInterval, this.spawnInterval - 80);
    if (this.spawnTimer)
      this.spawnTimer.reset({
        delay: this.spawnInterval,
        callback: this.trySpawn,
        callbackScope: this,
        loop: true,
      });

    // Occasionally allow more concurrent crocs
    if (this.maxConcurrent < 6 && Math.random() < 0.45) {
      this.maxConcurrent += 1;
    }
  }

  private isGameOver() {
    return this.lives <= 0;
  }

  update() {
    if (this.isGameOver()) return;

    // Check crocs reaching the raft or leaving the screen (destroy on leave if retreating)
    this.crocs.children.iterate((obj) => {
      const croc = obj as Croc & { retreating?: boolean };
      if (!croc || !croc.active) return true;
      const d = Phaser.Math.Distance.Between(croc.x, croc.y, this.center.x, this.center.y);
      if (!croc.retreating && d <= this.raftRadius) {
        this.onRaftHit(croc);
      }

      const margin = 120;
      const w = this.scale.width,
        h = this.scale.height;
      if (
        croc.retreating &&
        (croc.x < -margin || croc.x > w + margin || croc.y < -margin || croc.y > h + margin)
      ) {
        // Free the spawn and destroy
        this.occupiedSpawns.delete(croc.sourceId);
        croc.destroy();
      }
      return true;
    });
  }

  private onRaftHit(croc: Croc) {
    // Free the spawn before destroying
    this.occupiedSpawns.delete(croc.sourceId);
    croc.destroy();
    if (this.lives <= 0) return;
    this.lives -= 1;
    this.livesText.setText("❤".repeat(this.lives));

    // Camera shake for feedback (match ReflexRing feel)
    this.cameras.main.shake(250, 0.01);
    this.playBeep(180, 120);
    this.spawnRipple(this.center.x, this.center.y, 0xff7777);

    if (this.lives <= 0) {
      this.endGame();
    }
  }

  private endGame() {
    // Stop timers and crocs
    this.spawnTimer?.remove();
    this.difficultyTimer?.remove();

    this.crocs.children.iterate((obj) => {
      const c = obj as Croc & { wiggleTween?: Phaser.Tweens.Tween };
      if (c && c.body) c.setVelocity(0, 0);
      if (c?.wiggleTween) c.wiggleTween.stop();
      return true;
    });

    this.gameOverText = this.add
      .text(
        this.scale.width / 2,
        this.scale.height / 2,
        `Game Over\nScore: ${this.score}\nBest: ${this.best}\nTap to Restart`,
        {
          fontFamily: "sans-serif",
          fontSize: "36px",
          color: "#ffffff",
          align: "center",
        }
      )
      .setOrigin(0.5)
      .setDepth(20);

    // Update best score
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem("snapadile-best", String(this.best));
    }

    // Delay before allowing restart to avoid accidental taps
    this.time.delayedCall(1000, () => {
      this.input.once("pointerdown", () => this.restartGame());
    });
  }

  private restartGame() {
    // Clear crocs
    this.crocs.clear(true, true);
    this.occupiedSpawns.clear();

    // Reset state
    this.lives = 3;
    this.score = 0;
    this.spawnInterval = 1000;
    this.maxConcurrent = 1;

    this.scoreText.setText(this.makeScoreText());
    this.livesText.setText("❤❤❤");
    this.gameOverText?.destroy();

    // Restart timers
    this.spawnTimer = this.time.addEvent({
      delay: this.spawnInterval,
      loop: true,
      callback: this.trySpawn,
      callbackScope: this,
    });
    this.difficultyTimer = this.time.addEvent({
      delay: 4000,
      loop: true,
      callback: this.increaseDifficulty,
      callbackScope: this,
    });
  }

  private spawnRipple(x: number, y: number, color: number = 0x72c8ff) {
    const r = this.add.circle(x, y, 12, color, 0.22).setDepth(1);
    r.setBlendMode(Phaser.BlendModes.SCREEN);
    this.tweens.add({
      targets: r,
      scale: 3.2,
      alpha: 0,
      duration: 900,
      ease: "Sine.Out",
      onComplete: () => r.destroy(),
    });
  }

  private playBeep(freq: number, durationMs: number, type: OscillatorType = "sine") {
    const ctx: AudioContext | null = (this.sound as any)?.context ?? null;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
    osc.start(now);
    osc.stop(now + durationMs / 1000 + 0.02);
  }

  private spawnWhack(x: number, y: number) {
    // Small star burst using lines
    const g = this.add.graphics({ x, y }).setDepth(5);
    g.lineStyle(3, 0xffffff, 0.95);
    const rays = 6;
    const len = 18;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2;
      g.lineBetween(Math.cos(a) * 4, Math.sin(a) * 4, Math.cos(a) * len, Math.sin(a) * len);
    }
    this.tweens.add({
      targets: g,
      scale: 1.4,
      alpha: 0,
      duration: 140,
      ease: "Quad.Out",
      onComplete: () => g.destroy(),
    });
  }

  private startWaves() {
    const period = 2400;
    const schedule = (offset: number) => {
      // Use a delayedCall to seed the first ripple and then start a safe looping timer (>0 delay)
      this.time.delayedCall(Math.max(1, offset), () => {
        this.spawnRipple(this.center.x, this.center.y, 0x96d8ff);
        this.time.addEvent({
          delay: period,
          loop: true,
          callback: () => this.spawnRipple(this.center.x, this.center.y, 0x96d8ff),
        });
      });
    };
    schedule(400);
    schedule(1200);
    schedule(2000);
  }

  private makeScoreText() {
    return `Score: ${this.score}   Best: ${this.best}`;
  }
}
