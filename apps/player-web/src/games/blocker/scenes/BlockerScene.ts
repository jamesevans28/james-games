import Phaser from "phaser";
import { BasePlatformScene } from "../../../platform/scenes/BasePlatformScene";
import { hexToNumber } from "../../../platform/hud/format";
import {
  anyFits,
  cellsOf,
  clearLines,
  emptyBoard,
  fits,
  GRID_SIZE,
  linesCompletedBy,
  pickPowerCell,
  place,
  withPower,
  type Board,
  type Pos,
  type PowerType,
} from "../useCases/board";
import { randomPiece, rotate, type Piece } from "../useCases/pieces";
import { lineClearPoints, placementPoints, powerCellFor } from "../useCases/scoring";
import {
  cellCentre,
  hitTestTray,
  placedCentre,
  slotCentres,
  snapToGrid,
  type GridGeometry,
  type Point,
} from "../useCases/layout";

const WIDTH = 540;
const CELL = 50;
const GRID_PX = GRID_SIZE * CELL;
/** Below the HUD (top ~140 px). */
const GRID: GridGeometry = { x: (WIDTH - GRID_PX) / 2, y: 170, cell: CELL, size: GRID_SIZE };
const BLOCK_PX = CELL - 6;

const TRAY_Y = 740;
/** Tray pieces are drawn smaller so three 3-wide pieces fit; they grow to board size when lifted. */
const TRAY_SCALE = 0.7;
/** Extra reach around a tray piece's cells, for small fingers. */
const TRAY_SLOP = 22;
const ROTATE_Y = 890;
const ROTATE_PX = 86;
/** Vertical drag gain: the piece travels up to the board faster than the finger. */
const DRAG_LIFT = 1.8;

const POWER_COLOR: Record<PowerType, number> = { cross: 0xffd600, blast: 0xd500f9 };

type CellView = { sprite: Phaser.GameObjects.Image; overlay?: Phaser.GameObjects.Graphics };
type Slot = { piece: Piece | null; view: Phaser.GameObjects.Container | null; home: Point };
type Drag = { slot: number; offsetX: number; offsetY: number };

export default class BlockerScene extends BasePlatformScene {
  private board: Board = emptyBoard();
  private views: (CellView | null)[][] = [];
  private slots: Slot[] = [];
  private drag: Drag | null = null;
  private score = 0;
  private rng: () => number = Math.random;

  private previewGfx!: Phaser.GameObjects.Graphics;
  private lineGfx!: Phaser.GameObjects.Graphics;
  private okColor = 0;
  private badColor = 0;
  private lineColor = 0;

  constructor() {
    super("BlockerScene");
  }

  preload() {
    this.load.svg("blocker-block", "/assets/blocker/block.svg", { width: 88, height: 88 });
    this.load.svg("blocker-rotate", "/assets/blocker/rotate.svg", { width: 172, height: 172 });
  }

