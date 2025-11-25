import Phaser from "phaser";
import { dispatchGameOver } from "../../utils/gameEvents";

const GAME_WIDTH = 540;
const GAME_HEIGHT = 960;
const GRID_SIZE = 8;
const CELL_SIZE = 50;
const GRID_PIXEL = GRID_SIZE * CELL_SIZE;
const GRID_START_X = (GAME_WIDTH - GRID_PIXEL) / 2;
const GRID_START_Y = 150;
const SLOT_Y = GAME_HEIGHT - 220;
const ROTATE_BUTTON_Y = SLOT_Y + 150;
const BEST_KEY = "blocker-best";

const RAW_SHAPES = [
  { id: "domino", color: 0xff6f61, coords: [[0, 0], [1, 0]] },
  { id: "line-three", color: 0x8e24aa, coords: [[0, 0], [1, 0], [2, 0]] },
  { id: "corner-three", color: 0xffa726, coords: [[0, 0], [0, 1], [1, 1]] },
  { id: "t-three", color: 0x42a5f5, coords: [[0, 0], [1, 0], [2, 0], [1, 1]] },
  { id: "line-four", color: 0x29b6f6, coords: [[0, 0], [0, 1], [0, 2], [0, 3]] },
  { id: "square-four", color: 0xab47bc, coords: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: "zig-five", color: 0x66bb6a, coords: [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2]] },
  { id: "tee-five", color: 0xff7043, coords: [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]] },
  { id: "bar-six", color: 0x26c6da, coords: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]] },
  { id: "bolt-seven", color: 0xffd54f, coords: [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [3, 2], [3, 3]] },
] as const;

type PowerType = "cross" | "blast";

type ShapeCoord = { x: number; y: number };

interface ShapeDefinition {
  id: string;
  color: number;
  blocks: ShapeCoord[];
  width: number;
  height: number;
}

interface ShapeInstance {
  base: ShapeDefinition;
  color: number;
  blocks: ShapeCoord[];
  width: number;
  height: number;
  rotation: number;
}

interface GridCell {
  sprite: Phaser.GameObjects.Image;
  color: number;
  powerType?: PowerType;
  overlay?: Phaser.GameObjects.Graphics;
  powerPulseTween?: Phaser.Tweens.Tween;
}

interface ShapeSlot {
  shape: ShapeInstance | null;
  container: Phaser.GameObjects.Container | null;
  position: Phaser.Math.Vector2;
}

interface ActiveDrag {
  slotIndex: number;
  container: Phaser.GameObjects.Container;
  shape: ShapeInstance;
  offsetX: number;
  offsetY: number;
}

const SHAPES: ShapeDefinition[] = RAW_SHAPES.map((shape) => {
  const blockObjects = shape.coords.map(([x, y]) => ({ x, y }));
  const width = Math.max(...blockObjects.map((b) => b.x)) + 1;
  const height = Math.max(...blockObjects.map((b) => b.y)) + 1;
  return {
    id: shape.id,
    color: shape.color,
    blocks: blockObjects,
    width,
    height,
  };
});

export default class BlockerGame extends Phaser.Scene {
  private grid: (GridCell | null)[][] = [];
  private shapeSlots: ShapeSlot[] = [];
  private activeDrag?: ActiveDrag;
  private previewGraphics!: Phaser.GameObjects.Graphics;
  private linePreviewGraphics!: Phaser.GameObjects.Graphics;
  private gridGraphics!: Phaser.GameObjects.Graphics;
  private score = 0;
  private bestScore = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;
  private scoreTween?: Phaser.Tweens.Tween;
  private isGameOver = false;
  private pendingGameOver = false;
  private lastDropPoint: Phaser.Math.Vector2 | null = null;
  private gameOverOverlay?: Phaser.GameObjects.Rectangle;
  private gameOverMessage?: Phaser.GameObjects.Text;
  private gameOverDismissTimer?: Phaser.Time.TimerEvent;
  private gameOverPointerHandler?: () => void;

  constructor() {
    super({ key: "BlockerGame" });
  }

