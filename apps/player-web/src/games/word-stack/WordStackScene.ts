import Phaser from "phaser";
import { dispatchGameOver } from "../../utils/gameEvents";
import { createOnScreenKeyboard, type OnScreenKeyboardInstance } from "../../game/ui/onScreenKeyboard";
import { getFiveLetterWordSet } from "../../game/words/dictionary";
import { SCRABBLE_LETTER_SCORES, scoreScrabbleWord } from "../../game/words/scrabble";

const PLAY_WIDTH = 540;
const PLAY_HEIGHT = 960;

const GAME_ID = "word-stack";

const MAX_TURNS = 6;

const VOWELS = ["A", "E", "I", "O", "U"];
const CONSONANTS = [
  "B",
  "C",
  "D",
  "F",
  "G",
  "H",
  "J",
  "K",
  "L",
  "M",
  "N",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "V",
  "W",
  "X",
  "Y",
  "Z",
];

type OfferedLetterType = "vowel" | "consonant";

type OfferedTile = {
  type: OfferedLetterType;
  letter: string;
  container: Phaser.GameObjects.Container;
  tile: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  scoreText: Phaser.GameObjects.Text;
};

type WordTile = {
  index: number;
  container: Phaser.GameObjects.Container;
  tile: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  scoreText: Phaser.GameObjects.Text;
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickRandomUnique(pool: string[], excluded: Set<string>): string {
  const candidates = pool.filter((l) => !excluded.has(l));
  if (candidates.length === 0) return pickRandom(pool);
  return pickRandom(candidates);
}

function replaceAt(word: string, index: number, letter: string): string {
  return word.slice(0, index) + letter + word.slice(index + 1);
}

function isHighValueLetter(letter: string): boolean {
  return (SCRABBLE_LETTER_SCORES[letter] ?? 0) > 7;
}

export default class WordStackScene extends Phaser.Scene {
  private keyboard?: OnScreenKeyboardInstance;

  private statusText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private turnsText!: Phaser.GameObjects.Text;
  private availableWordsText!: Phaser.GameObjects.Text;

  private giveUpButton?: Phaser.GameObjects.Container;
  private confirmGiveUp?: Phaser.GameObjects.Container;
  private noMovesPopup?: Phaser.GameObjects.Container;
  private noTurnsPopup?: Phaser.GameObjects.Container;

  private inputWord: string = "";
  private inputTiles: Phaser.GameObjects.Text[] = [];
  private entryContainer?: Phaser.GameObjects.Container;

  private gamePhase: "enter" | "play" | "checking" | "over" = "enter";

  private submittedWords: string[] = [];
  private currentWord: string = "";
  private usedWords: Set<string> = new Set();

  private score: number = 0;
  private turnsMade: number = 0;

  private currentWordTiles: WordTile[] = [];
  private offeredTiles: OfferedTile[] = [];
  private wordSet?: Set<string>;
  private stackContainer?: Phaser.GameObjects.Container;
  private currentWordContainer?: Phaser.GameObjects.Container;

  private highlightedTargetIndex: number | null = null;

  private readonly DRAG_Y_MULTIPLIER = 1.6;
  private readonly DRAG_Y_OFFSET = 70;

  private hasDispatchedGameOver = false;

  constructor() {
    super("WordStack");
  }

  create() {
    this.hasDispatchedGameOver = false;
    this.createBackground();
    this.createHud();
    this.createEntryUI();
  }

  private isValidWord(word: string): boolean {
    const upper = word.trim().toUpperCase();
    if (!/^[A-Z]{5}$/.test(upper)) return false;
    return (this.wordSet ?? getFiveLetterWordSet()).has(upper);
  }

  private setHighlightedTarget(index: number | null) {
    if (this.highlightedTargetIndex === index) return;
    this.highlightedTargetIndex = index;

    // Only current-word tiles are draggable targets.
    this.currentWordTiles.forEach((t) => {
      if (index != null && t.index === index) {
        t.tile.setStrokeStyle(4, 0xfbbf24);
      } else {
        t.tile.setStrokeStyle(2, 0x60a5fa);
      }
    });
  }

  private updateAvailableWordsText() {
    if (this.gamePhase !== "play" || this.offeredTiles.length === 0 || this.currentWord.length !== 5) {
      this.availableWordsText.setVisible(false);
      return;
    }

    const currentWord = this.currentWord;
    const offeredLetters = this.offeredTiles.map((t) => t.letter);

    let count = 0;
    const seen = new Set<string>();

    for (let i = 0; i < 5; i++) {
      for (const letter of offeredLetters) {
        const c = replaceAt(currentWord, i, letter);
        if (c === currentWord) continue;
        if (this.usedWords.has(c)) continue;
        if (seen.has(c)) continue;
        if (!this.isValidWord(c)) continue;

        seen.add(c);
        count += 1;
        if (count > 10) break;
      }
      if (count > 10) break;
    }

    const label =
      count > 10 ? "10+ words available" : `${count} word${count === 1 ? "" : "s"} available`;

    this.availableWordsText.setText(label);
    this.availableWordsText.setVisible(true);
  }

  private createBackground() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x111827, 0x111827, 0x0b1220, 0x0b1220, 1);
    g.fillRect(0, 0, PLAY_WIDTH, PLAY_HEIGHT);

    this.add
      .text(PLAY_WIDTH / 2, 40, "WORD STACK", {
        fontFamily: "Arial, sans-serif",
        fontSize: "40px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);
  }

  private createHud() {
    this.scoreText = this.add
      .text(15, 85, "Score: 0", {
        fontFamily: "Arial, sans-serif",
        fontSize: "18px",
        fontStyle: "bold",
        color: "#10b981",
      })
      .setOrigin(0, 0);

    this.turnsText = this.add
      .text(PLAY_WIDTH - 15, 85, `Turns: 0/${MAX_TURNS}`,
        {
          fontFamily: "Arial, sans-serif",
          fontSize: "18px",
          fontStyle: "bold",
          color: "#fbbf24",
        }
      )
      .setOrigin(1, 0);

    this.statusText = this.add
      .text(PLAY_WIDTH / 2, 145, "Enter a 5-letter word", {
        fontFamily: "Arial, sans-serif",
        fontSize: "18px",
        color: "#cbd5e1",
      })
      .setOrigin(0.5);

    this.availableWordsText = this.add
      .text(PLAY_WIDTH / 2, PLAY_HEIGHT - 255, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: "16px",
        fontStyle: "bold",
        color: "#cbd5e1",
      })
      .setOrigin(0.5)
      .setVisible(false);

    this.createGiveUpButton();
  }

  private createGiveUpButton() {
    const y = PLAY_HEIGHT - 40;
    const width = 160;
    const height = 44;

    this.giveUpButton?.destroy(true);
    const container = this.add.container(PLAY_WIDTH / 2, y);

    const bg = this.add.rectangle(0, 0, width, height, 0x1f2937);
    bg.setStrokeStyle(2, 0x334155);

    const text = this.add
      .text(0, 0, "Give up", {
        fontFamily: "Arial, sans-serif",
        fontSize: "18px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    container.add([bg, text]);
    container.setSize(width, height);
    container.setInteractive({ useHandCursor: true });

    container.on("pointerdown", () => {
      if (this.gamePhase !== "play") return;
      this.showGiveUpConfirm();
    });

    container.setVisible(false);
    this.giveUpButton = container;
  }

  private showGiveUpConfirm() {
    if (this.confirmGiveUp) return;

    const modal = this.add.container(PLAY_WIDTH / 2, PLAY_HEIGHT / 2);

    const panel = this.add.rectangle(0, 0, 380, 220, 0x0b1220, 0.95);
    panel.setStrokeStyle(2, 0x334155);

    const title = this.add
      .text(0, -60, "Are you sure?", {
        fontFamily: "Arial, sans-serif",
        fontSize: "28px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const makeButton = (x: number, label: string, fill: number) => {
      const btn = this.add.container(x, 55);
      const bg = this.add.rectangle(0, 0, 140, 46, fill);
      bg.setStrokeStyle(2, 0x0b1220);
      const t = this.add
        .text(0, 0, label, {
          fontFamily: "Arial, sans-serif",
          fontSize: "18px",
          fontStyle: "bold",
          color: "#0b1220",
        })
        .setOrigin(0.5);
      btn.add([bg, t]);
      btn.setSize(140, 46);
      btn.setInteractive({ useHandCursor: true });
      return btn;
    };

    const yesBtn = makeButton(-85, "Yes", 0xef4444);
    const noBtn = makeButton(85, "No", 0x10b981);

    yesBtn.on("pointerdown", () => {
      this.confirmGiveUp?.destroy(true);
      this.confirmGiveUp = undefined;
      this.endGame(0);
    });

    noBtn.on("pointerdown", () => {
      this.confirmGiveUp?.destroy(true);
      this.confirmGiveUp = undefined;
    });

    modal.add([panel, title, yesBtn, noBtn]);
    modal.setDepth(2000);
    this.confirmGiveUp = modal;
  }

  private createEntryUI() {
    this.gamePhase = "enter";

    // 5-letter input display
    const startY = 210;
    const tileSize = 70;
    const gap = 10;
    const totalW = 5 * tileSize + 4 * gap;
    const startX = (PLAY_WIDTH - totalW) / 2 + tileSize / 2;

    this.entryContainer?.destroy(true);
    this.entryContainer = this.add.container(0, 0);

    this.inputTiles.forEach((t) => t.destroy());
    this.inputTiles = [];

    for (let i = 0; i < 5; i++) {
      const x = startX + i * (tileSize + gap);
      const bg = this.add.rectangle(x, startY, tileSize, tileSize, 0x1f2937);
      bg.setStrokeStyle(2, 0x334155);

      const t = this.add
        .text(x, startY, "", {
          fontFamily: "Arial, sans-serif",
          fontSize: "38px",
          fontStyle: "bold",
          color: "#ffffff",
        })
        .setOrigin(0.5);

      this.entryContainer.add([bg, t]);
      this.inputTiles.push(t);
    }

    this.inputWord = "";
    this.updateEntryTiles();

    // Shared keyboard (Word Rush style)
    this.keyboard?.destroy();
    this.keyboard = createOnScreenKeyboard(this, {
      centerX: PLAY_WIDTH / 2,
      topY: PLAY_HEIGHT - 242,
      enabled: () => this.gamePhase === "enter",
      showSpace: false,
      showBackspace: true,
      onKey: (key) => this.handleEntryKey(key),
    });

    // Also allow physical keyboard
    this.input.keyboard?.on("keydown", (ev: KeyboardEvent) => {
      if (this.gamePhase !== "enter") return;
      const k = ev.key.toUpperCase();
      if (k === "BACKSPACE") return this.handleEntryKey("BACKSPACE");
      if (/^[A-Z]$/.test(k)) return this.handleEntryKey(k);
    });
  }

  private updateEntryTiles() {
    const upper = this.inputWord.toUpperCase();
    for (let i = 0; i < 5; i++) {
      this.inputTiles[i].setText(upper[i] ?? "");
    }
  }

  private async handleEntryKey(key: string) {
    if (this.gamePhase !== "enter") return;

    if (key === "BACKSPACE") {
      if (this.inputWord.length > 0) {
        this.inputWord = this.inputWord.slice(0, -1);
        this.updateEntryTiles();
      }
      return;
    }

    if (/^[A-Z]$/.test(key)) {
      if (this.inputWord.length >= 5) return;
      this.inputWord += key;
      this.updateEntryTiles();

      if (this.inputWord.length === 5) {
        await this.tryStartGameWithWord(this.inputWord);
      }
    }
  }

  private async tryStartGameWithWord(word: string) {
    if (this.gamePhase !== "enter") return;

    const upper = word.toUpperCase();
    this.statusText.setText("Checking word...");
    this.gamePhase = "checking";

    // Memoize the dictionary into a Set when the game starts.
    this.wordSet = getFiveLetterWordSet();

    const ok = this.isValidWord(upper);

    if (!ok) {
      this.statusText.setText("Not a valid word. Try again.");
      this.gamePhase = "enter";
      this.inputWord = "";
      this.updateEntryTiles();
      return;
    }

    // Remove entry UI once we start playing to avoid overlap.
    this.entryContainer?.destroy(true);
    this.entryContainer = undefined;
    this.inputTiles = [];

    this.keyboard?.destroy();
    this.keyboard = undefined;

    this.submittedWords = [upper];
    this.currentWord = upper;
    this.usedWords = new Set([upper]);
    this.score = scoreScrabbleWord(upper);
    this.turnsMade = 1;
    this.updateHud();

    this.gamePhase = "play";
    this.statusText.setText("Drag a new letter onto the word");

    this.giveUpButton?.setVisible(true);

    this.createWordStack();
    this.createOfferedLetters();
    this.updateAvailableWordsText();

    await this.checkIfAnyMovesLeft();
  }

  private updateHud() {
    this.scoreText.setText(`Score: ${this.score}`);
    this.turnsText.setText(`Turns: ${this.turnsMade}/${MAX_TURNS}`);
  }

  private createWordStack() {
    // Clear previous visuals (rebuild each time)
    this.stackContainer?.destroy(true);
    this.currentWordContainer?.destroy(true);

    this.stackContainer = this.add.container(0, 0);
    this.currentWordContainer = this.add.container(0, 0);
    this.currentWordTiles = [];

    const gap = 8;
    const rowGap = 10;

    // Big current editable word (no row score next to it)
    const tileSizeCurrent = 64;
    const currentY = 200;

    if (this.currentWord.length === 5) {
      const totalWCurrent = 5 * tileSizeCurrent + 4 * gap;
      const leftXCurrent = (PLAY_WIDTH - totalWCurrent) / 2;
      const startXCurrent = leftXCurrent + tileSizeCurrent / 2;

      for (let i = 0; i < 5; i++) {
        const x = startXCurrent + i * (tileSizeCurrent + gap);
        const letter = this.currentWord[i];

        const bg = this.add.rectangle(0, 0, tileSizeCurrent, tileSizeCurrent, 0x0f172a);
        bg.setStrokeStyle(2, 0x60a5fa);

        const txt = this.add
          .text(0, 0, letter, {
            fontFamily: "Arial, sans-serif",
            fontSize: "32px",
            fontStyle: "bold",
            color: "#ffffff",
          })
          .setOrigin(0.5);

        const score = SCRABBLE_LETTER_SCORES[letter] ?? 0;
        const scoreTxt = this.add
          .text(tileSizeCurrent / 2 - 6, -tileSizeCurrent / 2 + 6, String(score), {
            fontFamily: "Arial, sans-serif",
            fontSize: "15px",
            fontStyle: "bold",
            color: "#ffffff",
          })
          .setOrigin(1, 0)
          .setAlpha(0.8);

        const container = this.add.container(x, currentY, [bg, txt, scoreTxt]);
        container.setSize(tileSizeCurrent, tileSizeCurrent);
        container.setData("ws:current", true);
        this.currentWordContainer.add(container);
        this.currentWordTiles.push({ index: i, container, tile: bg, text: txt, scoreText: scoreTxt });
      }
    }

    // Submitted stack (small tiles) — includes the current word as the most recent submission.
    const tileSizeSmall = 46;
    const topY = currentY + tileSizeCurrent + 24;
    const displayWords = this.submittedWords.slice(0, MAX_TURNS);
    let y = topY;

    for (let row = 0; row < displayWords.length; row++) {
      const w = displayWords[row];
      const totalWSmall = 5 * tileSizeSmall + 4 * gap;
      const leftXSmall = (PLAY_WIDTH - totalWSmall) / 2;
      const startXSmall = leftXSmall + tileSizeSmall / 2;

      for (let i = 0; i < 5; i++) {
        const x = startXSmall + i * (tileSizeSmall + gap);
        const letter = w[i];

        const bg = this.add.rectangle(0, 0, tileSizeSmall, tileSizeSmall, 0x111827);
        bg.setStrokeStyle(2, 0x334155);

        const txt = this.add
          .text(0, 0, letter, {
            fontFamily: "Arial, sans-serif",
            fontSize: "24px",
            fontStyle: "bold",
            color: "#ffffff",
          })
          .setOrigin(0.5);

        const score = SCRABBLE_LETTER_SCORES[letter] ?? 0;
        const scoreTxt = this.add
          .text(tileSizeSmall / 2 - 6, -tileSizeSmall / 2 + 6, String(score), {
            fontFamily: "Arial, sans-serif",
            fontSize: "13px",
            fontStyle: "bold",
            color: "#ffffff",
          })
          .setOrigin(1, 0)
          .setAlpha(0.8);

        const container = this.add.container(x, y, [bg, txt, scoreTxt]);
        container.setSize(tileSizeSmall, tileSizeSmall);
        container.setData("ws:stack", true);
        this.stackContainer.add(container);
      }

      const rowScore = scoreScrabbleWord(w);
      const rightX = Math.min(PLAY_WIDTH - 12, leftXSmall + totalWSmall + 10);
      const ptsText = this.add
        .text(rightX, y, `${rowScore} pts`, {
          fontFamily: "Arial, sans-serif",
          fontSize: "14px",
          fontStyle: "bold",
          color: "#cbd5e1",
        })
        .setOrigin(0, 0.5)
        .setAlpha(0.8);

      this.stackContainer.add(ptsText);
      y += tileSizeSmall + rowGap;
    }

    this.setHighlightedTarget(null);
  }

  private createOfferedLetters() {
    this.offeredTiles.forEach((t) => t.container.destroy());
    this.offeredTiles = [];

    // 2 vowels + 5 consonants (no duplicates; keep high-value letters under control)
    const exclude = new Set<string>();
    const offers: Array<{ type: OfferedLetterType; letter: string }> = [];
    let highValueCount = 0;

    const v1 = pickRandomUnique(VOWELS, exclude);
    exclude.add(v1);
    offers.push({ type: "vowel", letter: v1 });

    const v2 = pickRandomUnique(VOWELS, exclude);
    exclude.add(v2);
    offers.push({ type: "vowel", letter: v2 });

    for (let i = 0; i < 5; i++) {
      const constrainedCandidates = CONSONANTS.filter((l) => {
        if (exclude.has(l)) return false;
        if (highValueCount >= 1 && isHighValueLetter(l)) return false;
        return true;
      });

      const unconstrainedCandidates = CONSONANTS.filter((l) => !exclude.has(l));
      const c = pickRandom(constrainedCandidates.length > 0 ? constrainedCandidates : unconstrainedCandidates);

      exclude.add(c);
      offers.push({ type: "consonant", letter: c });

      if (isHighValueLetter(c)) highValueCount += 1;
    }

    const tileSize = 68;
    const gap = 14;
    const vowels = offers.filter((o) => o.type === "vowel");
    const consonants = offers.filter((o) => o.type === "consonant");

    const vowelsY = PLAY_HEIGHT - 210;
    const consonantsY = PLAY_HEIGHT - 120;

    const createOfferTile = (offer: { type: OfferedLetterType; letter: string }, x: number, y: number) => {
      const container = this.add.container(x, y);
      const fill = offer.type === "vowel" ? 0x34d399 : 0x60a5fa;

      const tile = this.add.rectangle(0, 0, tileSize, tileSize, fill);
      tile.setStrokeStyle(2, 0x0b1220);

      const text = this.add
        .text(0, 0, offer.letter, {
          fontFamily: "Arial, sans-serif",
          fontSize: "34px",
          fontStyle: "bold",
          color: "#0b1220",
        })
        .setOrigin(0.5);

      const score = SCRABBLE_LETTER_SCORES[offer.letter] ?? 0;
      const scoreText = this.add
        .text(tileSize / 2 - 7, -tileSize / 2 + 7, String(score), {
          fontFamily: "Arial, sans-serif",
          fontSize: "14px",
          fontStyle: "bold",
          color: "#0b1220",
        })
        .setOrigin(1, 0)
        .setAlpha(0.85);

      container.add([tile, text, scoreText]);
      container.setSize(tileSize, tileSize);
      container.setInteractive({ useHandCursor: true });
      this.input.setDraggable(container);

      const offeredTile: OfferedTile = {
        type: offer.type,
        letter: offer.letter,
        container,
        tile,
        text,
        scoreText,
      };

      const homeX = x;
      const homeY = y;

      container.on("dragstart", () => {
        if (this.gamePhase !== "play") return;
        container.setDepth(1000);
      });

      container.on("drag", (_p: any, dragX: number, dragY: number) => {
        if (this.gamePhase !== "play") return;
        const adjustedY = homeY + (dragY - homeY) * this.DRAG_Y_MULTIPLIER - this.DRAG_Y_OFFSET;
        container.setPosition(dragX, adjustedY);

        const target = this.findDropTarget(container.x, container.y);
        this.setHighlightedTarget(target);
      });

      container.on("dragend", async () => {
        if (this.gamePhase !== "play") {
          container.setPosition(homeX, homeY);
          container.setDepth(0);
          this.setHighlightedTarget(null);
          return;
        }

        const target = this.findDropTarget(container.x, container.y);
        if (target == null) {
          container.setPosition(homeX, homeY);
          container.setDepth(0);
          this.setHighlightedTarget(null);
          return;
        }

        container.setPosition(homeX, homeY);
        container.setDepth(0);
        this.setHighlightedTarget(null);
        await this.tryApplyOfferedLetter(offeredTile, target);
      });

      this.offeredTiles.push(offeredTile);
    };

    const totalWVowels = vowels.length * tileSize + (vowels.length - 1) * gap;
    const startXVowels = (PLAY_WIDTH - totalWVowels) / 2 + tileSize / 2;
    vowels.forEach((offer, idx) => {
      const x = startXVowels + idx * (tileSize + gap);
      createOfferTile(offer, x, vowelsY);
    });

    const totalWCons = consonants.length * tileSize + (consonants.length - 1) * gap;
    const startXCons = (PLAY_WIDTH - totalWCons) / 2 + tileSize / 2;
    consonants.forEach((offer, idx) => {
      const x = startXCons + idx * (tileSize + gap);
      createOfferTile(offer, x, consonantsY);
    });

    this.updateAvailableWordsText();
  }

  private findDropTarget(x: number, y: number): number | null {
    for (const t of this.currentWordTiles) {
      const bounds = t.container.getBounds();
      if (bounds.contains(x, y)) return t.index;
    }
    return null;
  }

  private async tryApplyOfferedLetter(offered: OfferedTile, index: number) {
    if (this.gamePhase !== "play") return;

    const currentWord = this.currentWord;
    const candidate = replaceAt(currentWord, index, offered.letter);

    if (candidate === currentWord) {
      this.statusText.setText("Must change the word");
      return;
    }

    if (this.usedWords.has(candidate)) {
      this.statusText.setText("Word already used");
      return;
    }

    this.statusText.setText("Checking word...");
    this.gamePhase = "checking";

    const ok = this.isValidWord(candidate);

    if (!ok) {
      this.statusText.setText("Not a valid word");
      this.gamePhase = "play";
      return;
    }

    this.submittedWords.push(candidate);
    this.usedWords.add(candidate);

    this.currentWord = candidate;

    this.turnsMade = this.submittedWords.length;
    this.score += scoreScrabbleWord(candidate);
    this.updateHud();

    // Replace used offered tile with same type, ensuring no duplicates across offered letters
    const exclude = new Set(this.offeredTiles.map((t) => t.letter));
    exclude.delete(offered.letter);
    const pool = offered.type === "vowel" ? VOWELS : CONSONANTS;

    const highValueCount = this.offeredTiles.reduce((acc, t) => {
      if (t === offered) return acc;
      return acc + (isHighValueLetter(t.letter) ? 1 : 0);
    }, 0);

    const constrainedCandidates = pool.filter((l) => {
      if (exclude.has(l)) return false;
      if (pool === CONSONANTS && highValueCount >= 1 && isHighValueLetter(l)) return false;
      return true;
    });

    const unconstrainedCandidates = pool.filter((l) => !exclude.has(l));
    offered.letter = pickRandom(constrainedCandidates.length > 0 ? constrainedCandidates : unconstrainedCandidates);
    offered.text.setText(offered.letter);
    offered.scoreText.setText(String(SCRABBLE_LETTER_SCORES[offered.letter] ?? 0));

    this.createWordStack();
    this.updateAvailableWordsText();

    if (this.turnsMade >= MAX_TURNS) {
      this.showNoTurnsAndEnd();
      return;
    }

    this.gamePhase = "play";
    this.statusText.setText("Drag a new letter onto the word");
    this.updateAvailableWordsText();

    await this.checkIfAnyMovesLeft();
  }

  private async checkIfAnyMovesLeft() {
    if (this.gamePhase === "over") return;

    const currentWord = this.currentWord;
    const offeredLetters = this.offeredTiles.map((t) => t.letter);

    const candidates = new Set<string>();
    for (let i = 0; i < 5; i++) {
      for (const letter of offeredLetters) {
        const c = replaceAt(currentWord, i, letter);
        if (c !== currentWord && !this.usedWords.has(c)) candidates.add(c);
      }
    }

    if (candidates.size === 0) {
      this.showNoMovesAndEnd();
      return;
    }

    // Check a small set sequentially using the cache-backed validator.
    this.statusText.setText("Checking for moves...");
    this.gamePhase = "checking";

    for (const c of candidates) {
      if (this.isValidWord(c)) {
        this.statusText.setText("Drag a new letter onto the word");
        this.gamePhase = "play";
        this.updateAvailableWordsText();
        return;
      }
    }

    this.showNoMovesAndEnd();
  }

  private showNoMovesAndEnd() {
    if (this.hasDispatchedGameOver) return;
    // Lock input while the popup is shown.
    this.gamePhase = "checking";
    this.availableWordsText.setVisible(false);
    this.statusText.setVisible(false);
    this.giveUpButton?.setVisible(false);
    this.setHighlightedTarget(null);

    this.noMovesPopup?.destroy(true);
    const popup = this.add.container(PLAY_WIDTH / 2, PLAY_HEIGHT / 2);
    const panel = this.add.rectangle(0, 0, 420, 180, 0x0b1220, 0.95);
    panel.setStrokeStyle(2, 0x334155);
    const msg = this.add
      .text(0, 0, "No more words available", {
        fontFamily: "Arial, sans-serif",
        fontSize: "26px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    popup.add([panel, msg]);
    popup.setDepth(1500);
    this.noMovesPopup = popup;

    this.time.delayedCall(2000, () => {
      this.noMovesPopup?.destroy(true);
      this.noMovesPopup = undefined;
      this.endGame(0);
    });
  }

  private showNoTurnsAndEnd() {
    if (this.hasDispatchedGameOver) return;

    // Lock input while the popup is shown.
    this.gamePhase = "checking";
    this.availableWordsText.setVisible(false);
    this.statusText.setVisible(false);
    this.giveUpButton?.setVisible(false);
    this.setHighlightedTarget(null);

    this.noTurnsPopup?.destroy(true);
    const popup = this.add.container(PLAY_WIDTH / 2, PLAY_HEIGHT / 2);
    const panel = this.add.rectangle(0, 0, 440, 220, 0x0b1220, 0.95);
    panel.setStrokeStyle(2, 0x334155);

    const title = this.add
      .text(0, -30, "No more turns", {
        fontFamily: "Arial, sans-serif",
        fontSize: "30px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const hint = this.add
      .text(0, 45, "Tap anywhere to finish", {
        fontFamily: "Arial, sans-serif",
        fontSize: "18px",
        color: "#cbd5e1",
      })
      .setOrigin(0.5);

    popup.add([panel, title, hint]);
    popup.setDepth(1500);
    this.noTurnsPopup = popup;

    this.input.once("pointerdown", () => {
      if (this.hasDispatchedGameOver) return;
      this.noTurnsPopup?.destroy(true);
      this.noTurnsPopup = undefined;
      this.endGame(0);
    });
  }

  private endGame(dispatchDelayMs: number) {
    if (this.hasDispatchedGameOver) return;
    this.hasDispatchedGameOver = true;
    this.gamePhase = "over";
    this.statusText.setVisible(true);
    this.statusText.setText("Game over");

    this.giveUpButton?.setVisible(false);
    this.confirmGiveUp?.destroy(true);
    this.confirmGiveUp = undefined;

    this.noMovesPopup?.destroy(true);
    this.noMovesPopup = undefined;

    this.noTurnsPopup?.destroy(true);
    this.noTurnsPopup = undefined;

    this.time.delayedCall(dispatchDelayMs, () => {
      dispatchGameOver({ gameId: GAME_ID, score: this.score, ts: Date.now() });
    });
  }
}