  protected startRun() {
    // The scene object survives restarts: reset every per-run field first.
    this.board = emptyBoard();
    this.views = Array.from({ length: GRID_SIZE }, () =>
      Array.from({ length: GRID_SIZE }, (): CellView | null => null),
    );
    this.drag = null;
    this.score = 0;
    this.rng = this.host.rng();
    this.okColor = hexToNumber(this.host.colors.grass);
    this.badColor = hexToNumber(this.host.colors.tomato);
    this.lineColor = hexToNumber(this.host.colors.sun);

    this.drawGrid();
    this.lineGfx = this.add.graphics().setDepth(19);
    this.previewGfx = this.add.graphics().setDepth(20);

    this.slots = slotCentres(WIDTH).map((x) => ({
      piece: null,
      view: null,
      home: { x, y: TRAY_Y },
    }));
    this.slots.forEach((_, i) => this.deal(i));
    this.buildRotateButton();

    this.hud.setScore(0);
    this.hud.setBest(this.host.best.get());

    // Scene input listeners are removed by Phaser when the scene shuts down.
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => this.pickUp(p));
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => this.moveDrag(p));
    this.input.on(Phaser.Input.Events.POINTER_UP, () => this.drop());
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, () => this.drop());
  }

  protected onPause() {
    // A pointerup lost while paused would leave the piece stuck to the finger.
    this.cancelDrag();
  }

  // ---- drawing -------------------------------------------------------------

  private drawGrid() {
    const g = this.add.graphics();
    g.fillStyle(0x111a2b, 1);
    g.fillRoundedRect(GRID.x - 8, GRID.y - 8, GRID_PX + 16, GRID_PX + 16, 10);
    g.lineStyle(2, 0x1f2d46, 1);
    for (let i = 0; i <= GRID_SIZE; i++) {
      g.lineBetween(GRID.x, GRID.y + i * CELL, GRID.x + GRID_PX, GRID.y + i * CELL);
      g.lineBetween(GRID.x + i * CELL, GRID.y, GRID.x + i * CELL, GRID.y + GRID_PX);
    }
  }

  private block(x: number, y: number, color: number) {
    return this.add.image(x, y, "blocker-block").setDisplaySize(BLOCK_PX, BLOCK_PX).setTint(color);
  }

  private makePieceView(piece: Piece, at: Point) {
    const view = this.add.container(at.x, at.y).setDepth(30).setScale(TRAY_SCALE);
    const w = piece.width * CELL;
    const h = piece.height * CELL;
    for (const c of piece.cells) {
      view.add(
        this.block((c.x + 0.5) * CELL - w / 2, (c.y + 0.5) * CELL - h / 2, piece.shape.color),
      );
    }
    return view;
  }

  private buildRotateButton() {
    const button = this.add.image(WIDTH / 2, ROTATE_Y, "blocker-rotate");
    button.setDisplaySize(ROTATE_PX, ROTATE_PX).setDepth(40);
    const base = button.scale;
    button.setInteractive({ useHandCursor: true });
    button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      if (this.runEnded || this.drag) return;
      this.rotateTray();
      this.tweens.add({
        targets: button,
        scale: base * 0.92,
        duration: 140,
        yoyo: true,
        ease: "Sine.easeOut",
      });
    });
  }

  private drawPreview(piece: Piece, pos: Pos | null) {
    this.previewGfx.clear();
    this.lineGfx.clear();
    if (!pos) return;
    const ok = fits(this.board, piece, pos);
    const color = ok ? this.okColor : this.badColor;
    this.previewGfx.lineStyle(3, color, 0.9);
    this.previewGfx.fillStyle(color, 0.3);
    for (const p of cellsOf(piece, pos)) {
      const x = GRID.x + p.col * CELL;
      const y = GRID.y + p.row * CELL;
      this.previewGfx.fillRect(x + 3, y + 3, CELL - 6, CELL - 6);
      this.previewGfx.strokeRect(x + 4, y + 4, CELL - 8, CELL - 8);
    }
    if (!ok) return;
    const { rows, cols } = linesCompletedBy(this.board, piece, pos);
    this.lineGfx.fillStyle(this.lineColor, 0.2);
    rows.forEach((row) => this.lineGfx.fillRect(GRID.x, GRID.y + row * CELL, GRID_PX, CELL));
    cols.forEach((col) => this.lineGfx.fillRect(GRID.x + col * CELL, GRID.y, CELL, GRID_PX));
  }

  // ---- the tray --------------------------------------------------------------

  private setSlot(i: number, piece: Piece | null) {
    const slot = this.slots[i];
    if (!slot) return;
    slot.view?.destroy();
    slot.piece = piece;
    slot.view = piece ? this.makePieceView(piece, slot.home) : null;
  }

  private deal(i: number) {
    this.setSlot(i, randomPiece(this.rng));
  }

  private rotateTray() {
    this.slots.forEach((slot, i) => {
      if (slot.piece) this.setSlot(i, rotate(slot.piece));
    });
    this.host.audio.play("tap");
  }

  // ---- dragging ------------------------------------------------------------

  private pickUp(p: Phaser.Input.Pointer) {
    if (this.runEnded || this.drag) return;
    const i = hitTestTray(
      { x: p.x, y: p.y },
      this.slots.map((s) => ({ piece: s.piece, centre: s.home })),
      CELL * TRAY_SCALE,
      TRAY_SLOP,
    );
    const slot = this.slots[i];
    if (!slot?.view || !slot.piece) return;
    this.tweens.killTweensOf(slot.view);
    slot.view.setPosition(slot.home.x, slot.home.y).setScale(1);
    this.children.bringToTop(slot.view);
    this.drag = { slot: i, offsetX: p.x - slot.home.x, offsetY: p.y - slot.home.y };
    this.host.haptics.tap();
  }

  private moveDrag(p: Phaser.Input.Pointer) {
    const slot = this.drag && this.slots[this.drag.slot];
    if (!this.drag || !slot?.view || !slot.piece) return;
    slot.view.x = p.x - this.drag.offsetX;
    slot.view.y = slot.home.y + (p.y - this.drag.offsetY - slot.home.y) * DRAG_LIFT;
    this.drawPreview(slot.piece, snapToGrid(slot.piece, slot.view, GRID));
  }

  private drop() {
    const drag = this.drag;
    if (!drag) return;
    this.drag = null;
    this.previewGfx.clear();
    this.lineGfx.clear();
    const slot = this.slots[drag.slot];
    if (!slot?.view || !slot.piece) return;
    const pos = snapToGrid(slot.piece, slot.view, GRID);
    if (pos && fits(this.board, slot.piece, pos)) {
      this.placePiece(drag.slot, slot.piece, pos);
      return;
    }
    if (pos) this.host.audio.thud();
    this.tweens.add({
      targets: slot.view,
      x: slot.home.x,
      y: slot.home.y,
      scale: TRAY_SCALE,
      duration: 200,
      ease: "Sine.easeOut",
    });
  }

  private cancelDrag() {
    const drag = this.drag;
    if (!drag) return;
    this.drag = null;
    this.previewGfx.clear();
    this.lineGfx.clear();
    const slot = this.slots[drag.slot];
    slot?.view?.setPosition(slot.home.x, slot.home.y).setScale(TRAY_SCALE);
  }

  // ---- placing and clearing --------------------------------------------------

  private placePiece(i: number, piece: Piece, pos: Pos) {
    this.board = place(this.board, piece, pos);
    for (const p of cellsOf(piece, pos)) {
      const c = cellCentre(p, GRID);
      this.setView(p, { sprite: this.block(c.x, c.y, piece.shape.color).setDepth(10) });
    }
    this.setSlot(i, null);
    this.host.audio.pop();

    let points = placementPoints(piece);
    const result = clearLines(this.board);
    this.board = result.board;
    if (result.lines > 0) {
      result.triggered.forEach((power) => this.playPowerEffect(power));
      result.cleared.forEach((p) => this.removeView(p));
      points += lineClearPoints(result.cleared.length, result.lines);
      this.host.audio.play("score");
      this.host.haptics.success();

      const power = powerCellFor(result.lines);
      const at = power ? pickPowerCell(this.board, this.rng) : null;
      if (power && at) {
        this.board = withPower(this.board, at, power);
        this.decoratePower(at, power);
      }
    }

    this.score += points;
    this.hud.setScore(this.score);
    const centre = placedCentre(piece, pos, GRID);
    this.hud.popup(`+${points}`, centre.x, centre.y);

    this.deal(i);
    if (
      !anyFits(
        this.board,
        this.slots.map((s) => s.piece),
      )
    ) {
      this.hud.popup("No more moves!", WIDTH / 2, GRID.y + GRID_PX / 2, this.host.colors.tomato);
      this.endRun(this.score);
    }
  }

  private setView(p: Pos, view: CellView | null) {
    const row = this.views[p.row];
    if (row) row[p.col] = view;
  }

  private removeView(p: Pos) {
    const view = this.views[p.row]?.[p.col];
    if (!view) return;
    this.setView(p, null);
    const { sprite, overlay } = view;
    this.tweens.killTweensOf(overlay ? [sprite, overlay] : sprite);
    const fade = (target: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics) =>
      this.tweens.add({
        targets: target,
        alpha: 0,
        scale: target.scale * 0.4,
        duration: 220,
        ease: "Back.easeIn",
        onComplete: () => target.destroy(),
      });
    fade(sprite);
    if (overlay) fade(overlay);
  }

  private decoratePower(p: Pos, type: PowerType) {
    const view = this.views[p.row]?.[p.col];
    if (!view) return;
    const { sprite } = view;
    if (view.overlay) {
      this.tweens.killTweensOf(view.overlay);
      view.overlay.destroy();
    }
    this.tweens.killTweensOf(sprite);
    sprite.setDisplaySize(BLOCK_PX, BLOCK_PX).setAlpha(1).setTint(POWER_COLOR[type]);

    const overlay = this.add.graphics({ x: sprite.x, y: sprite.y }).setDepth(sprite.depth + 1);
    const icon = CELL - 20;
    const glow = CELL - 14;
    overlay.fillStyle(POWER_COLOR[type], 0.35);
    overlay.fillRoundedRect(-glow / 2, -glow / 2, glow, glow, 6);
    if (type === "cross") {
      const r = icon / 2 - 6;
      overlay.lineStyle(5, 0xffea00, 1);
      overlay.lineBetween(-r, 0, r, 0);
      overlay.lineBetween(0, -r, 0, r);
      overlay.lineStyle(3, 0xffffff, 0.8);
      overlay.lineBetween(-r, 0, r, 0);
      overlay.lineBetween(0, -r, 0, r);
    } else {
      overlay.fillStyle(0xffffff, 0.9);
      const burst = icon * 0.35;
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 * i) / 8;
        overlay.fillCircle(Math.cos(a) * burst, Math.sin(a) * burst, 3);
      }
      overlay.fillCircle(0, 0, 6);
    }
    view.overlay = overlay;

    // Pulse relative to each object's own scale (the sprite is scaled down to the cell).
    const pulse = (target: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics) =>
      this.tweens.add({
        targets: target,
        scale: { from: target.scale, to: target.scale * 1.08 },
        alpha: { from: 1, to: 0.75 },
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    pulse(sprite);
    pulse(overlay);
  }

  private playPowerEffect(power: Pos & { type: PowerType }) {
    const { x, y } = cellCentre(power, GRID);
    this.host.audio.ding();
    if (power.type === "cross") {
      this.playCrossEffect(x, y);
    } else {
      this.playBlastEffect(x, y);
    }
  }

  private playCrossEffect(x: number, y: number) {
    const directions = [
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
    ];
    directions.forEach(({ dx, dy }) => {
      const line = this.add.graphics().setDepth(850).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: line,
        duration: 350,
        ease: "Cubic.Out",
        onUpdate: (tween) => {
          const t = tween.progress;
          const d = GRID_PX * t;
          line.clear();
          line.lineStyle(8, 0xffea00, 0.95 * (1 - t * 0.5));
          line.lineBetween(x, y, x + dx * d, y + dy * d);
        },
        onComplete: () => line.destroy(),
      });
    });
  }

  private playBlastEffect(x: number, y: number) {
    const radius = CELL * 2.5;
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 * i) / 12;
      const dot = this.add
        .circle(x, y, 10, POWER_COLOR.blast, 0.9)
        .setDepth(850)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(a) * radius,
        y: y + Math.sin(a) * radius,
        scale: 0.3,
        alpha: 0,
        duration: 400,
        ease: "Quad.Out",
        onComplete: () => dot.destroy(),
      });
    }
    const flash = this.add
      .circle(x, y, CELL * 0.4, 0xffffff, 0.95)
      .setDepth(850)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: flash,
      scale: 5,
      alpha: 0,
      duration: 450,
      ease: "Expo.Out",
      onComplete: () => flash.destroy(),
    });
  }
}
