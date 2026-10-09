import Phaser from "phaser";
import { BasePlatformScene } from "../../../platform/scenes/BasePlatformScene";
import { keys } from "../../../platform/input";
import { hexToNumber } from "../../../platform/hud/format";
import { generateLevel, levelConfig, type LevelOptions } from "../useCases/generate";
import { tubeLayout, type TubeSlot } from "../useCases/layout";
import { LAST_LEVEL, isLastLevel, levelScore } from "../useCases/scoring";
import { CAPACITY, isSolved, isTubeDone, pour, tap, topRun, type Board } from "../useCases/tubes";

const BALL_R = 24;
const BALL_STEP = 54;
const TUBE_W = 68;
const TUBE_PAD = 10;
const TUBE_H = CAPACITY * BALL_STEP + TUBE_PAD * 2;
/** How far a picked-up run of balls rises out of its tube. */
const LIFT = 44;
const OUTLINE = 5;
const LEVEL_Y = 182;
const MOVES_Y = 226;
const GIVE_UP_Y = 900;
/** Pause after a cleared level before the next one appears. */
const CLEAR_PAUSE_MS = 1200;
/** How long "Tap again to give up" waits for the second tap. */
const CONFIRM_MS = 2500;

/**
 * Each colour also has its own mark, so the game is playable without colour vision
 * (T7.12): tomato dot, sun stripe, grass star, sky ring, grape square, paper cross.
 */
type Mark = "dot" | "stripe" | "star" | "ring" | "square" | "cross";
const MARKS: readonly Mark[] = ["dot", "stripe", "star", "ring", "square", "cross"];

const STAR_POINTS = Array.from({ length: 10 }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI) / 5;
  const r = i % 2 === 0 ? 1 : 0.45;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
});

export default class SortScene extends BasePlatformScene {
  private board: Board = [];
  private par = 0;
  private level = 1;
  private cleared = 0;
  private moves = 0;
  private totalMoves = 0;
  private score = 0;
  private selected: number | null = null;
  /** True between a cleared level and the next one: taps are ignored. */
  private busy = false;
  private confirming = false;
  private options: LevelOptions = {};
  private rng: () => number = Math.random;
  private slots: TubeSlot[] = [];
  /** Slots ("tube:index") whose ball is mid-drop and drawn by its own Graphics. */
  private hidden = new Set<string>();
  private flying: Phaser.GameObjects.Graphics[] = [];
  private zones: Phaser.GameObjects.Zone[] = [];
  private confirmTimer: Phaser.Time.TimerEvent | null = null;

  private gfx!: Phaser.GameObjects.Graphics;
  private levelText!: Phaser.GameObjects.Text;
  private movesText!: Phaser.GameObjects.Text;
  private giveUpText!: Phaser.GameObjects.Text;
  private giveUpGfx!: Phaser.GameObjects.Graphics;
  private palette: number[] = [];
  private ink = 0;
  private paper = 0;

  constructor() {
    super("SortScene");
  }

  protected startRun() {
    const c = this.host.colors;
    // Five crayons plus paper: six ball colours, each with its own mark.
    this.palette = [c.tomato, c.sun, c.grass, c.sky, c.grape, c.paper].map(hexToNumber);
    this.ink = hexToNumber(c.ink);
    this.paper = hexToNumber(c.paper);

    this.level = 1;
    this.cleared = 0;
    this.totalMoves = 0;
    this.score = 0;
    this.busy = false;
    this.confirming = false;
    this.confirmTimer = null;
    this.hidden = new Set();
    this.flying = [];
    this.zones = [];
    this.rng = this.host.rng(); // the day's seed on a daily-challenge run
    this.options = {
      maxColours: this.host.remix.get("colours"), // remix knobs (T11.2)
      spare: this.host.remix.get("spare"),
    };

    const { width } = this.scale;
    this.gfx = this.add.graphics();
    const textStyle = { fontFamily: this.host.fonts.display, color: c.ink, fontStyle: "800" };
    this.levelText = this.add
      .text(width / 2, LEVEL_Y, "", { ...textStyle, fontSize: "34px" })
      .setOrigin(0.5);
    this.movesText = this.add
      .text(width / 2, MOVES_Y, "", { ...textStyle, fontSize: "24px", fontStyle: "700" })
      .setOrigin(0.5);
    this.createGiveUp();

    this.hud.setScore(0);
    this.hud.setBest(this.host.best.get());

    // Desktop: 1–9 pick tubes in reading order.
    const keyMap: Record<string, () => void> = {};
    for (let i = 0; i < 9; i++) keyMap[String(i + 1)] = () => this.onTube(i);
    keys(this, keyMap);

    this.startLevel();
  }

  // ---------------------------------------------------------------- levels

