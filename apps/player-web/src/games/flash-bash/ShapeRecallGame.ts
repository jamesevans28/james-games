import Phaser from "phaser";
import { dispatchGameOver } from "../../utils/gameEvents";

const GAME_ID = "flash-bash";

const SHAPES = ["circle", "square", "triangle", "star", "diamond", "hexagon"];
const COLORS = [0xff0000, 0x0000ff, 0x00ff00, 0xffff00, 0xff00ff, 0xffa500]; // red, blue, green, yellow, purple, orange

const BUTTON_POSITIONS = [
  { x: 100, y: 100 }, // top-left
  { x: 700, y: 100 }, // top-right
  { x: 100, y: 500 }, // bottom-left
  { x: 700, y: 500 }, // bottom-right
  { x: 100, y: 300 }, // left-center
  { x: 700, y: 300 }, // right-center
];

const CENTER_X = 400;
const CENTER_Y = 300;
const FLASH_DURATION = 500; // ms
const INPUT_TIME = 3000; // ms per input

export default class ShapeRecallGame extends Phaser.Scene {
  private buttons: Phaser.GameObjects.Container[] = [];
  private sequence: number[] = [];
  private playerIndex = 0;
  private score = 0;
  private level = 1;
  private timerBar!: Phaser.GameObjects.Rectangle;
  private timerTween?: Phaser.Tweens.Tween;
  private isPlayingSequence = false;
  private isPlayerTurn = false;
  private shapeAssignments: { shape: string; color: number }[] = [];

  preload() {
    // No assets needed, using graphics
  }

  create() {
    // Create patterned background
    this.createBackground();

    // Create timer bar at bottom
    this.timerBar = this.add.rectangle(400, 550, 600, 20, 0x00ff00);
    this.timerBar.setOrigin(0.5);
    // Make it rounded
    (this.timerBar as any).setStrokeStyle(2, 0x000000);

    // Create buttons
    this.createButtons();

    // Start game
    this.startNewSequence();
    // small read to avoid TypeScript "declared but never read" when variable
    // is assigned but not otherwise inspected. This line has no runtime
    // effect but keeps the build clean while the implementation evolves.
    void this.isPlayingSequence;
  }

  createBackground() {
    const graphics = this.add.graphics();
    graphics.fillStyle(0xf0f0f0); // light gray
    graphics.fillRect(0, 0, 800, 600);

    // Add dotted pattern
    graphics.fillStyle(0xcccccc);
    for (let x = 0; x < 800; x += 20) {
      for (let y = 0; y < 600; y += 20) {
        graphics.fillCircle(x, y, 1);
      }
    }
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

    this.buttons = [];
    for (let i = 0; i < 6; i++) {
      const pos = BUTTON_POSITIONS[i];
      const container = this.add.container(pos.x, pos.y);

      // Shadow
      const shadow = this.add.circle(2, 2, 42, 0x000000, 0.3);
      container.add(shadow);

      // Button bg
      const bg = this.add.circle(0, 0, 40, 0xffffff);
      bg.setStrokeStyle(4, 0x000000);
      container.add(bg);

      // Draw shape
      const shape = this.drawShape(
        0,
        0,
        this.shapeAssignments[i].shape,
        this.shapeAssignments[i].color
      );
      container.add(shape);

      container.setInteractive(new Phaser.Geom.Circle(0, 0, 40), Phaser.Geom.Circle.Contains);
      container.on("pointerdown", () => this.onButtonPress(i));
      container.on("pointerover", () => {
        bg.setFillStyle(0xdddddd);
        this.tweens.add({
          targets: container,
          scale: 1.1,
          duration: 100,
          yoyo: true,
        });
      });
      container.on("pointerout", () => bg.setFillStyle(0xffffff));

      this.buttons.push(container);
    }
  }

  drawShape(x: number, y: number, shape: string, color: number): Phaser.GameObjects.Graphics {
    const graphics = this.add.graphics();
    graphics.lineStyle(4, 0x000000, 1); // black stroke
    graphics.fillStyle(color);
    switch (shape) {
      case "circle":
        graphics.fillCircle(x, y, 30);
        graphics.strokeCircle(x, y, 30);
        break;
      case "square":
        graphics.fillRect(x - 30, y - 30, 60, 60);
        graphics.strokeRect(x - 30, y - 30, 60, 60);
        break;
      case "triangle":
        graphics.beginPath();
        graphics.moveTo(x, y - 30);
        graphics.lineTo(x - 30, y + 30);
        graphics.lineTo(x + 30, y + 30);
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();
        break;
      case "star":
        // Simple star
        graphics.fillPoints([
          { x: x, y: y - 30 },
          { x: x + 10, y: y - 10 },
          { x: x + 30, y: y - 10 },
          { x: x + 15, y: y + 5 },
          { x: x + 20, y: y + 30 },
          { x: x, y: y + 15 },
          { x: x - 20, y: y + 30 },
          { x: x - 15, y: y + 5 },
          { x: x - 30, y: y - 10 },
          { x: x - 10, y: y - 10 },
        ]);
        graphics.strokePoints([
          { x: x, y: y - 30 },
          { x: x + 10, y: y - 10 },
          { x: x + 30, y: y - 10 },
          { x: x + 15, y: y + 5 },
          { x: x + 20, y: y + 30 },
          { x: x, y: y + 15 },
          { x: x - 20, y: y + 30 },
          { x: x - 15, y: y + 5 },
          { x: x - 30, y: y - 10 },
          { x: x - 10, y: y - 10 },
        ]);
        break;
      case "diamond":
        graphics.beginPath();
        graphics.moveTo(x, y - 30);
        graphics.lineTo(x + 30, y);
        graphics.lineTo(x, y + 30);
        graphics.lineTo(x - 30, y);
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();
        break;
      case "hexagon":
        graphics.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          const px = x + 30 * Math.cos(angle);
          const py = y + 30 * Math.sin(angle);
          if (i === 0) graphics.moveTo(px, py);
          else graphics.lineTo(px, py);
        }
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();
        break;
    }
    return graphics;
  }

  startNewSequence() {
    this.level++;
    this.sequence.push(Phaser.Math.Between(0, 5));
    this.playerIndex = 0;
    this.isPlayingSequence = true;
    this.isPlayerTurn = false;
    this.createButtons(); // Reassign shapes/colors
    this.playSequence();
  }

  playSequence() {
    let i = 0;
    const playNext = () => {
      if (i >= this.sequence.length) {
        this.isPlayingSequence = false;
        this.isPlayerTurn = true;
        this.startTimer();
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
        const progress = tween.progress;
        if (progress > 0.7) {
          this.timerBar.setFillStyle(0xff0000);
          // Add sparkle effect? For simplicity, just color change
        }
      },
      onComplete: () => {
        this.gameOver();
      },
    });
  }

  onButtonPress(index: number) {
    if (!this.isPlayerTurn) return;
    this.timerTween?.stop();
    this.flashShape(index);
    if (index === this.sequence[this.playerIndex]) {
      this.score += 1;
      this.playerIndex++;
      if (this.playerIndex >= this.sequence.length) {
        // Sequence complete
        this.score += 3;
        this.showBonus();
        this.time.delayedCall(1000, () => this.startNewSequence());
      } else {
        this.startTimer();
      }
    } else {
      this.gameOver();
    }
  }

  showBonus() {
    const text = this.add.text(CENTER_X, CENTER_Y, "+3", { fontSize: "48px", color: "#000" });
    this.time.delayedCall(500, () => text.destroy());
  }

  gameOver() {
    dispatchGameOver({ gameId: GAME_ID, score: this.score });
    this.scene.restart();
  }
}
