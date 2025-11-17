import Phaser from "phaser";
import { trackGameStart } from "../../utils/analytics";
import { dispatchGameOver } from "../../utils/gameEvents";

const GAME_ID = "serpento";
const GRID_SIZE = 30; // Size of each grid cell in pixels
const GRID_COLS = 15; // Number of columns
const GRID_ROWS = 22; // Number of rows
const INITIAL_SPEED = 200; // milliseconds between moves
const SPEED_INCREASE = 5; // milliseconds faster per food eaten
const MIN_SPEED = 80; // minimum milliseconds between moves

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";
type Position = { x: number; y: number };

export default class SerpentoGame extends Phaser.Scene {
  private snake: Position[] = [];
  private direction: Direction = "RIGHT";
  private nextDirection: Direction = "RIGHT";
  private food: Position | null = null;
  private moveTimer: Phaser.Time.TimerEvent | null = null;
  private currentSpeed: number = INITIAL_SPEED;

  private score = 0;
  private best = 0;
  private gameOver = false;

  private gridOffsetX = 0;
  private gridOffsetY = 0;

  private snakeGraphics!: Phaser.GameObjects.Graphics;
  private foodSprite!: Phaser.GameObjects.Sprite;
  private scoreText!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;

  private leftButton!: Phaser.GameObjects.Container;
  private rightButton!: Phaser.GameObjects.Container;

  constructor() {
    super("SerpentoGame");
  }

  preload(): void {
    this.load.svg("snake-head", "/assets/serpento/snake-head.svg");
    this.load.svg("food", "/assets/serpento/food.svg");
  }

