import Phaser from "phaser";
import { BasePlatformScene } from "../../platform/scenes/BasePlatformScene";
import { loseLife, MAX_LIVES, pickSpawn, scoreFor, spawnSchedule } from "./useCases/rules";

interface Croc extends Phaser.Types.Physics.Arcade.SpriteWithDynamicBody {
  sourceId: string;
  speed: number;
}

export default class SnapadileScene extends BasePlatformScene {
  private center!: Phaser.Math.Vector2;
  private raftRadius = 60; // pixels around center to count as hit
  private lives = MAX_LIVES;
  private score = 0;
  /** Scene-clock time when the crocs started (after the countdown); null before. */
  private runStart: number | null = null;
  private rng: () => number = Math.random;
  /** Bumped every run, so a countdown from an earlier run can't start this one. */
  private runId = 0;

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

  protected startRun() {
    // The scene object survives restarts: reset per-run fields first.
    this.lives = MAX_LIVES;
    this.score = 0;
    this.runStart = null;
    this.rng = this.host.rng();
    this.occupiedSpawns.clear();

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

    this.hud.setScore(0);
    this.hud.setBest(this.host.best.get());
    this.hud.setHearts(this.lives, MAX_LIVES);

    // Spawn points: 3 per side, centers top/bottom, 4 corners
    this.computeSpawnPoints(width, height);

    // 3-2-1, then the crocs come.
    const run = ++this.runId;
    void this.hud.countdown(3).then(() => {
      if (run !== this.runId || this.runEnded) return; // a newer run took over
      this.runStart = this.time.now;
      this.scheduleSpawn();
    });

    // Water ripples near the raft for ambience
    this.time.addEvent({
      delay: 900,
      loop: true,
      callback: () => this.spawnRipple(this.center.x, this.center.y),
    });
    this.startWaves();
  }

  /** Spawn, then schedule the next attempt from the current difficulty. */
  private scheduleSpawn() {
    if (this.runEnded || this.runStart === null) return;
    this.trySpawn();
    const { intervalMs } = spawnSchedule(this.time.now - this.runStart);
    this.time.delayedCall(intervalMs, () => this.scheduleSpawn());
  }

  private computeSpawnPoints(w: number, h: number) {
    this.spawnPoints = [];
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
    if (this.isGameOver() || this.runStart === null) return;
    const { maxConcurrent, crocSpeed } = spawnSchedule(this.time.now - this.runStart);
    if (this.crocs.countActive(true) >= maxConcurrent) return;

    const point = pickSpawn(this.spawnPoints, this.occupiedSpawns, this.rng);
    if (!point) return;

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

    croc.speed = crocSpeed;

    const dir = new Phaser.Math.Vector2(this.center.x - croc.x, this.center.y - croc.y).normalize();
    croc.setVelocity(dir.x * croc.speed, dir.y * croc.speed);

    // Tap to retreat (destroy) and score
    croc.setInteractive({ useHandCursor: true });
    croc.on("pointerdown", (pointer: Phaser.Input.Pointer) =>
      this.hitCroc(croc, pointer.worldX, pointer.worldY),
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
    const points = scoreFor({ retreating: Boolean(croc.retreating) });
    if (points === 0) return;

    this.score += points;
    this.hud.setScore(this.score);

    // Hit sound + ripple + whack burst
    this.host.audio.play("hit");
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
      croc.y - this.center.y,
    ).normalize();
    const retreatSpeed = croc.speed * 1.4;
    croc.setVelocity(away.x * retreatSpeed, away.y * retreatSpeed);
  }

  private isGameOver() {
    return this.lives <= 0;
  }

  update() {
    if (this.isGameOver()) return;

    // Check crocs reaching the raft or leaving the screen (destroy on leave if retreating)
    this.crocs.getChildren().forEach((obj) => {
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
    this.lives = loseLife(this.lives);
    this.hud.setHearts(this.lives, MAX_LIVES);

    // Camera shake for feedback (match ReflexRing feel)
    this.shakeCamera(250, 0.01);
    this.host.audio.play("miss");
    this.host.haptics.tap();
    this.spawnRipple(this.center.x, this.center.y, 0xff7777);

    if (this.lives <= 0) {
      this.endGame();
    }
  }

  private endGame() {
    // Freeze the crocs where they are (the base scene clears timers on restart).
    this.runStart = null;

    this.crocs.getChildren().forEach((obj) => {
      const c = obj as Croc & { wiggleTween?: Phaser.Tweens.Tween };
      if (c && c.body) c.setVelocity(0, 0);
      if (c?.wiggleTween) c.wiggleTween.stop();
      return true;
    });

    this.endRun(this.score);
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
}
