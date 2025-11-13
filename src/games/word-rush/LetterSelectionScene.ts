import Phaser from "phaser";

const PLAY_WIDTH = 540;
const PLAY_HEIGHT = 960;

const VOWELS = ["A", "E", "I", "O", "U"];
const CONSONANTS = [
  "B", "C", "D", "F", "G", "H", "J", "K", "L", "M",
  "N", "P", "Q", "R", "S", "T", "V", "W", "X", "Y", "Z",
];

export default class LetterSelectionScene extends Phaser.Scene {
  private selectedConsonants: string[] = [];
  private selectedVowels: string[] = [];
  private consonantButtons: Map<string, Phaser.GameObjects.Container> = new Map();
  private vowelButtons: Map<string, Phaser.GameObjects.Container> = new Map();
  private selectionText!: Phaser.GameObjects.Text;
  private startButton!: Phaser.GameObjects.Container;

  constructor() {
    super("LetterSelection");
  }

  create() {
    this.createBackground();
    this.createTitle();
    this.createInstructions();
    this.createConsonantButtons();
    this.createVowelButtons();
    this.createSelectionDisplay();
    this.createStartButton();
  }

  private createBackground() {
    const g = this.add.graphics();
    // Gradient background
    g.fillGradientStyle(0x2d3748, 0x2d3748, 0x1a202c, 0x1a202c, 1);
    g.fillRect(0, 0, PLAY_WIDTH, PLAY_HEIGHT);
  }