  preload() {
    this.load.svg("blocker-block", "/assets/blocker/block.svg", { scale: 1 });
    this.load.svg("blocker-rotate", "/assets/blocker/rotate.svg", { scale: 1 });
  }

  create() {
    this.cameras.main.setBackgroundColor("#04060b");
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0b1220, 0.85);

    this.gridGraphics = this.add.graphics();
    this.drawGrid();

    this.linePreviewGraphics = this.add.graphics();
    this.linePreviewGraphics.setDepth(19);

    this.previewGraphics = this.add.graphics();
    this.previewGraphics.setDepth(20);

    this.grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));

    this.scoreText = this.add.text(GAME_WIDTH / 2, 48, "Score: 0", {
      fontSize: "34px",
      color: "#fffde7",
      fontFamily: "Poppins, Arial, sans-serif",
    }).setOrigin(0.5, 0.5);
    this.scoreText.setStroke("#ffd180", 2);
    this.scoreText.setShadow(0, 0, "#ffe082", 6, true, true);

    this.bestScore = this.loadBestScore();
    this.bestText = this.add.text(GAME_WIDTH / 2, 96, `Best: ${this.bestScore}`, {
      fontSize: "24px",
      color: "#cfd8dc",
      fontFamily: "Poppins, Arial, sans-serif",
    }).setOrigin(0.5, 0.5);

    this.shapeSlots = [
      { shape: null, container: null, position: new Phaser.Math.Vector2(GAME_WIDTH * 0.3, SLOT_Y) },
      { shape: null, container: null, position: new Phaser.Math.Vector2(GAME_WIDTH * 0.7, SLOT_Y) },
    ];

    this.shapeSlots.forEach((_, index) => this.spawnShapeInSlot(index));
    this.buildRotateButton();

    this.input.on("pointermove", this.handlePointerMove, this);
    this.input.on("pointerup", this.handlePointerUp, this);
    this.input.on("pointerupoutside", this.handlePointerUp, this);
  }

  private createShapeInstance(base: ShapeDefinition, rotationSteps = 0): ShapeInstance {
    let blocks = base.blocks.map((b) => ({ ...b }));
    for (let i = 0; i < rotationSteps; i++) {
      blocks = blocks.map(({ x, y }) => ({ x: y, y: -x }));
      const minX = Math.min(...blocks.map((block) => block.x));
      const minY = Math.min(...blocks.map((block) => block.y));
      blocks = blocks.map((block) => ({ x: block.x - minX, y: block.y - minY }));
    }
    const width = Math.max(...blocks.map((b) => b.x)) + 1;
    const height = Math.max(...blocks.map((b) => b.y)) + 1;
    return {
      base,
      color: base.color,
      blocks,
      width,
      height,
      rotation: rotationSteps % 4,
    };
  }

  update() {}

  private drawGrid() {
    this.gridGraphics.clear();
    this.gridGraphics.fillStyle(0x111a2b, 1);
    this.gridGraphics.fillRect(GRID_START_X - 8, GRID_START_Y - 8, GRID_PIXEL + 16, GRID_PIXEL + 16);
    this.gridGraphics.lineStyle(2, 0x1f2d46, 1);

    for (let row = 0; row <= GRID_SIZE; row++) {
      const y = GRID_START_Y + row * CELL_SIZE;
      this.gridGraphics.lineBetween(GRID_START_X, y, GRID_START_X + GRID_PIXEL, y);
    }

    for (let col = 0; col <= GRID_SIZE; col++) {
      const x = GRID_START_X + col * CELL_SIZE;
      this.gridGraphics.lineBetween(x, GRID_START_Y, x, GRID_START_Y + GRID_PIXEL);
    }
  }

  private spawnShapeInSlot(slotIndex: number) {
    const slot = this.shapeSlots[slotIndex];
    if (!slot) return;

    const base = Phaser.Utils.Array.GetRandom(SHAPES);
    const instance = this.createShapeInstance(base);
    this.assignShapeToSlot(slotIndex, instance);
  }

  private createShapeContainer(shape: ShapeInstance) {
    const container = this.add.container(0, 0);
    const pixelWidth = shape.width * CELL_SIZE;
    const pixelHeight = shape.height * CELL_SIZE;
    
    // Fixed uniform hit box that extends downward and doesn't exceed screen center
    const hitWidth = 150;
    const hitHeight = 180;
    const hitOffsetY = 40;

    shape.blocks.forEach((block: ShapeCoord) => {
      const sprite = this.add.image(
        (block.x + 0.5) * CELL_SIZE - pixelWidth / 2,
        (block.y + 0.5) * CELL_SIZE - pixelHeight / 2,
        "blocker-block"
      );
      sprite.setDisplaySize(CELL_SIZE - 6, CELL_SIZE - 6);
      sprite.setTint(shape.color);
      container.add(sprite);
    });

    container.setSize(hitWidth, hitHeight);
    container.setDepth(30);
    container.setInteractive(
      new Phaser.Geom.Rectangle(-hitWidth / 2, -hitHeight / 2 + hitOffsetY, hitWidth, hitHeight),
      Phaser.Geom.Rectangle.Contains
    );
    if (container.input) {
      container.input.cursor = "pointer";
    }

    return container;
  }

  private assignShapeToSlot(slotIndex: number, shape: ShapeInstance) {
    const slot = this.shapeSlots[slotIndex];
    if (!slot) return;
    if (slot.container) {
      slot.container.destroy();
    }

    const container = this.createShapeContainer(shape);
    container.x = slot.position.x;
    container.y = slot.position.y;
    slot.shape = shape;
    slot.container = container;

    container.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.isGameOver || this.activeDrag) return;
      const currentShape = slot.shape;
      if (!currentShape) return;
      this.startDrag(slotIndex, container, currentShape, pointer);
    });
  }

  private buildRotateButton() {
    const button = this.add.image(GAME_WIDTH / 2, ROTATE_BUTTON_Y, "blocker-rotate");
    button.setDisplaySize(86, 86);
    button.setDepth(40);
    button.setInteractive({ cursor: "pointer" });
    button.on("pointerdown", () => {
      if (this.isGameOver || this.activeDrag) return;
      this.rotateAvailableShapes();
      this.tweens.add({
        targets: button,
        scale: 0.92,
        duration: 140,
        yoyo: true,
        ease: "Sine.easeOut",
      });
    });
  }

  private rotateAvailableShapes() {
    this.shapeSlots.forEach((_, index) => this.rotateShapeInSlot(index));
  }

  private rotateShapeInSlot(slotIndex: number) {
    const slot = this.shapeSlots[slotIndex];
    if (!slot || !slot.shape) return;
    if (this.activeDrag) return;
    const nextRotation = (slot.shape.rotation + 1) % 4;
    const updated = this.createShapeInstance(slot.shape.base, nextRotation);
    this.assignShapeToSlot(slotIndex, updated);
  }

  private startDrag(
    slotIndex: number,
    container: Phaser.GameObjects.Container,
    shape: ShapeInstance,
    pointer: Phaser.Input.Pointer
  ) {
    const offsetX = pointer.x - container.x;
    const offsetY = pointer.y - container.y;
    this.children.bringToTop(container);
    this.activeDrag = { slotIndex, container, shape, offsetX, offsetY };
    container.scale = 1.05;
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer) {
    if (!this.activeDrag) return;
    const { container, offsetX, offsetY, shape } = this.activeDrag;
    container.x = pointer.x - offsetX;
    container.y = pointer.y - offsetY;
    const target = this.getPlacementForShape(shape, container.x, container.y);
    this.renderPreview(shape, target);
  }

  private handlePointerUp() {
    if (!this.activeDrag) return;
    const { container, shape, slotIndex } = this.activeDrag;
    const target = this.getPlacementForShape(shape, container.x, container.y);

    if (target && this.canPlaceShapeAt(shape, target.row, target.col)) {
      this.placeShapeOnGrid(shape, target.row, target.col);
      container.destroy();
      this.shapeSlots[slotIndex].container = null;
      this.shapeSlots[slotIndex].shape = null;
      this.spawnShapeInSlot(slotIndex);
      this.resolveBoardState();
    } else {
      this.returnShapeToSlot(slotIndex);
      container.scale = 1;
    }

    this.previewGraphics.clear();
    this.linePreviewGraphics.clear();
    this.activeDrag = undefined;
  }

  private returnShapeToSlot(slotIndex: number) {
    const slot = this.shapeSlots[slotIndex];
    if (!slot || !slot.container) return;
    this.tweens.add({
      targets: slot.container,
      x: slot.position.x,
      y: slot.position.y,
      duration: 200,
      ease: "Sine.easeOut",
    });
  }

  private getPlacementForShape(
    shape: ShapeInstance,
    centerX: number,
    centerY: number
  ): { row: number; col: number } | undefined {
    const pixelWidth = shape.width * CELL_SIZE;
    const pixelHeight = shape.height * CELL_SIZE;
    const topLeftX = centerX - pixelWidth / 2;
    const topLeftY = centerY - pixelHeight / 2;

    if (
      topLeftX + pixelWidth < GRID_START_X - CELL_SIZE ||
      topLeftX > GRID_START_X + GRID_PIXEL + CELL_SIZE ||
      topLeftY + pixelHeight < GRID_START_Y - CELL_SIZE ||
      topLeftY > GRID_START_Y + GRID_PIXEL + CELL_SIZE
    ) {
      return undefined;
    }

    const col = Math.round((topLeftX - GRID_START_X) / CELL_SIZE);
    const row = Math.round((topLeftY - GRID_START_Y) / CELL_SIZE);

    return { row, col };
  }

  private renderPreview(shape: ShapeInstance, target?: { row: number; col: number }) {
    this.previewGraphics.clear();
    this.linePreviewGraphics.clear();
    if (!target) return;
    const valid = this.canPlaceShapeAt(shape, target.row, target.col);
    const color = valid ? 0x9ccc65 : 0xef5350;
    this.previewGraphics.lineStyle(3, color, 0.9);
    this.previewGraphics.fillStyle(color, 0.3);

    shape.blocks.forEach((block) => {
      const row = target.row + block.y;
      const col = target.col + block.x;
      const x = GRID_START_X + col * CELL_SIZE;
      const y = GRID_START_Y + row * CELL_SIZE;
      this.previewGraphics.fillRect(x + 3, y + 3, CELL_SIZE - 6, CELL_SIZE - 6);
      this.previewGraphics.strokeRect(x + 4, y + 4, CELL_SIZE - 8, CELL_SIZE - 8);
    });

    if (valid) {
      const lines = this.predictLinesForPlacement(shape, target.row, target.col);
      this.drawLineHighlights(lines.rows, lines.cols);
    }
  }

  private predictLinesForPlacement(shape: ShapeInstance, baseRow: number, baseCol: number) {
    const placement = new Set<string>();
    const touchedRows = new Set<number>();
    const touchedCols = new Set<number>();

    shape.blocks.forEach((block) => {
      const row = baseRow + block.y;
      const col = baseCol + block.x;
      if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) {
        return;
      }
      placement.add(`${row}:${col}`);
      touchedRows.add(row);
      touchedCols.add(col);
    });

    const rows: number[] = [];
    touchedRows.forEach((row) => {
      if (row < 0 || row >= GRID_SIZE) return;
      for (let col = 0; col < GRID_SIZE; col++) {
        if (!this.grid[row][col] && !placement.has(`${row}:${col}`)) {
          return;
        }
      }
      rows.push(row);
    });

    const cols: number[] = [];
    touchedCols.forEach((col) => {
      if (col < 0 || col >= GRID_SIZE) return;
      for (let row = 0; row < GRID_SIZE; row++) {
        if (!this.grid[row][col] && !placement.has(`${row}:${col}`)) {
          return;
        }
      }
      cols.push(col);
    });

    return { rows, cols };
  }

  private drawLineHighlights(rows: number[], cols: number[]) {
    if (!rows.length && !cols.length) {
      return;
    }
    this.linePreviewGraphics.clear();
    rows.forEach((row) => {
      const y = GRID_START_Y + row * CELL_SIZE;
      this.linePreviewGraphics.fillStyle(0xfff59d, 0.2);
      this.linePreviewGraphics.fillRect(GRID_START_X, y, GRID_PIXEL, CELL_SIZE);
    });
    cols.forEach((col) => {
      const x = GRID_START_X + col * CELL_SIZE;
      this.linePreviewGraphics.fillStyle(0xfff59d, 0.18);
      this.linePreviewGraphics.fillRect(x, GRID_START_Y, CELL_SIZE, GRID_PIXEL);
    });
  }

  private canPlaceShapeAt(shape: ShapeInstance, baseRow: number, baseCol: number) {
    return shape.blocks.every((block) => {
      const row = baseRow + block.y;
      const col = baseCol + block.x;
      if (row < 0 || col < 0 || row >= GRID_SIZE || col >= GRID_SIZE) return false;
      return this.grid[row][col] === null;
    });
  }

  private placeShapeOnGrid(shape: ShapeInstance, baseRow: number, baseCol: number) {
    this.lastDropPoint = this.computePlacementCenter(shape, baseRow, baseCol);
    shape.blocks.forEach((block) => {
      const row = baseRow + block.y;
      const col = baseCol + block.x;
      const sprite = this.add.image(
        GRID_START_X + col * CELL_SIZE + CELL_SIZE / 2,
        GRID_START_Y + row * CELL_SIZE + CELL_SIZE / 2,
        "blocker-block"
      );
      sprite.setDisplaySize(CELL_SIZE - 6, CELL_SIZE - 6);
      sprite.setTint(shape.color);
      sprite.setDepth(10);
      this.grid[row][col] = { sprite, color: shape.color };
    });
  }

  private computePlacementCenter(shape: ShapeInstance, baseRow: number, baseCol: number) {
    const count = shape.blocks.length || 1;
    let sumX = 0;
    let sumY = 0;
    shape.blocks.forEach((block) => {
      sumX += baseCol + block.x + 0.5;
      sumY += baseRow + block.y + 0.5;
    });
    const avgCol = sumX / count;
    const avgRow = sumY / count;
    const x = GRID_START_X + avgCol * CELL_SIZE;
    const y = GRID_START_Y + avgRow * CELL_SIZE;
    return new Phaser.Math.Vector2(x, y);
  }

  private resolveBoardState() {
    const lineResult = this.clearCompletedLines();
    if (lineResult.blocksCleared > 0) {
      const scoreGain = this.calculateScore(lineResult.blocksCleared, lineResult.linesCleared);
      this.updateScore(this.score + scoreGain);
      this.showScorePopup(scoreGain);
      if (lineResult.powerToCreate) {
        this.injectPowerUp(lineResult.powerToCreate);
      }
    }

    this.time.delayedCall(150, () => this.checkForMoves());
  }

  private clearCompletedLines() {
    const rowsCleared: number[] = [];
    const colsCleared: number[] = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      if (this.grid[row].every((cell) => cell)) {
        rowsCleared.push(row);
      }
    }
    for (let col = 0; col < GRID_SIZE; col++) {
      if (this.grid.every((row) => row[col])) {
        colsCleared.push(col);
      }
    }

    const cellsToClear = new Set<string>();
    const powersTriggered: { row: number; col: number; type: PowerType }[] = [];

    rowsCleared.forEach((row) => {
      for (let col = 0; col < GRID_SIZE; col++) {
        const key = `${row}:${col}`;
        cellsToClear.add(key);
        const cell = this.grid[row][col];
        if (cell?.powerType) {
          powersTriggered.push({ row, col, type: cell.powerType });
        }
      }
    });

    colsCleared.forEach((col) => {
      for (let row = 0; row < GRID_SIZE; row++) {
        const key = `${row}:${col}`;
        cellsToClear.add(key);
        const cell = this.grid[row][col];
        if (cell?.powerType) {
          powersTriggered.push({ row, col, type: cell.powerType });
        }
      }
    });

    powersTriggered.forEach((power) => {
      this.playPowerActivationEffect(power);
      const extra = this.getCellsFromPower(power);
      extra.forEach((key) => cellsToClear.add(key));
    });

    const totalCleared: { row: number; col: number }[] = [];
    cellsToClear.forEach((key) => {
      const [rowStr, colStr] = key.split(":");
      const row = Number(rowStr);
      const col = Number(colStr);
      const cell = this.grid[row][col];
      if (cell) {
        this.animateCellRemoval(cell);
        this.grid[row][col] = null;
        totalCleared.push({ row, col });
      }
    });

    let powerToCreate: PowerType | null = null;
    if (rowsCleared.length + colsCleared.length >= 3) {
      powerToCreate = "blast";
    } else if (rowsCleared.length + colsCleared.length === 2) {
      powerToCreate = "cross";
    }

    return {
      rowsCleared,
      colsCleared,
      blocksCleared: totalCleared.length,
      linesCleared: rowsCleared.length + colsCleared.length,
      powerToCreate,
    };
  }

  private getCellsFromPower(power: { row: number; col: number; type: PowerType }) {
    const affected = new Set<string>();
    if (power.type === "cross") {
      for (let i = 0; i < GRID_SIZE; i++) {
        affected.add(`${power.row}:${i}`);
        affected.add(`${i}:${power.col}`);
      }
    } else {
      for (let row = power.row - 2; row <= power.row + 2; row++) {
        for (let col = power.col - 2; col <= power.col + 2; col++) {
          if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
            affected.add(`${row}:${col}`);
          }
        }
      }
    }
    return affected;
  }

  private calculateScore(blocksCleared: number, linesCleared: number) {
    const base = blocksCleared * 10;
    const multiplier = linesCleared >= 3 ? 2.5 : linesCleared === 2 ? 1.8 : linesCleared === 1 ? 1.3 : 1;
    return Math.round(base * multiplier);
  }

  private updateScore(newScore: number) {
    const start = this.score;
    this.score = newScore;
    if (this.scoreTween) {
      this.scoreTween.stop();
    }

    this.scoreTween = this.tweens.addCounter({
      from: start,
      to: newScore,
      duration: 450,
      onUpdate: (tween) => {
        const tweenValue = tween.getValue();
        const value = Math.round((tweenValue ?? newScore));
        this.scoreText.setText(`Score: ${value}`);
      },
      onComplete: () => {
        this.scoreText.setText(`Score: ${this.score}`);
      },
    });

    if (newScore > this.bestScore) {
      this.bestScore = newScore;
      this.bestText.setText(`Best: ${this.bestScore}`);
      try {
        window.localStorage?.setItem(BEST_KEY, String(this.bestScore));
      } catch (error) {
        // ignore storage issues
      }
    }
  }

  private showScorePopup(amount: number) {
    if (amount <= 0) return;
    const point = this.lastDropPoint ?? new Phaser.Math.Vector2(GAME_WIDTH / 2, GRID_START_Y + GRID_PIXEL / 2);
    const popup = this.add.text(point.x, point.y, `+${amount}`, {
      fontSize: "28px",
      fontFamily: "'Press Start 2P', 'Courier New', monospace",
      color: "#fff59d",
      stroke: "#5d4037",
      strokeThickness: 6,
      align: "center",
    }).setOrigin(0.5);
    popup.setShadow(0, 0, "#fff9c4", 12, true, true);
    this.tweens.add({
      targets: popup,
      y: point.y - 80,
      alpha: 0,
      duration: 900,
      ease: "Cubic.Out",
      onComplete: () => popup.destroy(),
    });
  }

  private animateCellRemoval(cell: GridCell) {
    if (cell.powerPulseTween) {
      cell.powerPulseTween.stop();
      cell.powerPulseTween = undefined;
    }
    const targets: Phaser.GameObjects.GameObject[] = [cell.sprite];
    if (cell.overlay) {
      targets.push(cell.overlay);
    }
    this.tweens.add({
      targets,
      alpha: 0,
      scale: 0.4,
      duration: 220,
      ease: "Back.easeIn",
      onComplete: () => {
        cell.sprite.destroy();
        cell.overlay?.destroy();
        cell.overlay = undefined;
      },
    });
  }

  private playPowerActivationEffect(power: { row: number; col: number; type: PowerType }) {
    const x = GRID_START_X + power.col * CELL_SIZE + CELL_SIZE / 2;
    const y = GRID_START_Y + power.row * CELL_SIZE + CELL_SIZE / 2;
    
    if (power.type === "cross") {
      this.playCrossEffect(x, y);
    } else {
      this.playBlastEffect(x, y);
    }
  }

  private playCrossEffect(x: number, y: number) {
    const lineColor = 0xffea00;
    const lineWidth = 8;
    const duration = 350;
    const maxDistance = GRID_PIXEL;
    
    const directions = [
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
    ];
    
    directions.forEach((dir) => {
      const line = this.add.graphics();
      line.setDepth(850);
      line.setBlendMode(Phaser.BlendModes.ADD);
      
      this.tweens.add({
        targets: line,
        duration,
        ease: "Cubic.Out",
        onUpdate: (tween) => {
          const progress = tween.progress;
          const distance = maxDistance * progress;
          const endX = x + dir.dx * distance;
          const endY = y + dir.dy * distance;
          const alpha = 0.95 * (1 - progress * 0.5);
          line.clear();
          line.lineStyle(lineWidth, lineColor, alpha);
          line.lineBetween(x, y, endX, endY);
        },
        onComplete: () => line.destroy(),
      });
    });
  }

  private playBlastEffect(x: number, y: number) {
    const burstCount = 12;
    const radius = CELL_SIZE * 2.5;
    
    for (let i = 0; i < burstCount; i++) {
      const angle = (Math.PI * 2 * i) / burstCount;
      const circle = this.add.circle(x, y, 10, 0xd500f9, 0.9);
      circle.setDepth(850);
      circle.setBlendMode(Phaser.BlendModes.ADD);
      
      const targetX = x + Math.cos(angle) * radius;
      const targetY = y + Math.sin(angle) * radius;
      
      this.tweens.add({
        targets: circle,
        x: targetX,
        y: targetY,
        scale: 0.3,
        alpha: 0,
        duration: 400,
        ease: "Quad.Out",
        onComplete: () => circle.destroy(),
      });
    }
    
    const coreFlash = this.add.circle(x, y, CELL_SIZE * 0.4, 0xffffff, 0.95);
    coreFlash.setDepth(850);
    coreFlash.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: coreFlash,
      scale: 5,
      alpha: 0,
      duration: 450,
      ease: "Expo.Out",
      onComplete: () => coreFlash.destroy(),
    });
  }

  private decoratePowerCell(cell: GridCell, type: PowerType) {
    if (cell.overlay) {
      cell.overlay.destroy();
      cell.overlay = undefined;
    }
    if (cell.powerPulseTween) {
      cell.powerPulseTween.stop();
      cell.powerPulseTween = undefined;
    }
    const baseColor = type === "blast" ? 0xd500f9 : 0xffd600;
    cell.sprite.setTint(baseColor);
    const overlay = this.add.graphics({ x: cell.sprite.x, y: cell.sprite.y });
    overlay.setDepth(cell.sprite.depth + 1);
    const innerSize = CELL_SIZE - 20;
    if (type === "cross") {
      overlay.fillStyle(0xffd600, 0.4);
      overlay.fillRoundedRect(-innerSize / 2, -innerSize / 2, innerSize, innerSize, 8);
      overlay.lineStyle(5, 0xffea00, 1);
      overlay.lineBetween(-innerSize / 2 + 6, 0, innerSize / 2 - 6, 0);
      overlay.lineBetween(0, -innerSize / 2 + 6, 0, innerSize / 2 - 6);
      overlay.lineStyle(3, 0xffffff, 0.8);
      overlay.lineBetween(-innerSize / 2 + 6, 0, innerSize / 2 - 6, 0);
      overlay.lineBetween(0, -innerSize / 2 + 6, 0, innerSize / 2 - 6);
    } else {
      overlay.fillStyle(0xd500f9, 0.45);
      overlay.fillRoundedRect(-innerSize / 2, -innerSize / 2, innerSize, innerSize, 10);
      overlay.fillStyle(0xffffff, 0.9);
      const burstRadius = innerSize * 0.35;
      const points = 8;
      for (let i = 0; i < points; i++) {
        const angle = (Math.PI * 2 * i) / points;
        const x = Math.cos(angle) * burstRadius;
        const y = Math.sin(angle) * burstRadius;
        overlay.fillCircle(x, y, 3);
      }
      overlay.fillCircle(0, 0, 6);
    }
    cell.overlay = overlay;
  }

  private injectPowerUp(type: PowerType) {
    const occupied: { row: number; col: number }[] = [];
    this.grid.forEach((row, rIdx) => {
      row.forEach((cell, cIdx) => {
        if (cell) {
          occupied.push({ row: rIdx, col: cIdx });
        }
      });
    });

    if (!occupied.length) return;
    const choice = Phaser.Utils.Array.GetRandom(occupied);
    const cell = this.grid[choice.row][choice.col];
    if (!cell) return;
    cell.powerType = type;
    this.decoratePowerCell(cell, type);
    if (cell.overlay) {
      cell.powerPulseTween = this.tweens.add({
        targets: [cell.sprite, cell.overlay],
        scale: { from: 1, to: 1.08 },
        alpha: { from: 1, to: 0.75 },
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  }

  private checkForMoves() {
    if (this.isGameOver) return;
    const hasMoves = this.shapeSlots.some((slot) => {
      if (!slot.shape) return false;
      // Check all 4 rotations of the shape
      for (let rotation = 0; rotation < 4; rotation++) {
        const rotatedShape = this.createShapeInstance(slot.shape.base, rotation);
        for (let row = 0; row < GRID_SIZE; row++) {
          for (let col = 0; col < GRID_SIZE; col++) {
            if (this.canPlaceShapeAt(rotatedShape, row, col)) {
              return true;
            }
          }
        }
      }
      return false;
    });

    if (!hasMoves) {
      this.scheduleGameOver();
    }
  }

  private scheduleGameOver() {
    if (this.pendingGameOver || this.isGameOver) return;
    this.pendingGameOver = true;
    this.time.delayedCall(1000, () => {
      if (!this.isGameOver) {
        this.triggerGameOver();
      }
    });
  }

  private triggerGameOver() {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.pendingGameOver = false;
    this.previewGraphics.clear();
    this.linePreviewGraphics.clear();
    const overlay = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x0b0d11,
      0.82
    );
    overlay.setDepth(900);
    overlay.setScrollFactor(0);
    overlay.setInteractive();
    this.gameOverOverlay = overlay;

    const message = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "NO MORE MOVES", {
      fontSize: "58px",
      color: "#fff8e1",
      fontFamily: "Poppins, Arial, sans-serif",
      fontStyle: "bold",
      stroke: "#ff7043",
      strokeThickness: 6,
      align: "center",
    }).setOrigin(0.5);
    message.setDepth(901);
    message.setShadow(0, 0, "#ffcdd2", 16, true, true);
    this.gameOverMessage = message;

    let resolved = false;
    const finalize = () => {
      if (resolved) return;
      resolved = true;
      this.gameOverDismissTimer?.remove(false);
      this.gameOverDismissTimer = undefined;
      if (this.gameOverPointerHandler) {
        this.input.off("pointerdown", this.gameOverPointerHandler);
        this.gameOverPointerHandler = undefined;
      }
      this.gameOverOverlay?.destroy();
      this.gameOverOverlay = undefined;
      this.gameOverMessage?.destroy();
      this.gameOverMessage = undefined;
      dispatchGameOver({ gameId: "blocker", score: this.score, ts: Date.now() });
    };

    const pointerHandler = () => finalize();
    this.gameOverPointerHandler = pointerHandler;
    this.input.once("pointerdown", pointerHandler);
    this.gameOverDismissTimer = this.time.delayedCall(5000, finalize);
  }

  private loadBestScore() {
    try {
      const stored = window.localStorage?.getItem(BEST_KEY);
      return stored ? Number(stored) || 0 : 0;
    } catch (error) {
      return 0;
    }
  }
}
