import Phaser from "phaser";
import { dispatchGameOver } from "../../utils/gameEvents";
import { getRandomCategory, getRandomWord, type Category } from "./data";

const PLAY_WIDTH = 540;
const PLAY_HEIGHT = 960;
const GAME_ID = "word-rush";
const LEVEL_TIME_SECONDS = 120; // 2 minutes

type TileData = {
  letter: string;
  revealed: boolean;
  container: Phaser.GameObjects.Container;
};

export default class WordRushGameScene extends Phaser.Scene {
  private selectedLetters: string[] = [];
  private boughtLetters: string[] = []; // Track letters bought during gameplay
  private currentAnswer: string = "";
  private currentCategory!: Category;
  private level: number = 1;
  private totalScore: number = 0;
  private timeRemaining: number = LEVEL_TIME_SECONDS;
  private timerText!: Phaser.GameObjects.Text;
  private categoryText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private inputText!: Phaser.GameObjects.Text;
  private giveUpButton!: Phaser.GameObjects.Container;
  private buyLetterButton!: Phaser.GameObjects.Container;
  private submitButton!: Phaser.GameObjects.Container;
  private onScreenKeyboard!: Phaser.GameObjects.Container;
  private keyboardKeys: Map<string, Phaser.GameObjects.Container> = new Map();
  private tiles: TileData[] = [];
  private currentInput: string = "";
  private gameActive: boolean = false;
  private timerEvent?: Phaser.Time.TimerEvent;


  constructor() {
    super("WordRushGame");
  }

  init(data: { selectedLetters: string[] }) {
    this.selectedLetters = data.selectedLetters || [];
    this.level = 1;
    this.totalScore = 0;
    this.timeRemaining = LEVEL_TIME_SECONDS;
    this.currentInput = "";
    this.gameActive = false;
  }

  create() {
    this.createBackground();
    this.createUI();
    this.createOnScreenKeyboard();
    this.startLevel();
    this.setupKeyboardInput();
  }