  private createTitle() {
    this.add
      .text(PLAY_WIDTH / 2, 60, "WORD RUSH", {
        fontFamily: "Arial, sans-serif",
        fontSize: "52px",
        fontStyle: "bold",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    this.add
      .text(PLAY_WIDTH / 2, 110, "with Tom", {
        fontFamily: "Arial, sans-serif",
        fontSize: "28px",
        fontStyle: "italic",
        color: "#fbbf24",
      })
      .setOrigin(0.5);
  }

  private createInstructions() {
    this.add
      .text(PLAY_WIDTH / 2, 170, "Select Your Letters:", {
        fontFamily: "Arial, sans-serif",
        fontSize: "24px",
        fontStyle: "bold",
        color: "#fbbf24",
      })
      .setOrigin(0.5);

    this.add
      .text(PLAY_WIDTH / 2, 205, "Choose 4 Consonants & 2 Vowels", {
        fontFamily: "Arial, sans-serif",
        fontSize: "18px",
        color: "#cbd5e0",
      })
      .setOrigin(0.5);
  }

  private createConsonantButtons() {
    this.add
      .text(PLAY_WIDTH / 2, 250, "CONSONANTS", {
        fontFamily: "Arial, sans-serif",
        fontSize: "20px",
        fontStyle: "bold",
        color: "#60a5fa",
      })
      .setOrigin(0.5);

    const cols = 7;
    const tileSize = 60;
    const spacing = 8;
    const totalSpacing = tileSize + spacing;
    const gridWidth = cols * totalSpacing - spacing;
    const startX = (PLAY_WIDTH - gridWidth) / 2 + tileSize / 2;
    const startY = 300; // Changed from 290 to 300 for consistent 50px spacing

    CONSONANTS.forEach((letter, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = startX + col * totalSpacing;
      const y = startY + row * totalSpacing;

      const button = this.createLetterButton(x, y, letter, false);
      this.consonantButtons.set(letter, button);
    });
  }

  private createVowelButtons() {
    this.add
      .text(PLAY_WIDTH / 2, 550, "VOWELS", {
        fontFamily: "Arial, sans-serif",
        fontSize: "20px",
        fontStyle: "bold",
        color: "#34d399",
      })
      .setOrigin(0.5);

    const tileSize = 60;
    const spacing = 8;
    const totalSpacing = tileSize + spacing;
    const cols = 5;
    const gridWidth = cols * totalSpacing - spacing;
    const startX = (PLAY_WIDTH - gridWidth) / 2 + tileSize / 2;
    const startY = 600;

    VOWELS.forEach((letter, index) => {
      const x = startX + index * totalSpacing;
      const button = this.createLetterButton(x, startY, letter, true);
      this.vowelButtons.set(letter, button);
    });
  }

  private createLetterButton(
    x: number,
    y: number,
    letter: string,
    isVowel: boolean
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    // Tile background
    const tile = this.add.rectangle(0, 0, 60, 60, 0xf7fafc);
    tile.setStrokeStyle(3, 0x2d3748);

    // Letter text
    const text = this.add.text(0, 0, letter, {
      fontFamily: "Arial, sans-serif",
      fontSize: "32px",
      fontStyle: "bold",
      color: "#2d3748",
    }).setOrigin(0.5);

    container.add([tile, text]);
    container.setSize(60, 60);
    container.setInteractive({ useHandCursor: true });

    container.on("pointerdown", () => {
      this.onLetterClick(letter, isVowel, container);
    });

    container.setData("selected", false);
    container.setData("tile", tile);

    return container;
  }

  private onLetterClick(
    letter: string,
    isVowel: boolean,
    container: Phaser.GameObjects.Container
  ) {
    const isSelected = container.getData("selected");
    const tile = container.getData("tile") as Phaser.GameObjects.Rectangle;

    if (isSelected) {
      // Deselect
      if (isVowel) {
        this.selectedVowels = this.selectedVowels.filter((l) => l !== letter);
      } else {
        this.selectedConsonants = this.selectedConsonants.filter(
          (l) => l !== letter
        );
      }
      container.setData("selected", false);
      tile.setFillStyle(0xf7fafc);
      tile.setStrokeStyle(3, 0x2d3748);
    } else {
      // Select
      if (isVowel) {
        if (this.selectedVowels.length >= 2) {
          this.playErrorSound();
          return;
        }
        this.selectedVowels.push(letter);
        tile.setFillStyle(0x34d399);
      } else {
        if (this.selectedConsonants.length >= 4) {
          this.playErrorSound();
          return;
        }
        this.selectedConsonants.push(letter);
        tile.setFillStyle(0x60a5fa);
      }
      container.setData("selected", true);
      tile.setStrokeStyle(3, 0xfbbf24);
      this.playSelectSound();
    }

    this.updateSelectionDisplay();
  }

  private createSelectionDisplay() {
    this.add
      .text(PLAY_WIDTH / 2, 720, "SELECTED LETTERS", {
        fontFamily: "Arial, sans-serif",
        fontSize: "20px",
        fontStyle: "bold",
        color: "#fbbf24",
      })
      .setOrigin(0.5);

    this.selectionText = this.add
      .text(PLAY_WIDTH / 2, 770, "None", {
        fontFamily: "Arial, sans-serif",
        fontSize: "32px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);
  }

  private updateSelectionDisplay() {
    const allSelected = [...this.selectedConsonants, ...this.selectedVowels];
    if (allSelected.length === 0) {
      this.selectionText.setText("None");
    } else {
      this.selectionText.setText(allSelected.join("  "));
    }

    // Update start button visibility
    if (
      this.selectedConsonants.length === 4 &&
      this.selectedVowels.length === 2
    ) {
      this.startButton.setVisible(true);
      this.tweens.add({
        targets: this.startButton,
        scale: { from: 0.9, to: 1.05 },
        duration: 600,
        yoyo: true,
        repeat: -1,
      });
    } else {
      this.startButton.setVisible(false);
      this.tweens.killTweensOf(this.startButton);
    }
  }

  private createStartButton() {
    this.startButton = this.add.container(PLAY_WIDTH / 2, 870);

    const bg = this.add.rectangle(0, 0, 280, 70, 0x10b981);
    bg.setStrokeStyle(4, 0xfbbf24);

    const text = this.add
      .text(0, 0, "START GAME", {
        fontFamily: "Arial, sans-serif",
        fontSize: "28px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.startButton.add([bg, text]);
    this.startButton.setSize(280, 70);
    this.startButton.setInteractive({ useHandCursor: true });
    this.startButton.setVisible(false);

    this.startButton.on("pointerdown", () => {
      this.playStartSound();
      this.scene.start("WordRushGame", {
        selectedLetters: [...this.selectedConsonants, ...this.selectedVowels],
      });
    });

    this.startButton.on("pointerover", () => {
      bg.setFillStyle(0x059669);
    });

    this.startButton.on("pointerout", () => {
      bg.setFillStyle(0x10b981);
    });
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

  private playErrorSound() {
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 200;
    oscillator.type = "sawtooth";
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.15
    );

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.15);
  }

  private playStartSound() {
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = "square";
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.2
    );

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.2);
  }
}
