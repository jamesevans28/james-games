import Phaser from "phaser";
import { BasePlatformScene } from "../../../platform/scenes/BasePlatformScene";
import { dpad, swipe, type Direction4 } from "../../../platform/input";
import { hexToNumber } from "../../../platform/hud/format";
import {
  BOARD,
  canTurn,
  initialState,
  nextSpeed,
  step,
  type Cell,
  type RunState,
} from "../useCases/rules";

const CELL = 30; // px per grid cell
/** Below the HUD (top ~140 px) and above the d-pad (its top edge is at ~768 px). */
const BOARD_TOP = 150;

const BOARD_FILL = 0x3d6826;
const GRID_LINE = 0x4d7836;
const BODY_FILL = 0x8fbc4b;
const BODY_LINE = 0x6b9c3d;

/** The head art faces up; rotate it to the travel direction. */
const HEAD_ANGLE: Record<Direction4, number> = {
  up: 0,
  right: Math.PI / 2,
  down: Math.PI,
  left: -Math.PI / 2,
};

export default class SerpentoScene extends BasePlatformScene {
  private run!: RunState;
  /** The direction the next move will take (already checked against reversing). */
  private wanted: Direction4 = "right";
  private rng: () => number = Math.random;

  private boardX = 0;
  private bodyGfx!: Phaser.GameObjects.Graphics;
  private head!: Phaser.GameObjects.Image;
  private food!: Phaser.GameObjects.Image;
  private foodScale = 1;

  constructor() {
    super("Serpento");
  }

  preload(): void {
    this.load.svg("serpento-food", "/assets/serpento/food.svg", { width: 40, height: 40 });
    this.load.svg("serpento-head", "/assets/serpento/snake-head.svg", {
      width: CELL,
      height: CELL,
    });
  }

  protected startRun(): void {
    // The scene object survives restarts: reset every per-run field first.
    this.rng = this.host.rng();
    this.run = initialState(BOARD, this.rng);
    this.wanted = this.run.dir;
    this.boardX = Math.floor((this.scale.width - BOARD.cols * CELL) / 2);

    this.drawBoard();
    this.bodyGfx = this.add.graphics().setDepth(1);
    this.food = this.add.image(0, 0, "serpento-food").setDisplaySize(CELL + 4, CELL + 4);
    this.food.setDepth(2);
    this.foodScale = this.food.scale;
    this.head = this.add.image(0, 0, "serpento-head").setDisplaySize(CELL, CELL).setDepth(3);

    this.hud.setScore(0);
    this.hud.setBest(this.host.best.get());

    // Swipe anywhere (arrows/WASD on desktop), or the sticky d-pad under the board.
    swipe(this, { onSwipe: (dir) => this.turn(dir) });
    dpad(this, {
      centerX: this.scale.width / 2,
      bottomPadding: 16,
      buttonSize: 56,
      spacing: 60,
      alpha: 0.95,
      mode: "sticky",
      keyboard: false, // swipe() already maps the arrow keys
      onDirectionChange: (dir) => {
        if (dir) this.turn(dir);
      },
      enabled: () => !this.runEnded,
    });

    this.render();
    this.scheduleStep();
  }

  /** Queue a turn for the next move, unless it would reverse into the neck. */
  private turn(dir: Direction4): void {
    if (this.runEnded) return;
    if (canTurn(this.run.dir, dir)) this.wanted = dir;
  }

  /** Moves get quicker with every food, so each one schedules the next. */
  private scheduleStep(): void {
    this.time.delayedCall(nextSpeed(this.run.eaten), () => {
      if (this.runEnded) return;
      this.tick();
      if (!this.runEnded) this.scheduleStep();
    });
  }

  private tick(): void {
    const eatenAt = this.run.food;
    const { state, outcome } = step(this.run, this.wanted, BOARD, this.rng);
    this.run = state;

    if (outcome === "crashed") {
      this.render();
      this.shakeCamera(250, 0.01);
      this.flashCamera(120, 255, 50, 50);
      this.endRun(this.run.eaten);
      return;
    }

    if (outcome === "ate" && eatenAt) {
      this.hud.setScore(this.run.eaten);
      const { x, y } = this.cellCenter(eatenAt);
      this.hud.popup("+1", x, y - CELL);
      this.host.audio.play("score");
      this.host.haptics.tap();
      this.tweens.killTweensOf(this.food);
      this.tweens.add({
        targets: this.food,
        scale: { from: 0, to: this.foodScale },
        duration: 160,
      });
    }

    this.render();

    // The snake fills the whole board: nothing left to eat, so the run is won.
    if (!this.run.food) this.endRun(this.run.eaten);
  }

  private cellCenter(cell: Cell): { x: number; y: number } {
    return {
      x: this.boardX + cell.x * CELL + CELL / 2,
      y: BOARD_TOP + cell.y * CELL + CELL / 2,
    };
  }

  private drawBoard(): void {
    const w = BOARD.cols * CELL;
    const h = BOARD.rows * CELL;
    const x = this.boardX;
    const ink = hexToNumber(this.host.colors.ink);
    const g = this.add.graphics().setDepth(0);

    // A sticker-style board: hard ink shadow, green felt, ink outline.
    g.fillStyle(ink, 1).fillRoundedRect(x - 4, BOARD_TOP - 4 + 6, w + 8, h + 8, 12);
    g.fillStyle(BOARD_FILL, 1).fillRoundedRect(x - 4, BOARD_TOP - 4, w + 8, h + 8, 12);

    g.lineStyle(1, GRID_LINE, 0.6);
    for (let c = 1; c < BOARD.cols; c++) {
      g.lineBetween(x + c * CELL, BOARD_TOP, x + c * CELL, BOARD_TOP + h);
    }
    for (let r = 1; r < BOARD.rows; r++) {
      g.lineBetween(x, BOARD_TOP + r * CELL, x + w, BOARD_TOP + r * CELL);
    }

    g.lineStyle(4, ink, 1).strokeRoundedRect(x - 4, BOARD_TOP - 4, w + 8, h + 8, 12);
  }

  /** Redraw after every move: body segments, the rotated head sprite and the food. */
  private render(): void {
    const g = this.bodyGfx;
    g.clear();
    g.fillStyle(BODY_FILL, 1);
    g.lineStyle(2, BODY_LINE, 1);
    this.run.snake.forEach((seg, i) => {
      if (i === 0) return; // the head is a sprite
      const x = this.boardX + seg.x * CELL;
      const y = BOARD_TOP + seg.y * CELL;
      g.fillRoundedRect(x + 1, y + 1, CELL - 2, CELL - 2, 4);
      g.strokeRoundedRect(x + 1, y + 1, CELL - 2, CELL - 2, 4);
    });

    const head = this.run.snake[0];
    if (head) {
      const { x, y } = this.cellCenter(head);
      this.head.setPosition(x, y).setRotation(HEAD_ANGLE[this.run.dir]);
    }

    const food = this.run.food;
    this.food.setVisible(food !== null);
    if (food) {
      const { x, y } = this.cellCenter(food);
      this.food.setPosition(x, y);
    }
  }
}