  private startLevel() {
    const cfg = levelConfig(this.level, this.options);
    const { board, par } = generateLevel(cfg, this.rng);
    this.board = board;
    this.par = par;
    this.moves = 0;
    this.selected = null;
    this.busy = false;
    this.clearFlying();

    this.slots = tubeLayout(board.length, this.scale.width);
    this.zones.forEach((z) => z.destroy());
    this.zones = this.slots.map((s, i) =>
      this.add
        .zone(s.x, s.top + TUBE_H / 2 - LIFT / 2, s.spacing - 4, TUBE_H + LIFT + 20)
        .setInteractive()
        .on("pointerdown", () => this.onTube(i)),
    );

    this.levelText.setText(`Level ${this.level} of ${LAST_LEVEL}`);
    this.updateMoves();
    this.draw();
  }

  private levelCleared() {
    this.busy = true;
    this.selected = null;
    const points = levelScore(this.moves, this.par);
    this.score += points;
    this.cleared += 1;
    this.hud.setScore(this.score);
    this.hud.popup(`Sorted! +${points}`, this.scale.width / 2, this.scale.height / 2 - 20);
    this.host.audio.play("score");
    this.host.haptics.success();
    this.host.analytics.event("level_clear", { level: this.level, moves: this.moves });

    if (isLastLevel(this.cleared)) {
      this.time.delayedCall(700, () => this.finish());
      return;
    }
    this.time.delayedCall(CLEAR_PAUSE_MS, () => {
      if (this.runEnded) return;
      this.level += 1;
      this.startLevel();
    });
  }

  private finish() {
    this.endRun(this.score, { levels: this.cleared, moves: this.totalMoves });
  }

  // ---------------------------------------------------------------- input

  private onTube(index: number) {
    if (this.runEnded || this.busy || index >= this.board.length) return;
    const result = tap(this.board, this.selected, index);
    switch (result.kind) {
      case "select":
        this.selected = result.selected;
        this.host.audio.play("tap");
        break;
      case "deselect":
        this.selected = null;
        this.host.audio.play("tap");
        break;
      case "nope":
        this.selected = result.selected;
        this.host.audio.play("miss");
        this.wobble(index);
        break;
      case "pour":
        this.doPour(result.from, result.to, result.count);
        return;
    }
    this.draw();
  }

  private doPour(from: number, to: number, count: number) {
    this.clearFlying();
    this.board = pour(this.board, from, to);
    this.selected = null;
    this.moves += 1;
    this.totalMoves += 1;
    this.host.audio.play("hit");
    this.host.haptics.tap();
    this.updateMoves();
    this.dropIn(to, count);
    this.draw();
    if (isSolved(this.board)) this.levelCleared();
  }

  private updateMoves() {
    this.movesText.setText(`Moves ${this.moves} · Par ${this.par}`);
  }

  // ---------------------------------------------------------------- give up

  private createGiveUp() {
    const { width } = this.scale;
    const w = 300;
    const h = 64;
    this.giveUpGfx = this.add.graphics();
    this.giveUpText = this.add
      .text(width / 2, GIVE_UP_Y, "", {
        fontFamily: this.host.fonts.display,
        fontSize: "26px",
        fontStyle: "800",
        color: this.host.colors.ink,
      })
      .setOrigin(0.5);
    this.add
      .zone(width / 2, GIVE_UP_Y, w, h + 16)
      .setInteractive()
      .on("pointerdown", () => this.onGiveUp());
    this.drawGiveUp();
  }

  private drawGiveUp() {
    const { width } = this.scale;
    const w = 300;
    const h = 64;
    const x = width / 2 - w / 2;
    const y = GIVE_UP_Y - h / 2;
    const fill = this.confirming ? hexToNumber(this.host.colors.tomato) : this.paper;
    this.giveUpGfx
      .clear()
      .fillStyle(this.ink, 1)
      .fillRoundedRect(x, y + 5, w, h, 18)
      .fillStyle(fill, 1)
      .fillRoundedRect(x, y, w, h, 18)
      .lineStyle(4, this.ink, 1)
      .strokeRoundedRect(x, y, w, h, 18);
    this.giveUpText.setText(this.confirming ? "Tap again to give up" : "Give up");
  }

  /** Two taps, so a stray finger doesn't end a good run. */
  private onGiveUp() {
    if (this.runEnded || this.busy) return;
    if (this.confirming) {
      this.confirmTimer?.remove(false);
      this.finish();
      return;
    }
    this.confirming = true;
    this.host.audio.play("tap");
    this.drawGiveUp();
    this.confirmTimer = this.time.delayedCall(CONFIRM_MS, () => {
      this.confirming = false;
      this.drawGiveUp();
    });
  }

  // ---------------------------------------------------------------- drawing

  private ballY(slot: TubeSlot, index: number): number {
    return slot.top + TUBE_H - TUBE_PAD - BALL_STEP / 2 - index * BALL_STEP;
  }

