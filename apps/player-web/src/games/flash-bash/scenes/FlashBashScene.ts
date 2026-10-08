import Phaser from "phaser";
import { BasePlatformScene } from "../../../platform/scenes/BasePlatformScene";
import { keys } from "../../../platform/input";
import { hexToNumber } from "../../../platform/hud/format";
import {
  BUTTON_COUNT,
  dealFaces,
  judge,
  pointsFor,
  roundLength,
  SEQUENCE_BONUS,
  sequence,
  step,
  type Face,
  type Shape,
  type Step,
} from "../useCases/rules";

// Layout in design pixels (540×960, FIT). The HUD owns the top ~140 px.
const STAGE = { x: 270, y: 330, r: 130 };
const STAGE_SHAPE = 92;
const STATUS_Y = 495;
const TIMER = { y: 545, w: 440, h: 16 };
const COLS = [100, 270, 440];
const ROWS = [680, 850];
const BUTTON_R = 72;
const BUTTON_SHAPE = 50;
/** Each touch target is a square a little wider than the button, not overlapping its neighbours. */
const TOUCH = 160;

/** Deep-space backdrop; the paper-coloured buttons and HUD stickers read well on it. */
export const SPACE = "#0b0b26";
/** The sixth button colour: the brand crayons only give five. */
const ORANGE = "#FF9F43";
const PRESS_FLASH_MS = 280;

/** A note per shape, so the pattern can be heard as well as seen. */
const TONES: Record<Shape, number> = {
  circle: 392,
  square: 440,
  triangle: 494,
  star: 523,
  diamond: 587,
  hexagon: 659,
};

/** Outlines on a radius-1 grid; the circle is drawn directly. */
const OUTLINES: Record<Exclude<Shape, "circle">, ReadonlyArray<readonly [number, number]>> = {
  square: [
    [-0.85, -0.85],
    [0.85, -0.85],
    [0.85, 0.85],
    [-0.85, 0.85],
  ],
  triangle: [
    [0, -1],
    [1, 0.9],
    [-1, 0.9],
  ],
  star: [
    [0, -1],
    [0.33, -0.33],
    [1, -0.33],
    [0.5, 0.17],
    [0.67, 1],
    [0, 0.5],
    [-0.67, 1],
    [-0.5, 0.17],
    [-1, -0.33],
    [-0.33, -0.33],
  ],
  diamond: [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ],
  hexagon: Array.from({ length: 6 }, (_, i) => {
    const a = (i * Math.PI) / 3;
    return [Math.cos(a), Math.sin(a)] as const;
  }),
};

type FaceButton = {
  x: number;
  y: number;
  container: Phaser.GameObjects.Container;
  face: Phaser.GameObjects.Graphics;
  hidden: Phaser.GameObjects.Text;
};

export default class FlashBashScene extends BasePlatformScene {
  private rng: () => number = Math.random;
  /** Bumped every run, so a countdown from an earlier run can't start this one. */
  private runId = 0;
  private score = 0;
  /** How many sequences this run has started (0-based index of the current one). */
  private stepIndex = 0;
  private current: Step = step(0);
  private longest = 0;
  private faces: Face[] = [];
  /** The round's pattern; each sequence in the round copies a longer prefix of it. */
  private pattern: number[] = [];
  private expected: number[] = [];
  private presses: number[] = [];
  private playerTurn = false;
  private facesShown = false;