  private createBackground() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x1e3a8a, 0x1e3a8a, 0x0f172a, 0x0f172a, 1);
    g.fillRect(0, 0, PLAY_WIDTH, PLAY_HEIGHT);
  }

  private createUI() {
    // Level display - smaller font and with padding
    this.levelText = this.add
      .text(15, 15, `Level ${this.level}`, {
        fontFamily: "Arial, sans-serif",
        fontSize: "20px",
        fontStyle: "bold",
        color: "#fbbf24",
      });

    // Score display - smaller font and with padding
    this.scoreText = this.add
      .text(PLAY_WIDTH - 15, 15, `Score: ${this.totalScore}`, {
        fontFamily: "Arial, sans-serif",
        fontSize: "20px",
        fontStyle: "bold",
        color: "#10b981",
      })
      .setOrigin(1, 0);

    // Timer display
    this.timerText = this.add
      .text(PLAY_WIDTH / 2, 60, this.formatTime(this.timeRemaining), {
        fontFamily: "Arial, sans-serif",
        fontSize: "48px",
        fontStyle: "bold",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    // Category display
    this.categoryText = this.add
      .text(PLAY_WIDTH / 2, 120, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "22px",
        fontStyle: "italic",
        color: "#60a5fa",
      })
      .setOrigin(0.5);

    // Input display (moved up to make room for keyboard)
    this.inputText = this.add
      .text(PLAY_WIDTH / 2, PLAY_HEIGHT - 380, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "28px",
        fontStyle: "bold",
        color: "#fbbf24",
        backgroundColor: "#1f2937",
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5);

    // Create action buttons (Give Up, Buy Letter, Submit)
    this.createActionButtons();
  }

  private createActionButtons() {
    const buttonY = PLAY_HEIGHT - 320; // Moved higher to avoid keyboard overlap
    const buttonWidth = 105; // Slightly narrower
    const buttonHeight = 46;
    const sidePadding = 20; // Padding from sides

    // Give Up button (left) - with padding from edge
    this.giveUpButton = this.add.container(sidePadding + buttonWidth / 2, buttonY);
    const giveUpBg = this.add.rectangle(0, 0, buttonWidth, buttonHeight, 0xef4444);
    giveUpBg.setStrokeStyle(3, 0x991b1b);
    const giveUpText = this.add
      .text(0, 0, "GIVE UP", {
        fontFamily: "Arial, sans-serif",
        fontSize: "18px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    this.giveUpButton.add([giveUpBg, giveUpText]);
    this.giveUpButton.setSize(buttonWidth, buttonHeight);
    this.giveUpButton.setInteractive({ useHandCursor: true });
    this.giveUpButton.on("pointerdown", () => {
      if (this.gameActive) {
        this.showGiveUpConfirmation();
      }
    });
    this.giveUpButton.on("pointerover", () => {
      giveUpBg.setFillStyle(0xdc2626);
    });
    this.giveUpButton.on("pointerout", () => {
      giveUpBg.setFillStyle(0xef4444);
    });

    // Buy Letter button (center)
    this.buyLetterButton = this.add.container(PLAY_WIDTH / 2, buttonY);
    const buyLetterBg = this.add.rectangle(0, 0, buttonWidth, buttonHeight, 0x3b82f6);
    buyLetterBg.setStrokeStyle(3, 0x1e40af);
    const buyLetterText = this.add
      .text(0, 0, "BUY\nLETTER", {
        fontFamily: "Arial, sans-serif",
        fontSize: "15px",
        fontStyle: "bold",
        color: "#ffffff",
        align: "center",
        lineSpacing: -5,
      })
      .setOrigin(0.5);
    this.buyLetterButton.add([buyLetterBg, buyLetterText]);
    this.buyLetterButton.setSize(buttonWidth, buttonHeight);
    this.buyLetterButton.setInteractive({ useHandCursor: true });
    this.buyLetterButton.on("pointerdown", () => {
      if (this.gameActive && this.timeRemaining >= 30) {
        this.showBuyLetterConfirmation();
      }
    });
    this.buyLetterButton.on("pointerover", () => {
      if (this.timeRemaining >= 30) {
        buyLetterBg.setFillStyle(0x2563eb);
      }
    });
    this.buyLetterButton.on("pointerout", () => {
      buyLetterBg.setFillStyle(0x3b82f6);
    });

    // Submit button (right) - with padding from edge
    this.submitButton = this.add.container(PLAY_WIDTH - sidePadding - buttonWidth / 2, buttonY);
    const submitBg = this.add.rectangle(0, 0, buttonWidth, buttonHeight, 0x10b981);
    submitBg.setStrokeStyle(3, 0x047857);
    const submitText = this.add
      .text(0, 0, "SUBMIT", {
        fontFamily: "Arial, sans-serif",
        fontSize: "18px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    this.submitButton.add([submitBg, submitText]);
    this.submitButton.setSize(buttonWidth, buttonHeight);
    this.submitButton.setInteractive({ useHandCursor: true });
    this.submitButton.on("pointerdown", () => {
      if (this.gameActive) {
        this.checkAnswer();
      }
    });
    this.submitButton.on("pointerover", () => {
      submitBg.setFillStyle(0x059669);
    });
    this.submitButton.on("pointerout", () => {
      submitBg.setFillStyle(0x10b981);
    });
  }

  private updateBuyLetterButton() {
    // Grey out if less than 30 seconds
    const bg = this.buyLetterButton.getAt(0) as Phaser.GameObjects.Rectangle;
    const text = this.buyLetterButton.getAt(1) as Phaser.GameObjects.Text;
    
    if (this.timeRemaining < 30) {
      bg.setFillStyle(0x6b7280);
      bg.setStrokeStyle(3, 0x4b5563);
      text.setAlpha(0.5);
      this.buyLetterButton.removeInteractive();
    } else {
      bg.setFillStyle(0x3b82f6);
      bg.setStrokeStyle(3, 0x1e40af);
      text.setAlpha(1);
      this.buyLetterButton.setInteractive({ useHandCursor: true });
    }
  }

  private showGiveUpConfirmation() {
    // Pause the game
    const wasActive = this.gameActive;
    this.gameActive = false;
    
    // Dim background
    const overlay = this.add.rectangle(
      PLAY_WIDTH / 2,
      PLAY_HEIGHT / 2,
      PLAY_WIDTH,
      PLAY_HEIGHT,
      0x000000,
      0.7
    );

    // Confirmation box
    const boxWidth = 400;
    const boxHeight = 250;
    const box = this.add.rectangle(
      PLAY_WIDTH / 2,
      PLAY_HEIGHT / 2,
      boxWidth,
      boxHeight,
      0x1f2937
    );
    box.setStrokeStyle(4, 0xef4444);

    // Title
    const title = this.add
      .text(PLAY_WIDTH / 2, PLAY_HEIGHT / 2 - 70, "GIVE UP?", {
        fontFamily: "Arial, sans-serif",
        fontSize: "36px",
        fontStyle: "bold",
        color: "#ef4444",
      })
      .setOrigin(0.5);

    // Message
    const message = this.add
      .text(
        PLAY_WIDTH / 2,
        PLAY_HEIGHT / 2 - 20,
        "Are you sure you want to give up?\nYou will keep your current score.",
        {
          fontFamily: "Arial, sans-serif",
          fontSize: "18px",
          color: "#cbd5e0",
          align: "center",
          wordWrap: { width: boxWidth - 40 },
        }
      )
      .setOrigin(0.5);

    // Yes button
    const yesButton = this.add.container(PLAY_WIDTH / 2 - 80, PLAY_HEIGHT / 2 + 70);
    const yesBg = this.add.rectangle(0, 0, 140, 60, 0xef4444);
    yesBg.setStrokeStyle(3, 0x991b1b);
    const yesText = this.add
      .text(0, 0, "YES", {
        fontFamily: "Arial, sans-serif",
        fontSize: "24px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    yesButton.add([yesBg, yesText]);
    yesButton.setSize(140, 60);
    yesButton.setInteractive({ useHandCursor: true });

    // No button
    const noButton = this.add.container(PLAY_WIDTH / 2 + 80, PLAY_HEIGHT / 2 + 70);
    const noBg = this.add.rectangle(0, 0, 140, 60, 0x10b981);
    noBg.setStrokeStyle(3, 0x059669);
    const noText = this.add
      .text(0, 0, "NO", {
        fontFamily: "Arial, sans-serif",
        fontSize: "24px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    noButton.add([noBg, noText]);
    noButton.setSize(140, 60);
    noButton.setInteractive({ useHandCursor: true });

    // Cleanup function
    const cleanup = () => {
      overlay.destroy();
      box.destroy();
      title.destroy();
      message.destroy();
      yesButton.destroy();
      noButton.destroy();
    };

    // Yes button handler
    yesButton.on("pointerdown", () => {
      this.playErrorSound();
      cleanup();
      this.revealAllTiles();
    });

    yesButton.on("pointerover", () => {
      yesBg.setFillStyle(0xdc2626);
    });

    yesButton.on("pointerout", () => {
      yesBg.setFillStyle(0xef4444);
    });

    // No button handler
    noButton.on("pointerdown", () => {
      this.playSelectSound();
      cleanup();
      this.gameActive = wasActive; // Resume game
    });

    noButton.on("pointerover", () => {
      noBg.setFillStyle(0x059669);
    });

    noButton.on("pointerout", () => {
      noBg.setFillStyle(0x10b981);
    });
  }

  private showBuyLetterConfirmation() {
    // Pause the game
    const wasActive = this.gameActive;
    this.gameActive = false;
    
    // Dim background
    const overlay = this.add.rectangle(
      PLAY_WIDTH / 2,
      PLAY_HEIGHT / 2,
      PLAY_WIDTH,
      PLAY_HEIGHT,
      0x000000,
      0.7
    );

    // Confirmation box
    const boxWidth = 400;
    const boxHeight = 250;
    const box = this.add.rectangle(
      PLAY_WIDTH / 2,
      PLAY_HEIGHT / 2,
      boxWidth,
      boxHeight,
      0x1f2937
    );
    box.setStrokeStyle(4, 0x3b82f6);

    // Title
    const title = this.add
      .text(PLAY_WIDTH / 2, PLAY_HEIGHT / 2 - 70, "BUY A LETTER?", {
        fontFamily: "Arial, sans-serif",
        fontSize: "32px",
        fontStyle: "bold",
        color: "#3b82f6",
      })
      .setOrigin(0.5);

    // Message
    const message = this.add
      .text(
        PLAY_WIDTH / 2,
        PLAY_HEIGHT / 2 - 20,
        "This will reveal a random letter\nand all its instances.\n\nCost: 30 seconds",
        {
          fontFamily: "Arial, sans-serif",
          fontSize: "18px",
          color: "#cbd5e0",
          align: "center",
          wordWrap: { width: boxWidth - 40 },
        }
      )
      .setOrigin(0.5);

    // Buy button
    const buyButton = this.add.container(PLAY_WIDTH / 2 - 80, PLAY_HEIGHT / 2 + 70);
    const buyBg = this.add.rectangle(0, 0, 140, 60, 0x3b82f6);
    buyBg.setStrokeStyle(3, 0x1e40af);
    const buyText = this.add
      .text(0, 0, "BUY", {
        fontFamily: "Arial, sans-serif",
        fontSize: "24px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    buyButton.add([buyBg, buyText]);
    buyButton.setSize(140, 60);
    buyButton.setInteractive({ useHandCursor: true });

    // Cancel button
    const cancelButton = this.add.container(PLAY_WIDTH / 2 + 80, PLAY_HEIGHT / 2 + 70);
    const cancelBg = this.add.rectangle(0, 0, 140, 60, 0x6b7280);
    cancelBg.setStrokeStyle(3, 0x4b5563);
    const cancelText = this.add
      .text(0, 0, "CANCEL", {
        fontFamily: "Arial, sans-serif",
        fontSize: "24px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    cancelButton.add([cancelBg, cancelText]);
    cancelButton.setSize(140, 60);
    cancelButton.setInteractive({ useHandCursor: true });

    // Cleanup function
    const cleanup = () => {
      overlay.destroy();
      box.destroy();
      title.destroy();
      message.destroy();
      buyButton.destroy();
      cancelButton.destroy();
    };

    // Buy button handler
    buyButton.on("pointerdown", () => {
      this.playSelectSound();
      cleanup();
      this.buyRandomLetter();
      this.gameActive = wasActive;
    });

    buyButton.on("pointerover", () => {
      buyBg.setFillStyle(0x2563eb);
    });

    buyButton.on("pointerout", () => {
      buyBg.setFillStyle(0x3b82f6);
    });

    // Cancel button handler
    cancelButton.on("pointerdown", () => {
      this.playSelectSound();
      cleanup();
      this.gameActive = wasActive; // Resume game
    });

    cancelButton.on("pointerover", () => {
      cancelBg.setFillStyle(0x4b5563);
    });

    cancelButton.on("pointerout", () => {
      cancelBg.setFillStyle(0x6b7280);
    });
  }

  private async buyRandomLetter() {
    // Deduct 30 seconds
    this.timeRemaining = Math.max(0, this.timeRemaining - 30);
    this.timerText.setText(this.formatTime(this.timeRemaining));
    this.updateBuyLetterButton();

    // Get all unrevealed letters from the answer
    const unrevealedLetters = new Set<string>();
    this.tiles.forEach(tile => {
      if (!tile.revealed && tile.letter !== ' ') {
        unrevealedLetters.add(tile.letter);
      }
    });

    if (unrevealedLetters.size === 0) return;

    // Pick a random letter
    const lettersArray = Array.from(unrevealedLetters);
    const randomLetter = lettersArray[Math.floor(Math.random() * lettersArray.length)];

    // Add to bought letters and highlight on keyboard
    if (!this.boughtLetters.includes(randomLetter)) {
      this.boughtLetters.push(randomLetter);
      this.highlightSelectedKeys(); // Re-highlight to show bought letter in green
    }

    // Find all tiles with this letter
    const tilesToReveal = this.tiles.filter(
      tile => tile.letter === randomLetter && !tile.revealed
    );

    // Reveal them with animation
    for (const tile of tilesToReveal) {
      this.revealTile(tile.container, tile.letter);
      tile.revealed = true;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  private startLevel() {
    // Clear bought letters for new level
    this.boughtLetters = [];
    
    // Select random category and word, ensuring no word is longer than 9 letters
    this.currentCategory = getRandomCategory();
    
    // Keep trying until we find a word where all individual words are 9 letters or less
    let attempts = 0;
    do {
      this.currentAnswer = getRandomWord(this.currentCategory);
      attempts++;
      // Fallback to prevent infinite loop (though unlikely)
      if (attempts > 50) {
        console.warn("Could not find suitable word, using current one");
        break;
      }
    } while (this.currentAnswer.split(" ").some(word => word.length > 9));

    this.categoryText.setText(`Category: ${this.currentCategory.name}`);
    this.levelText.setText(`Level ${this.level}`);
    
    // Highlight selected letters on keyboard
    this.highlightSelectedKeys();

    // Create tiles
    this.createTiles();

    // Start reveal animation
    this.revealSelectedLetters();
  }

  private createTiles() {
    this.tiles = [];
    const answer = this.currentAnswer;
    const words = answer.split(" ");

    let startY = 150; // Raised from 200 to provide more space above buttons
    const tileSize = 42; // Reduced from 46
    const tileSpacing = 6; // Reduced from 7
    const wordSpacing = 16; // Reduced from 18
    const interWordSpacing = 8; // Reduced from 10
    const maxLineLength = 9; // Max letters per line (not including spaces between words)

    // Group words into lines
    const lines: string[][] = [];
    let currentLine: string[] = [];
    let currentLineLength = 0;

    words.forEach((word) => {
      const wordLength = word.length;
      // Add 1 for space between words if not first word in line
      const lengthWithSpace = currentLine.length > 0 ? wordLength + 1 : wordLength;

      if (currentLineLength + lengthWithSpace <= maxLineLength) {
        // Word fits on current line
        currentLine.push(word);
        currentLineLength += lengthWithSpace;
      } else {
        // Start new line
        if (currentLine.length > 0) {
          lines.push(currentLine);
        }
        currentLine = [word];
        currentLineLength = wordLength;
      }
    });
    
    // Add last line
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    // Create tiles for each line
    lines.forEach((lineWords) => {
      // Calculate total width needed for this line
      const totalLetters = lineWords.reduce((sum, w) => sum + w.length, 0);
      const numSpaces = lineWords.length - 1; // Spaces between words
      const lineWidth = totalLetters * (tileSize + tileSpacing) - tileSpacing + 
                        numSpaces * interWordSpacing;
      
      let startX = (PLAY_WIDTH - lineWidth) / 2 + tileSize / 2;

      lineWords.forEach((word) => {
        for (let i = 0; i < word.length; i++) {
          const letter = word[i];
          const x = startX + i * (tileSize + tileSpacing);
          const y = startY + tileSize / 2;

          const container = this.createTile(x, y, letter, tileSize);
          const revealed = this.selectedLetters.includes(letter);

          this.tiles.push({
            letter,
            revealed,
            container,
          });
        }

        // Move X position for next word (add word length + space)
        startX += word.length * (tileSize + tileSpacing) + interWordSpacing;
      });

      // Move to next line
      startY += tileSize + wordSpacing;
    });
  }

  private createTile(
    x: number,
    y: number,
    letter: string,
    size: number
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    // Tile background (dull initially)
    const tile = this.add.rectangle(0, 0, size, size, 0x64748b);
    tile.setStrokeStyle(2, 0x1e293b);

    // Letter text (hidden initially)
    const text = this.add
      .text(0, 0, letter, {
        fontFamily: "Arial, sans-serif",
        fontSize: "32px",
        fontStyle: "bold",
        color: "#1e293b",
      })
      .setOrigin(0.5)
      .setVisible(false);

    container.add([tile, text]);
    container.setData("tile", tile);
    container.setData("text", text);
    container.setData("revealed", false);

    return container;
  }

  private async revealSelectedLetters() {
    // Reveal tiles with selected letters with animation
    let delay = 0;

    for (const tileData of this.tiles) {
      if (tileData.revealed) {
        this.time.delayedCall(delay, () => {
          this.revealTile(tileData.container, tileData.letter);
        });
        delay += 500; // 0.5 seconds apart
      }
    }

    // Start game after all reveals
    this.time.delayedCall(delay + 500, () => {
      this.gameActive = true;
      this.startTimer();
    });
  }

  private revealTile(container: Phaser.GameObjects.Container, _letter: string) {
    const tile = container.getData("tile") as Phaser.GameObjects.Rectangle;
    const text = container.getData("text") as Phaser.GameObjects.Text;

    // Light up tile
    tile.setFillStyle(0xf3f4f6);
    this.playDingSound();

    // Rotate to reveal letter
    this.tweens.add({
      targets: container,
      scaleX: { from: 1, to: 0 },
      duration: 200,
      onComplete: () => {
        text.setVisible(true);
        this.tweens.add({
          targets: container,
          scaleX: { from: 0, to: 1 },
          duration: 200,
        });
      },
    });

    container.setData("revealed", true);
  }

  private startTimer() {
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      callback: () => {
        this.timeRemaining--;
        this.timerText.setText(this.formatTime(this.timeRemaining));

        // Update buy letter button state
        this.updateBuyLetterButton();

        // Update color based on time
        if (this.timeRemaining <= 10) {
          this.timerText.setColor("#ef4444");
        } else if (this.timeRemaining <= 30) {
          this.timerText.setColor("#f59e0b");
        }

        if (this.timeRemaining <= 0) {
          this.revealAllTiles();
        }
      },
      loop: true,
    });
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  private setupKeyboardInput() {
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (!this.gameActive) return;

      const key = event.key.toUpperCase();

      if (key === "BACKSPACE") {
        this.currentInput = this.currentInput.slice(0, -1);
        this.updateInputDisplay();
      } else if (key === "ENTER") {
        this.checkAnswer();
      } else if (/^[A-Z ]$/.test(key)) {
        this.currentInput += key;
        this.updateInputDisplay();
      }
    });
  }



  private updateInputDisplay() {
    this.inputText.setText(this.currentInput || "Type your answer...");
  }

  private checkAnswer() {
    if (this.currentInput.trim().toUpperCase() === this.currentAnswer) {
      this.levelComplete();
    } else {
      this.playErrorSound();
      // Flash red
      this.tweens.add({
        targets: this.inputText,
        alpha: 0.3,
        duration: 100,
        yoyo: true,
        repeat: 1,
      });
    }
  }

  private levelComplete() {
    this.gameActive = false;
    this.timerEvent?.remove();

    // Calculate score (1 point per second remaining)
    const levelScore = this.timeRemaining;
    this.playLevelCompleteSound();

    // Show level complete
    const completeText = this.add
      .text(PLAY_WIDTH / 2, PLAY_HEIGHT / 2 - 100, "LEVEL COMPLETE!", {
        fontFamily: "Arial, sans-serif",
        fontSize: "48px",
        fontStyle: "bold",
        color: "#10b981",
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.tweens.add({
      targets: completeText,
      alpha: 1,
      scale: { from: 0.5, to: 1 },
      duration: 500,
    });

    // Animate score counting
    this.time.delayedCall(1000, () => {
      this.animateScoreCount(this.totalScore, this.totalScore + levelScore);
    });

    // Move to next level
    this.time.delayedCall(3000, () => {
      this.totalScore += levelScore;
      this.level++;
      this.timeRemaining = LEVEL_TIME_SECONDS;
      this.currentInput = "";
      this.updateInputDisplay(); // Clear the input display

      // Clear current level
      this.tiles.forEach((tile) => tile.container.destroy());
      this.tiles = [];
      completeText.destroy();

      // Start next level
      this.startLevel();
    });
  }

  private animateScoreCount(from: number, to: number) {
    const duration = 1500;
    const startTime = Date.now();

    const updateScore = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const currentScore = Math.floor(from + (to - from) * progress);

      this.scoreText.setText(`Score: ${currentScore}`);

      if (progress < 1) {
        this.time.delayedCall(16, updateScore); // ~60fps
      }
    };

    updateScore();
  }

  private gameOver() {
    this.gameActive = false;
    this.timerEvent?.remove();

    dispatchGameOver({
      gameId: GAME_ID,
      score: this.totalScore,
    });
  }

  private revealAllTiles() {
    this.gameActive = false;
    this.timerEvent?.remove();
    
    // Hide the give up button
    this.giveUpButton.setVisible(false);

    // Reveal all unrevealed tiles instantly
    this.tiles.forEach((tileData) => {
      if (!tileData.container.getData("revealed")) {
        const tile = tileData.container.getData("tile") as Phaser.GameObjects.Rectangle;
        const text = tileData.container.getData("text") as Phaser.GameObjects.Text;
        
        tile.setFillStyle(0xf3f4f6);
        text.setVisible(true);
        tileData.container.setData("revealed", true);
      }
    });

    // Show "game over" message
    const tapText = this.add
      .text(PLAY_WIDTH / 2, PLAY_HEIGHT / 2, "GAME OVER", {
        fontFamily: "Arial, sans-serif",
        fontSize: "48px",
        fontStyle: "bold",
        color: "#ef4444",
        backgroundColor: "#1f2937",
        padding: { x: 30, y: 15 },
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.tweens.add({
      targets: tapText,
      alpha: 1,
      duration: 300,
    });

    // Wait for tap to continue - add delay to prevent immediate trigger
    this.time.delayedCall(500, () => {
      const continueHandler = () => {
        tapText.destroy();
        this.input.off("pointerdown", continueHandler);
        this.gameOver();
      };

      this.input.once("pointerdown", continueHandler);
    });
  }

  private playDingSound() {
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = "sine";
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.15
    );

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.15);
  }

  private createOnScreenKeyboard() {
    // Create Wordle-style on-screen keyboard at the bottom
    // Position: near bottom with padding (4 rows * 56px + 3 gaps * 6px + 20px bottom padding = 262px)
    const keyboardY = PLAY_HEIGHT - 242;
    this.onScreenKeyboard = this.add.container(PLAY_WIDTH / 2, keyboardY);
    this.keyboardKeys.clear();

    const keyWidth = 40;
    const keyHeight = 56;
    const keySpacing = 6;

    // QWERTY layout rows - backspace moved to right of spacebar
    const rows = [
      ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
      ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
      ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
      ['SPACE', 'BACKSPACE']
    ];

    rows.forEach((row, rowIndex) => {
      const rowWidth = row.reduce((sum, key) => {
        let width = keyWidth;
        if (key === 'BACKSPACE') width = keyWidth * 1.5;
        if (key === 'SPACE') width = keyWidth * 4.5;
        return sum + width + keySpacing;
      }, -keySpacing);

      let startX = -rowWidth / 2;
      const rowY = rowIndex * (keyHeight + keySpacing);

      row.forEach((key) => {
        let width = keyWidth;
        
        if (key === 'BACKSPACE') {
          width = keyWidth * 1.5;
        } else if (key === 'SPACE') {
          width = keyWidth * 4.5;
        }

        // Create key container
        const keyContainer = this.add.container(startX + width / 2, rowY);

        // Key background
        const bg = this.add.rectangle(0, 0, width, keyHeight, 0x818384);
        bg.setStrokeStyle(1, 0x565758);

        // Key label
        let label = key;
        let fontSize = '20px';
        if (key === 'BACKSPACE') {
          label = '⌫';
          fontSize = '26px';
        } else if (key === 'SPACE') {
          label = '';
          fontSize = '16px';
        }
        
        const keyText = this.add.text(0, 0, label, {
          fontFamily: "Arial, sans-serif",
          fontSize: fontSize,
          fontStyle: "bold",
          color: "#ffffff",
        }).setOrigin(0.5);

        keyContainer.add([bg, keyText]);
        keyContainer.setSize(width, keyHeight);
        keyContainer.setInteractive({ useHandCursor: true });

        // Store letter keys for highlighting
        if (key.length === 1) {
          this.keyboardKeys.set(key, keyContainer);
        }

        // Handle key press
        keyContainer.on("pointerdown", () => {
          if (!this.gameActive) return;

          this.playSelectSound();

          if (key === 'BACKSPACE') {
            if (this.currentInput.length > 0) {
              this.currentInput = this.currentInput.slice(0, -1);
              this.updateInputDisplay();
            }
          } else if (key === 'SPACE') {
            this.currentInput += ' ';
            this.updateInputDisplay();
          } else {
            // Regular letter
            this.currentInput += key;
            this.updateInputDisplay();
          }
        });

        // Hover effects
        keyContainer.on("pointerover", () => {
          bg.setFillStyle(0x565758);
        });

        keyContainer.on("pointerout", () => {
          const isSelected = this.selectedLetters.includes(key);
          const isBought = this.boughtLetters.includes(key);
          
          if (isBought) {
            bg.setFillStyle(0x10b981); // Green for bought letters
          } else if (isSelected) {
            bg.setFillStyle(0x3b82f6); // Blue for selected letters
          } else {
            bg.setFillStyle(0x818384); // Default gray
          }
        });

        this.onScreenKeyboard.add(keyContainer);
        startX += width + keySpacing;
      });
    });
  }

  private highlightSelectedKeys() {
    // Highlight keys that match selected letters (blue)
    this.selectedLetters.forEach(letter => {
      const keyContainer = this.keyboardKeys.get(letter);
      if (keyContainer) {
        const bg = keyContainer.getAt(0) as Phaser.GameObjects.Rectangle;
        bg.setFillStyle(0x3b82f6); // Blue highlight for selected
      }
    });
    
    // Highlight bought letters (green) - these override selected letters
    this.boughtLetters.forEach(letter => {
      const keyContainer = this.keyboardKeys.get(letter);
      if (keyContainer) {
        const bg = keyContainer.getAt(0) as Phaser.GameObjects.Rectangle;
        bg.setFillStyle(0x10b981); // Green highlight for bought
      }
    });
  }

  private playErrorSound() {
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 150;
    oscillator.type = "sawtooth";
    gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.2
    );

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.2);
  }

  private playSelectSound() {
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 600;
    oscillator.type = "sine";
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.1
    );

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1);
  }

  private playLevelCompleteSound() {
    const audioContext = new AudioContext();

    // Play a series of ascending notes
    [600, 700, 800, 1000].forEach((freq, index) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = freq;
      oscillator.type = "sine";

      const startTime = audioContext.currentTime + index * 0.1;
      gainNode.gain.setValueAtTime(0.2, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);

      oscillator.start(startTime);
      oscillator.stop(startTime + 0.2);
    });
  }
}
