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
  private selectedLettersText!: Phaser.GameObjects.Text;
  private giveUpButton!: Phaser.GameObjects.Container;
  private keyboardButton!: Phaser.GameObjects.Container;
  private isKeyboardCompactLayout = false;
  private mobileInputElement: HTMLInputElement | null = null;
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
    this.startLevel();
    this.setupKeyboardInput();
    this.createMobileKeyboardInput();
  }

  private createBackground() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x1e3a8a, 0x1e3a8a, 0x0f172a, 0x0f172a, 1);
    g.fillRect(0, 0, PLAY_WIDTH, PLAY_HEIGHT);
  }

  private createUI() {
    // Level display
    this.levelText = this.add
      .text(20, 20, `Level ${this.level}`, {
        fontFamily: "Arial, sans-serif",
        fontSize: "24px",
        fontStyle: "bold",
        color: "#fbbf24",
      });

    // Score display
    this.scoreText = this.add
      .text(PLAY_WIDTH - 20, 20, `Score: ${this.totalScore}`, {
        fontFamily: "Arial, sans-serif",
        fontSize: "24px",
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

    // Input display
    this.inputText = this.add
      .text(PLAY_WIDTH / 2 - 30, PLAY_HEIGHT - 180, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "32px",
        fontStyle: "bold",
        color: "#fbbf24",
        backgroundColor: "#1f2937",
        padding: { x: 20, y: 10 },
      })
      .setOrigin(0.5);

    // Selected letters display
    this.add
      .text(PLAY_WIDTH / 2, PLAY_HEIGHT - 120, "Your Letters:", {
        fontFamily: "Arial, sans-serif",
        fontSize: "18px",
        fontStyle: "bold",
        color: "#9ca3af",
      })
      .setOrigin(0.5);

    this.selectedLettersText = this.add
      .text(PLAY_WIDTH / 2, PLAY_HEIGHT - 90, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "28px",
        fontStyle: "bold",
        color: "#60a5fa",
        letterSpacing: 8,
      })
      .setOrigin(0.5);

    // Give up button
    this.createGiveUpButton();

    // Keyboard toggle button (small icon next to input) - mobile only
    if (this.isMobileDevice()) {
      this.createKeyboardButton();
    }
  }

  private createKeyboardButton() {
    this.keyboardButton = this.add.container(PLAY_WIDTH / 2 + 180, PLAY_HEIGHT - 180);

    const bg = this.add.rectangle(0, 0, 44, 44, 0x111827, 0.9);
    bg.setStrokeStyle(2, 0x4b5563);

    // Simple keyboard glyph
    const icon = this.add.text(0, 1, "⌨", {
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      fontSize: "26px",
      color: "#e5e7eb",
    }).setOrigin(0.5);

    this.keyboardButton.add([bg, icon]);
    this.keyboardButton.setSize(44, 44);
    this.keyboardButton.setInteractive({ useHandCursor: true });

    this.keyboardButton.on("pointerdown", () => {
      if (!this.gameActive) return;
      this.focusMobileInput();
    });

    this.keyboardButton.on("pointerover", () => {
      bg.setFillStyle(0x1f2937, 0.95);
    });

    this.keyboardButton.on("pointerout", () => {
      bg.setFillStyle(0x111827, 0.9);
    });
  }

  private createGiveUpButton() {
    // Leave a little padding at the bottom of the screen
    this.giveUpButton = this.add.container(PLAY_WIDTH / 2, PLAY_HEIGHT - 40);

    const bg = this.add.rectangle(0, 0, 200, 50, 0xef4444);
    bg.setStrokeStyle(3, 0x991b1b);

    const text = this.add
      .text(0, 0, "GIVE UP", {
        fontFamily: "Arial, sans-serif",
        fontSize: "22px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.giveUpButton.add([bg, text]);
    this.giveUpButton.setSize(200, 50);
    this.giveUpButton.setInteractive({ useHandCursor: true });

    this.giveUpButton.on("pointerdown", () => {
      if (this.gameActive) {
        this.showGiveUpConfirmation();
      }
    });

    this.giveUpButton.on("pointerover", () => {
      bg.setFillStyle(0xdc2626);
    });

    this.giveUpButton.on("pointerout", () => {
      bg.setFillStyle(0xef4444);
    });
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

  private startLevel() {
    // Select random category and word
    this.currentCategory = getRandomCategory();
    this.currentAnswer = getRandomWord(this.currentCategory);

    this.categoryText.setText(`Category: ${this.currentCategory.name}`);
    this.levelText.setText(`Level ${this.level}`);
    
    // Display selected letters
    this.selectedLettersText.setText(this.selectedLetters.join("  "));

    // Create tiles
    this.createTiles();

    // Start reveal animation
    this.revealSelectedLetters();
  }

  private createTiles() {
    this.tiles = [];
    const answer = this.currentAnswer;
    const words = answer.split(" ");

  let startY = this.isKeyboardCompactLayout ? 140 : 200;
    const tileSize = 50;
    const tileSpacing = 8;
    const wordSpacing = 30;

    words.forEach((word) => {
      const wordWidth = word.length * (tileSize + tileSpacing) - tileSpacing;
      let startX = (PLAY_WIDTH - wordWidth) / 2 + tileSize / 2; // Add half tile size for center positioning

      for (let i = 0; i < word.length; i++) {
        const letter = word[i];
        const x = startX + i * (tileSize + tileSpacing);
        const y = startY + tileSize / 2; // Add half tile size for center positioning

        const container = this.createTile(x, y, letter, tileSize);
        const revealed = this.selectedLetters.includes(letter);

        this.tiles.push({
          letter,
          revealed,
          container,
        });
      }

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

  private createMobileKeyboardInput() {
    // Create an invisible HTML input to trigger mobile keyboard
    const inputElement = document.createElement("input");
    inputElement.type = "text";
    inputElement.autocomplete = "off";
    inputElement.autocapitalize = "characters";
    inputElement.style.position = "fixed";
    inputElement.style.bottom = "0";
    inputElement.style.left = "50%";
    inputElement.style.transform = "translateX(-50%)";
    inputElement.style.opacity = "0";
    inputElement.style.height = "1px";
    inputElement.style.width = "1px";
    inputElement.style.border = "none";
    inputElement.style.background = "transparent";
    inputElement.style.zIndex = "99999";
    document.body.appendChild(inputElement);

    this.mobileInputElement = inputElement;

    // Focus the input to show keyboard (must be triggered by user gesture on some browsers,
    // so this initial focus may be ignored on mobile but works as a best-effort)
    setTimeout(() => {
      this.focusMobileInput();
    }, 100);

    // Listen to input changes
    inputElement.addEventListener("input", (e) => {
      if (!this.gameActive) return;

      const target = e.target as HTMLInputElement;
      const value = target.value.toUpperCase();

      // Handle input
      if (value.length > this.currentInput.length) {
        // Character added
        const newChar = value[value.length - 1];
        if (/^[A-Z ]$/.test(newChar)) {
          this.currentInput += newChar;
          this.updateInputDisplay();
        }
      } else if (value.length < this.currentInput.length) {
        // Character removed (backspace)
        this.currentInput = this.currentInput.slice(0, -1);
        this.updateInputDisplay();
      }

      // Keep input synced
  target.value = this.currentInput;
    });

    // Handle enter key on mobile
    inputElement.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && this.gameActive) {
        this.checkAnswer();
      }
    });

    // Refocus if keyboard closes
    const refocus = () => {
      if (this.gameActive) {
        setTimeout(() => this.focusMobileInput(), 150);
      }
    };

    inputElement.addEventListener("blur", refocus);

    // Cleanup on scene shutdown
    this.events.once("shutdown", () => {
      inputElement.removeEventListener("blur", refocus);
      if (this.mobileInputElement) {
        document.body.removeChild(this.mobileInputElement);
        this.mobileInputElement = null;
      }
    });
  }

  private isMobileDevice(): boolean {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || navigator.vendor || "";
    return /android|iphone|ipad|ipod|iemobile|opera mini/i.test(ua);
  }

  private focusMobileInput() {
    if (!this.mobileInputElement) return;

    // Try to focus via a short timeout to align with user gesture
    setTimeout(() => {
      this.mobileInputElement?.focus();
    }, 0);
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

    // Show "tap to continue" message
    const tapText = this.add
      .text(PLAY_WIDTH / 2, PLAY_HEIGHT / 2, "TAP TO CONTINUE", {
        fontFamily: "Arial, sans-serif",
        fontSize: "32px",
        fontStyle: "bold",
        color: "#fbbf24",
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