  private ink = 0;
  private palette: number[] = [];
  private buttons: FaceButton[] = [];
  private stageShape: Phaser.GameObjects.Graphics | null = null;
  private statusText!: Phaser.GameObjects.Text;
  private timerBar!: Phaser.GameObjects.Rectangle;
  private timerTween: Phaser.Tweens.Tween | null = null;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super("FlashBash");
  }

  protected startRun(): void {
    // The scene object survives restarts: reset every per-run field first.
    this.rng = this.host.rng();
    this.score = 0;
    this.stepIndex = 0;
    this.current = step(0);
    this.longest = 0;
    this.faces = [];
    this.pattern = [];
    this.expected = [];
    this.presses = [];
    this.playerTurn = false;
    this.facesShown = false;
    this.buttons = [];
    this.stageShape = null;
    this.timerTween = null;

    const c = this.host.colors;
    this.ink = hexToNumber(c.ink);
    this.palette = [c.tomato, c.sun, c.grass, c.sky, c.grape, ORANGE].map(hexToNumber);

    this.cameras.main.setBackgroundColor(SPACE);
    this.makeTextures();
    this.createBackground();
    this.createStage();
    this.createButtons();

    this.hud.setScore(0);
    this.hud.setBest(this.host.best.get());

    // Desktop: number keys 1–6 press the buttons in reading order.
    const keyMap: Record<string, () => void> = {};
    for (let i = 0; i < BUTTON_COUNT; i++) keyMap[String(i + 1)] = () => this.press(i);
    keys(this, keyMap);

    const run = ++this.runId;
    void this.hud.countdown(3).then(() => {
      if (run !== this.runId || this.runEnded) return; // a newer run took over
      this.nextSequence();
    });
  }

  // ---------------------------------------------------------------- set-up

  private makeTextures() {
    if (!this.textures.exists("fb-star")) {
      const g = this.make.graphics({}, false);
      g.fillStyle(0xffffff, 1).fillCircle(2, 2, 2);
      g.generateTexture("fb-star", 4, 4);
      g.destroy();
    }
    if (!this.textures.exists("fb-spark")) {
      const g = this.make.graphics({}, false);
      g.fillStyle(0xffffff, 1).fillCircle(4, 4, 4);
      g.generateTexture("fb-spark", 8, 8);
      g.destroy();
    }
  }

  private createBackground() {
    const { width, height } = this.scale;
    // Slowly falling stars (cosmetic, so Phaser's own randomness is fine).
    const stars = this.add
      .particles(0, 0, "fb-star", {
        x: { min: 0, max: width },
        y: { min: -20, max: -5 },
        lifespan: 24_000,
        speedY: { min: 20, max: 50 },
        scale: { min: 0.4, max: 1 },
        alpha: { start: 0.9, end: 0.3 },
        frequency: 140,
        blendMode: "ADD",
      })
      .setDepth(-10);
    for (let i = 0; i < 90; i++) {
      stars.emitParticleAt(Phaser.Math.Between(0, width), Phaser.Math.Between(0, height), 1);
    }

    this.sparks = this.add
      .particles(0, 0, "fb-spark", {
        speed: { min: 120, max: 380 },
        lifespan: 900,
        scale: { start: 1.2, end: 0 },
        tint: this.palette,
        blendMode: "ADD",
        emitting: false,
      })
      .setDepth(30);
  }

  private createStage() {
    const c = this.host.colors;
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(0x15153d, 1).fillCircle(STAGE.x, STAGE.y, STAGE.r);
    g.lineStyle(5, hexToNumber(c.sky), 0.7).strokeCircle(STAGE.x, STAGE.y, STAGE.r);

    this.statusText = this.add
      .text(STAGE.x, STATUS_Y, "", {
        fontFamily: this.host.fonts.display,
        fontSize: "34px",
        fontStyle: "800",
        color: c.paper,
        stroke: c.ink,
        strokeThickness: 6,
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(5);

    // Track behind the timer bar, so the shrinking bar has something to shrink against.
    this.add
      .rectangle(STAGE.x, TIMER.y, TIMER.w, TIMER.h, 0x000000, 0.35)
      .setStrokeStyle(2, hexToNumber(c.paper), 0.4)
      .setDepth(3);
    this.timerBar = this.add
      .rectangle(STAGE.x, TIMER.y, TIMER.w, TIMER.h, hexToNumber(c.grass))
      .setDepth(4)
      .setScale(0, 1);
  }

  private createButtons() {
    const c = this.host.colors;
    const paper = hexToNumber(c.paper);
    for (let i = 0; i < BUTTON_COUNT; i++) {
      const x = COLS[i % COLS.length] ?? 0;
      const y = ROWS[Math.floor(i / COLS.length)] ?? 0;
      const container = this.add.container(x, y).setDepth(10);
      const shadow = this.add.circle(0, 6, BUTTON_R, this.ink);
      const bg = this.add.circle(0, 0, BUTTON_R, paper).setStrokeStyle(6, this.ink);
      const face = this.add.graphics().setVisible(false);
      const hidden = this.add
        .text(0, 0, "?", {
          fontFamily: this.host.fonts.display,
          fontSize: "56px",
          fontStyle: "800",
          color: c.ink,
        })
        .setOrigin(0.5)
        .setAlpha(0.35);
      container.add([shadow, bg, face, hidden]);

      this.add
        .zone(x, y, TOUCH, TOUCH)
        .setInteractive()
        .on("pointerdown", () => this.press(i));

      this.buttons.push({ x, y, container, face, hidden });
    }
    this.dimButtons(true);
  }

  private drawShape(g: Phaser.GameObjects.Graphics, face: Face, size: number) {
    const color = this.palette[face.color] ?? 0xffffff;
    g.clear();
    g.fillStyle(color, 1);
    g.lineStyle(Math.max(4, size / 10), this.ink, 1);
    if (face.shape === "circle") {
      g.fillCircle(0, 0, size * 0.9);
      g.strokeCircle(0, 0, size * 0.9);
      return;
    }
    const pts = OUTLINES[face.shape].map(
      ([px, py]) => new Phaser.Math.Vector2(px * size, py * size),
    );
    g.fillPoints(pts, true);
    g.strokePoints(pts, true, true);
  }

  // ---------------------------------------------------------------- rounds

  private nextSequence() {
    if (this.runEnded) return;
    const s = step(this.stepIndex);
    this.current = s;
    let lead = 300;
    if (s.newRound) {
      // New round: new shapes on the buttons and a new pattern to learn.
      this.faces = dealFaces(this.rng, this.faces.length ? this.faces : undefined);
      this.pattern = sequence(this.rng, roundLength(s.round));
      this.buttons.forEach((b, i) => {
        const face = this.faces[i];
        if (face) this.drawShape(b.face, face, BUTTON_SHAPE);
        b.face.setVisible(false);
        b.hidden.setVisible(true);
      });
      this.facesShown = false;
      if (s.round > 0) {
        this.hud.popup("New shapes!", STAGE.x, STAGE.y, this.host.colors.sky);
        this.host.audio.pop();
        lead = 900;
      }
    }
    this.expected = this.pattern.slice(0, s.length);
    this.presses = [];
    this.playerTurn = false;
    this.dimButtons(true);
    this.setStatus(s.newRound ? `Round ${s.round + 1}: watch!` : "Watch!");
    this.time.delayedCall(lead, () => this.playPattern(0));
  }

  private playPattern(i: number) {
    if (this.runEnded) return;
    const button = this.expected[i];
    if (button === undefined) {
      this.beginTurn();
      return;
    }
    this.flash(button, this.current.flashMs);
    this.time.delayedCall(this.current.flashMs + this.current.gapMs, () => this.playPattern(i + 1));
  }

  /** Shows a button's shape big in the middle, with its note. */
  private flash(button: number, ms: number) {
    const face = this.faces[button];
    if (!face) return;
    this.stageShape?.destroy();
    const g = this.add.graphics({ x: STAGE.x, y: STAGE.y }).setDepth(2);
    this.drawShape(g, face, STAGE_SHAPE);
    this.stageShape = g;
    this.host.audio.beep(TONES[face.shape], Math.min(ms, 260));
    g.setScale(0.6);
    this.tweens.add({ targets: g, scale: 1, duration: Math.min(180, ms / 2), ease: "Back.Out" });
    this.time.delayedCall(ms, () => {
      if (this.stageShape !== g) return; // a newer flash replaced it
      this.stageShape = null;
      g.destroy();
    });
  }

  private beginTurn() {
    this.playerTurn = true;
    this.dimButtons(false);
    if (!this.facesShown) this.revealFaces();
    this.setStatus("Your turn!");
    this.startTimer();
  }

  /** Pops the shapes onto the buttons one by one at the start of a round. */
  private revealFaces() {
    this.facesShown = true;
    this.host.audio.pop();
    this.buttons.forEach((b, i) => {
      b.hidden.setVisible(false);
      b.face.setVisible(true).setScale(0.2).setAlpha(0);
      this.tweens.add({
        targets: b.face,
        scale: 1,
        alpha: 1,
        delay: i * 60,
        duration: 220,
        ease: "Back.Out",
      });
    });
  }

  private dimButtons(dim: boolean) {
    for (const b of this.buttons) b.container.setAlpha(dim ? 0.55 : 1);
  }

  private setStatus(text: string) {
    this.statusText.setText(text);
  }

  // ---------------------------------------------------------------- input

  private press(button: number) {
    if (!this.playerTurn || this.runEnded) return;
    const b = this.buttons[button];
    if (!b) return;
    this.stopTimer();
    this.presses.push(button);
    const verdict = judge(this.presses, this.expected);
    this.bump(b);

    if (verdict === "wrong") {
      this.fail("Oops!");
      return;
    }

    this.host.haptics.tap();
    this.flash(button, PRESS_FLASH_MS);
    this.score += pointsFor(verdict);
    this.hud.setScore(this.score);
    this.hud.popup("+1", b.x, b.y - BUTTON_R);

    if (verdict === "next") {
      this.startTimer();
      return;
    }

    // Sequence complete: a bonus, then the next (longer) one.
    this.playerTurn = false;
    this.longest = Math.max(this.longest, this.expected.length);
    this.setStatus("Sequence complete!");
    this.time.delayedCall(500, () => {
      this.score += SEQUENCE_BONUS;
      this.hud.setScore(this.score);
      this.hud.popup(`+${SEQUENCE_BONUS}`, STAGE.x, STAGE.y - 40, this.host.colors.grass);
      this.host.audio.ding();
      this.host.haptics.success();
      this.time.delayedCall(600, () => {
        this.stepIndex += 1;
        this.nextSequence();
      });
    });
  }

  private bump(b: FaceButton) {
    this.tweens.killTweensOf(b.container);
    b.container.setScale(1);
    this.tweens.add({ targets: b.container, scale: 0.9, duration: 70, yoyo: true });
  }

  // ---------------------------------------------------------------- timer

  private startTimer() {
    const c = this.host.colors;
    const sun = hexToNumber(c.sun);
    const tomato = hexToNumber(c.tomato);
    const grass = hexToNumber(c.grass);
    this.timerBar.setScale(1, 1).setFillStyle(grass);
    const tween = this.tweens.add({
      targets: this.timerBar,
      scaleX: 0,
      duration: this.current.inputMs,
      onUpdate: (t: Phaser.Tweens.Tween) => {
        const p = t.progress;
        this.timerBar.setFillStyle(p < 0.5 ? grass : p < 0.8 ? sun : tomato);
      },
      onComplete: () => {
        if (this.timerTween !== tween) return; // stopped or replaced
        this.timerTween = null;
        this.fail("Too slow!");
      },
    });
    this.timerTween = tween;
  }

  private stopTimer() {
    const t = this.timerTween;
    this.timerTween = null;
    t?.stop();
  }

  // ---------------------------------------------------------------- end

  private fail(message: string) {
    this.playerTurn = false;
    this.stopTimer();
    this.setStatus(message);

    // Show which button was right, so the player learns from it.
    const right = this.buttons[this.expected[this.presses.length - 1] ?? -1];
    const missed = this.buttons[this.expected[this.presses.length] ?? -1];
    const hint = message === "Too slow!" ? missed : right;
    if (hint) {
      const ring = this.add
        .circle(hint.x, hint.y, BUTTON_R + 10)
        .setStrokeStyle(8, hexToNumber(this.host.colors.sun))
        .setDepth(11);
      this.tweens.add({ targets: ring, alpha: 0.2, duration: 150, yoyo: true, repeat: 3 });
    }

    const shock = this.add
      .circle(STAGE.x, STAGE.y, 24, 0xffffff, 0.2)
      .setStrokeStyle(5, hexToNumber(this.host.colors.tomato))
      .setDepth(20);
    this.tweens.add({
      targets: shock,
      scale: 6,
      alpha: 0,
      duration: 900,
      ease: "Cubic.Out",
      onComplete: () => shock.destroy(),
    });
    this.sparks.explode(40, STAGE.x, STAGE.y);

    this.endRun(this.score, { rounds: this.current.round + 1, longest: this.longest });
  }
}