  private draw() {
    const g = this.gfx.clear();
    this.board.forEach((tube, t) => {
      const slot = this.slots[t];
      if (!slot) return;
      const done = isTubeDone(tube);
      const isSel = this.selected === t;
      const x = slot.x - TUBE_W / 2;

      g.fillStyle(this.ink, 0.06).fillRoundedRect(x, slot.top, TUBE_W, TUBE_H, 22);
      if (isSel) {
        g.lineStyle(OUTLINE + 6, hexToNumber(this.host.colors.sun), 1);
        g.strokeRoundedRect(x, slot.top, TUBE_W, TUBE_H, 22);
      }
      g.lineStyle(OUTLINE, done ? hexToNumber(this.host.colors.grass) : this.ink, 1);
      g.strokeRoundedRect(x, slot.top, TUBE_W, TUBE_H, 22);
      if (done) this.drawTick(slot.x, slot.top - 24);

      const lifted = isSel ? topRun(tube) : 0;
      tube.forEach((colour, i) => {
        if (this.hidden.has(`${t}:${i}`)) return;
        const up = i >= tube.length - lifted ? LIFT : 0;
        this.drawBall(g, slot.x, this.ballY(slot, i) - up, colour);
      });
    });
  }

  private drawTick(x: number, y: number) {
    this.gfx
      .fillStyle(hexToNumber(this.host.colors.grass), 1)
      .fillCircle(x, y, 16)
      .lineStyle(4, this.ink, 1)
      .strokeCircle(x, y, 16)
      .lineStyle(5, this.ink, 1)
      .beginPath()
      .moveTo(x - 7, y)
      .lineTo(x - 2, y + 6)
      .lineTo(x + 8, y - 6)
      .strokePath();
  }

  private drawBall(g: Phaser.GameObjects.Graphics, x: number, y: number, colour: number) {
    g.fillStyle(this.palette[colour] ?? this.paper, 1).fillCircle(x, y, BALL_R);
    g.lineStyle(4, this.ink, 1).strokeCircle(x, y, BALL_R);
    const s = BALL_R * 0.5;
    g.fillStyle(this.ink, 1).lineStyle(5, this.ink, 1);
    switch (MARKS[colour]) {
      case "dot":
        g.fillCircle(x, y, s * 0.55);
        break;
      case "stripe":
        g.fillRect(x - BALL_R + 3, y - 4, BALL_R * 2 - 6, 8);
        break;
      case "star":
        g.fillPoints(
          STAR_POINTS.map((p) => new Phaser.Math.Vector2(x + p.x * s * 1.25, y + p.y * s * 1.25)),
          true,
        );
        break;
      case "ring":
        g.lineStyle(4, this.ink, 1).strokeCircle(x, y, s * 0.9);
        break;
      case "square":
        g.fillRect(x - s * 0.7, y - s * 0.7, s * 1.4, s * 1.4);
        break;
      case "cross":
        g.lineBetween(x - s, y - s, x + s, y + s).lineBetween(x - s, y + s, x + s, y - s);
        break;
    }
  }

  // ---------------------------------------------------------------- motion

  /** The poured balls drop into their tube with a little bounce (skipped for reduced motion). */
  private dropIn(tube: number, count: number) {
    const slot = this.slots[tube];
    const balls = this.board[tube];
    if (!slot || !balls || this.host.reducedMotion()) return;
    for (let k = 0; k < count; k++) {
      const i = balls.length - count + k;
      const key = `${tube}:${i}`;
      const g = this.add.graphics();
      this.drawBall(g, 0, 0, balls[i] ?? 0);
      const y = this.ballY(slot, i);
      g.setPosition(slot.x, slot.top - LIFT - (count - k) * 10);
      this.hidden.add(key);
      this.flying.push(g);
      this.tweens.add({
        targets: g,
        y,
        duration: 260 + k * 40,
        ease: "Bounce.Out",
        onComplete: () => {
          this.hidden.delete(key);
          this.flying = this.flying.filter((f) => f !== g);
          g.destroy();
          this.draw();
        },
      });
    }
  }

  /** Finishes any balls still dropping, so a quick next move draws correctly. */
  private clearFlying() {
    this.flying.forEach((g) => {
      this.tweens.killTweensOf(g);
      g.destroy();
    });
    this.flying = [];
    this.hidden.clear();
  }

  /** A small side-to-side shake of a tube that can't take the pour. */
  private wobble(index: number) {
    if (this.host.reducedMotion() || !this.slots[index]) return;
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 220,
      onUpdate: (tw) => {
        const slot = this.slots[index];
        const base = tubeLayout(this.board.length, this.scale.width)[index];
        if (!slot || !base) return;
        const t = tw.getValue() ?? 1;
        slot.x = base.x + Math.sin(t * Math.PI * 4) * 6 * (1 - t);
        this.draw();
      },
      onComplete: () => {
        const base = tubeLayout(this.board.length, this.scale.width)[index];
        const slot = this.slots[index];
        if (slot && base) slot.x = base.x;
        this.draw();
      },
    });
  }
}