  create(): void {
    const { width, height } = this.scale;

    // Calculate offsets to center the grid
    const gridWidth = GRID_COLS * GRID_SIZE;
    this.gridOffsetX = Math.floor((width - gridWidth) / 2);
    this.gridOffsetY = 60; // Space for score at top

    // Reset state
    this.gameOver = false;
    this.score = 0;
    this.currentSpeed = INITIAL_SPEED;
    this.direction = "RIGHT";
    this.nextDirection = "RIGHT";

    // Load best score
    this.best = Number(localStorage.getItem(`${GAME_ID}-best`) || 0) || 0;

    // Create background
    this.createBackground(width, height);

    // Initialize snake in the middle
    const startX = Math.floor(GRID_COLS / 2);
    const startY = Math.floor(GRID_ROWS / 2);
    this.snake = [
      { x: startX, y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY },
    ];

    // Graphics for snake body
    this.snakeGraphics = this.add.graphics();

    // Spawn initial food
    this.spawnFood();

    // Create food sprite
    this.foodSprite = this.add.sprite(0, 0, "food").setDepth(2);

    // UI
    this.createUI(width, height);

    // Controls
    this.createControls(width, height);

    // Start movement timer
    this.startMoveTimer();

    trackGameStart(GAME_ID, "Serpento");

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.moveTimer?.remove();
    });
  }

  update(): void {
    if (this.gameOver) return;

    // Update food sprite position
    if (this.food) {
      const foodScreenX = this.gridOffsetX + this.food.x * GRID_SIZE + GRID_SIZE / 2;
      const foodScreenY = this.gridOffsetY + this.food.y * GRID_SIZE + GRID_SIZE / 2;
      this.foodSprite.setPosition(foodScreenX, foodScreenY);
    }

    // Redraw snake
    this.drawSnake();
  }

  private createBackground(width: number, height: number): void {
    // Dark green background
    this.add.rectangle(0, 0, width, height, 0x2d5016).setOrigin(0, 0).setDepth(-2);

    // Grid background
    const gridWidth = GRID_COLS * GRID_SIZE;
    const gridHeight = GRID_ROWS * GRID_SIZE;
    this.add
      .rectangle(this.gridOffsetX, this.gridOffsetY, gridWidth, gridHeight, 0x3d6826)
      .setOrigin(0, 0)
      .setDepth(-1);

    // Draw grid lines
    const gridGraphics = this.add.graphics();
    gridGraphics.lineStyle(1, 0x4d7836, 0.3);
    for (let x = 0; x <= GRID_COLS; x++) {
      gridGraphics.lineBetween(
        this.gridOffsetX + x * GRID_SIZE,
        this.gridOffsetY,
        this.gridOffsetX + x * GRID_SIZE,
        this.gridOffsetY + gridHeight
      );
    }
    for (let y = 0; y <= GRID_ROWS; y++) {
      gridGraphics.lineBetween(
        this.gridOffsetX,
        this.gridOffsetY + y * GRID_SIZE,
        this.gridOffsetX + gridWidth,
        this.gridOffsetY + y * GRID_SIZE
      );
    }
    gridGraphics.setDepth(0);
  }

  private createUI(width: number, _height: number): void {
    // Score text
    this.scoreText = this.add
      .text(width / 2, 20, `Score: ${this.score}`, {
        fontFamily: "Fredoka, sans-serif",
        fontSize: "22px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0)
      .setDepth(10);

    // Best score
    this.bestText = this.add
      .text(width / 2, 42, `Best: ${this.best}`, {
        fontFamily: "Fredoka, sans-serif",
        fontSize: "16px",
        color: "#A0D957",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0)
      .setDepth(10);
  }

  private createControls(width: number, height: number): void {
    const buttonY = height - 80;
    const buttonSize = 70;
    const spacing = 100;

    // Left button
    const leftX = width / 2 - spacing;
    this.leftButton = this.add.container(leftX, buttonY).setDepth(10);

    const leftBg = this.add.circle(0, 0, buttonSize / 2, 0x8fbc4b, 1);
    leftBg.setStrokeStyle(4, 0x6b9c3d);

    const leftArrow = this.add.graphics();
    leftArrow.fillStyle(0xffffff, 1);
    leftArrow.fillTriangle(-15, 0, 15, -12, 15, 12);

    this.leftButton.add([leftBg, leftArrow]);
    this.leftButton.setSize(buttonSize, buttonSize);
    this.leftButton.setInteractive({ useHandCursor: true });

    this.leftButton.on("pointerdown", () => {
      if (this.gameOver) return;
      this.turnLeft();
      this.tweens.add({
        targets: leftBg,
        scaleX: 0.9,
        scaleY: 0.9,
        duration: 80,
        yoyo: true,
      });
    });

    // Right button
    const rightX = width / 2 + spacing;
    this.rightButton = this.add.container(rightX, buttonY).setDepth(10);

    const rightBg = this.add.circle(0, 0, buttonSize / 2, 0x8fbc4b, 1);
    rightBg.setStrokeStyle(4, 0x6b9c3d);

    const rightArrow = this.add.graphics();
    rightArrow.fillStyle(0xffffff, 1);
    rightArrow.fillTriangle(15, 0, -15, -12, -15, 12);

    this.rightButton.add([rightBg, rightArrow]);
    this.rightButton.setSize(buttonSize, buttonSize);
    this.rightButton.setInteractive({ useHandCursor: true });

    this.rightButton.on("pointerdown", () => {
      if (this.gameOver) return;
      this.turnRight();
      this.tweens.add({
        targets: rightBg,
        scaleX: 0.9,
        scaleY: 0.9,
        duration: 80,
        yoyo: true,
      });
    });

    // Keyboard controls
    this.input.keyboard?.on("keydown-LEFT", () => {
      if (!this.gameOver) this.turnLeft();
    });
    this.input.keyboard?.on("keydown-RIGHT", () => {
      if (!this.gameOver) this.turnRight();
    });
    this.input.keyboard?.on("keydown-A", () => {
      if (!this.gameOver) this.turnLeft();
    });
    this.input.keyboard?.on("keydown-D", () => {
      if (!this.gameOver) this.turnRight();
    });
  }

  private turnLeft(): void {
    const current = this.direction;
    if (current === "UP") this.nextDirection = "LEFT";
    else if (current === "LEFT") this.nextDirection = "DOWN";
    else if (current === "DOWN") this.nextDirection = "RIGHT";
    else if (current === "RIGHT") this.nextDirection = "UP";
  }

  private turnRight(): void {
    const current = this.direction;
    if (current === "UP") this.nextDirection = "RIGHT";
    else if (current === "RIGHT") this.nextDirection = "DOWN";
    else if (current === "DOWN") this.nextDirection = "LEFT";
    else if (current === "LEFT") this.nextDirection = "UP";
  }

  private startMoveTimer(): void {
    this.moveTimer?.remove();
    this.moveTimer = this.time.addEvent({
      delay: this.currentSpeed,
      loop: true,
      callback: () => {
        if (!this.gameOver) {
          this.moveSnake();
        }
      },
    });
  }

  private moveSnake(): void {
    // Update direction
    this.direction = this.nextDirection;

    // Calculate new head position
    const head = this.snake[0];
    let newHead: Position;

    switch (this.direction) {
      case "UP":
        newHead = { x: head.x, y: head.y - 1 };
        break;
      case "DOWN":
        newHead = { x: head.x, y: head.y + 1 };
        break;
      case "LEFT":
        newHead = { x: head.x - 1, y: head.y };
        break;
      case "RIGHT":
        newHead = { x: head.x + 1, y: head.y };
        break;
    }

    // Check wall collision
    if (newHead.x < 0 || newHead.x >= GRID_COLS || newHead.y < 0 || newHead.y >= GRID_ROWS) {
      this.onGameOver();
      return;
    }

    // Check self collision
    if (this.snake.some((segment) => segment.x === newHead.x && segment.y === newHead.y)) {
      this.onGameOver();
      return;
    }

    // Add new head
    this.snake.unshift(newHead);

    // Check food collision
    if (this.food && newHead.x === this.food.x && newHead.y === this.food.y) {
      this.eatFood();
    } else {
      // Remove tail (snake doesn't grow)
      this.snake.pop();
    }
  }

  private eatFood(): void {
    this.score += 1;
    this.scoreText.setText(`Score: ${this.score}`);

    // Update best score
    if (this.score > this.best) {
      this.best = this.score;
      localStorage.setItem(`${GAME_ID}-best`, String(this.best));
      this.bestText.setText(`Best: ${this.best}`);
    }

    // Increase speed
    this.currentSpeed = Math.max(MIN_SPEED, this.currentSpeed - SPEED_INCREASE);
    this.startMoveTimer();

    // Animate food collection
    this.tweens.add({
      targets: this.foodSprite,
      scaleX: 1.3,
      scaleY: 1.3,
      alpha: 0,
      duration: 150,
      onComplete: () => {
        this.foodSprite.setScale(1);
        this.foodSprite.setAlpha(1);
      },
    });

    // Animate score text
    this.tweens.add({
      targets: this.scoreText,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 100,
      yoyo: true,
    });

    // Spawn new food
    this.spawnFood();
  }

  private spawnFood(): void {
    const available: Position[] = [];

    // Find all empty positions
    for (let x = 0; x < GRID_COLS; x++) {
      for (let y = 0; y < GRID_ROWS; y++) {
        const occupied = this.snake.some((segment) => segment.x === x && segment.y === y);
        if (!occupied) {
          available.push({ x, y });
        }
      }
    }

    if (available.length > 0) {
      this.food = Phaser.Utils.Array.GetRandom(available);
    } else {
      // Grid is full - shouldn't happen in normal gameplay
      this.food = null;
    }
  }

  private drawSnake(): void {
    this.snakeGraphics.clear();

    // Draw body segments
    for (let i = this.snake.length - 1; i >= 0; i--) {
      const segment = this.snake[i];
      const screenX = this.gridOffsetX + segment.x * GRID_SIZE;
      const screenY = this.gridOffsetY + segment.y * GRID_SIZE;

      if (i === 0) {
        // Head - brighter green
        this.snakeGraphics.fillStyle(0xa0d957, 1);
        this.snakeGraphics.lineStyle(2, 0x6b9c3d, 1);
      } else {
        // Body - regular green
        this.snakeGraphics.fillStyle(0x8fbc4b, 1);
        this.snakeGraphics.lineStyle(2, 0x6b9c3d, 1);
      }

      this.snakeGraphics.fillRoundedRect(screenX + 1, screenY + 1, GRID_SIZE - 2, GRID_SIZE - 2, 3);
      this.snakeGraphics.strokeRoundedRect(
        screenX + 1,
        screenY + 1,
        GRID_SIZE - 2,
        GRID_SIZE - 2,
        3
      );
    }

    // Draw eyes on head
    if (this.snake.length > 0) {
      const head = this.snake[0];
      const headScreenX = this.gridOffsetX + head.x * GRID_SIZE;
      const headScreenY = this.gridOffsetY + head.y * GRID_SIZE;

      this.snakeGraphics.fillStyle(0xffffff, 1);

      // Position eyes based on direction
      let eye1X = headScreenX + 6;
      let eye1Y = headScreenY + 6;
      let eye2X = headScreenX + 14;
      let eye2Y = headScreenY + 6;

      if (this.direction === "DOWN") {
        eye1Y = headScreenY + 14;
        eye2Y = headScreenY + 14;
      } else if (this.direction === "LEFT") {
        eye1X = headScreenX + 6;
        eye1Y = headScreenY + 6;
        eye2X = headScreenX + 6;
        eye2Y = headScreenY + 14;
      } else if (this.direction === "RIGHT") {
        eye1X = headScreenX + 14;
        eye1Y = headScreenY + 6;
        eye2X = headScreenX + 14;
        eye2Y = headScreenY + 14;
      }

      this.snakeGraphics.fillCircle(eye1X, eye1Y, 2);
      this.snakeGraphics.fillCircle(eye2X, eye2Y, 2);

      // Pupils
      this.snakeGraphics.fillStyle(0x000000, 1);
      this.snakeGraphics.fillCircle(eye1X, eye1Y, 1);
      this.snakeGraphics.fillCircle(eye2X, eye2Y, 1);
    }

    this.snakeGraphics.setDepth(1);
  }

  private onGameOver(): void {
    if (this.gameOver) return;
    this.gameOver = true;

    this.moveTimer?.remove();

    // Camera shake
    this.cameras.main.shake(250, 0.01);
    this.cameras.main.flash(120, 255, 50, 50);

    // Game over overlay
    const { width, height } = this.scale;
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
    overlay.setDepth(100);

    const gameOverText = this.add
      .text(width / 2, height / 2 - 40, "Game Over", {
        fontFamily: "Fredoka, sans-serif",
        fontSize: "48px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(101);

    const tapText = this.add
      .text(width / 2, height / 2 + 20, "Tap to Restart", {
        fontFamily: "Fredoka, sans-serif",
        fontSize: "22px",
        color: "#A0D957",
      })
      .setOrigin(0.5)
      .setDepth(101);

    // Dispatch game over event with delay
    const GAME_OVER_DISPATCH_DELAY = 900;
    try {
      this.time.delayedCall(GAME_OVER_DISPATCH_DELAY, () => {
        try {
          dispatchGameOver({ gameId: GAME_ID, score: this.score, ts: Date.now() });
        } catch {
          // ignore dispatch errors
        }
      });
    } catch {
      // ignore scheduling errors
    }

    // Restart on tap
    const restart = () => {
      overlay.destroy();
      gameOverText.destroy();
      tapText.destroy();
      this.scene.restart();
      trackGameStart(GAME_ID, "Serpento");
    };

    this.time.delayedCall(900, () => {
      this.input.once("pointerdown", restart);
    });
  }
}
