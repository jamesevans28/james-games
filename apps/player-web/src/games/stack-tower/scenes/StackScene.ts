import type Phaser from "phaser";
import { BasePlatformScene } from "../../../platform/scenes/BasePlatformScene";
import { tapZones } from "../../../platform/input";
import { hexToNumber } from "../../../platform/hud/format";
import { bounce, dropBlock, speedFor, type Span } from "../useCases/overlap";

const BLOCK_H = 44;
const BASE_W = 300;
/** Top edge of the base block (row 0). */
const BASE_Y = 840;
/** Rows shown above the base before the tower scrolls down. */
const VISIBLE_ROWS = 10;
/** A drop this close to the block below counts as perfect. */
const SNAP_PX = 6;
const OUTLINE = 5;

export default class StackScene extends BasePlatformScene {
  private tower: Span[] = [];
  private moving: Span = { x: 0, w: BASE_W };
  private dir: 1 | -1 = 1;
  private score = 0;
  private scroll = 0;
  private gfx!: Phaser.GameObjects.Graphics;
  private palette: number[] = [];
  private ink = 0;

  constructor() {
    super("StackScene");
  }

  protected startRun() {
    const { width } = this.scale;
    const c = this.host.colors;
    this.palette = [c.tomato, c.sun, c.grass, c.sky, c.grape].map(hexToNumber);
    this.ink = hexToNumber(c.ink);

    this.score = 0;
    this.scroll = 0;
    this.dir = 1;
    this.tower = [{ x: (width - BASE_W) / 2, w: BASE_W }];
    this.moving = { x: 0, w: BASE_W };
    this.gfx = this.add.graphics();

    this.hud.setScore(0);
    this.hud.setBest(this.host.best.get());
    tapZones(this, { count: 1, onTap: () => this.drop() });
    this.draw();
  }

  update(_time: number, delta: number) {
    if (this.runEnded) return;
    const step = (speedFor(this.score) * delta) / 1000;
    const next = bounce(this.moving.x, this.dir, step, 0, this.scale.width - this.moving.w);
    this.moving = { x: next.x, w: this.moving.w };
    this.dir = next.dir;

    const target = Math.max(0, this.tower.length - VISIBLE_ROWS) * BLOCK_H;
    this.scroll += (target - this.scroll) * Math.min(1, delta / 120);
    this.draw();
  }

  private rowY(row: number): number {
    return BASE_Y - row * BLOCK_H + this.scroll;
  }

  private colour(row: number): number {
    return this.palette[row % this.palette.length] ?? this.ink;
  }

  private drop() {
    if (this.runEnded) return;
    const row = this.tower.length;
    const below = this.tower[row - 1];
    if (!below) return;
    const { kept, cut, perfect } = dropBlock(this.moving, below, SNAP_PX);
    if (cut) this.fall(cut, row);
    if (!kept) {
      this.draw(false);
      this.endRun(this.score); // the platform shows the score dialog
      return;
    }

    this.tower.push(kept);
    this.score += 1;
    this.hud.setScore(this.score);
    this.hud.popup(perfect ? "Perfect!" : "+1", kept.x + kept.w / 2, this.rowY(row) - 10);
    this.host.audio.play(perfect ? "score" : "hit");
    this.host.haptics.tap();

    // The next block starts from the edge it is heading away from.
    this.dir = row % 2 === 0 ? 1 : -1;
    this.moving = { x: this.dir === 1 ? 0 : this.scale.width - kept.w, w: kept.w };
    this.draw();
  }

  /** The chopped-off piece tumbles away. Tweens are cleared on shutdown. */
  private fall(piece: Span, row: number) {
    const y = this.rowY(row);
    const rect = this.add
      .rectangle(piece.x + piece.w / 2, y + BLOCK_H / 2, piece.w, BLOCK_H, this.colour(row))
      .setStrokeStyle(OUTLINE, this.ink);
    this.tweens.add({
      targets: rect,
      y: y + 500,
      angle: piece.x < this.scale.width / 2 ? -30 : 30,
      alpha: 0,
      duration: 700,
      ease: "Quad.easeIn",
      onComplete: () => rect.destroy(),
    });
  }

  private draw(showMoving = true) {
    const g = this.gfx;
    g.clear();
    this.tower.forEach((span, row) => this.block(span, row));
    if (showMoving) this.block(this.moving, this.tower.length);
  }

  private block(span: Span, row: number) {
    const y = this.rowY(row);
    if (y > this.scale.height) return;
    this.gfx
      .fillStyle(this.colour(row), 1)
      .fillRect(span.x, y, span.w, BLOCK_H)
      .lineStyle(OUTLINE, this.ink, 1)
      .strokeRect(span.x, y, span.w, BLOCK_H);
  }
}
