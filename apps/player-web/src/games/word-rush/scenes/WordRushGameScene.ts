import type Phaser from "phaser";
import { BasePlatformScene } from "../../../platform/scenes/BasePlatformScene";
import { createOnScreenKeyboard, keys } from "../../../platform/input";
import { hexToNumber } from "../../../platform/hud/format";
import { categories } from "../data";
import { button, confirmModal, type Button } from "../ui/widgets";
import {
  BUY_COST_MS,
  HIDDEN,
  boardLines,
  canBuyLetter,
  isCorrect,
  pickLetterToBuy,
  pickPhrase,
  revealLetters,
  scoreFor,
  timeFor,
  typeKey,
} from "../useCases/rules";
import { WORD_RUSH_GAME_KEY, type WordRushStart } from "./LetterSelectionScene";

type Tile = {
  /** Index of this character in the phrase, to read the reveal pattern. */
  index: number;
  isLetter: boolean;
  bg: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  shown: boolean;
};

type Keyboard = ReturnType<typeof createOnScreenKeyboard>;

const TILE = 42;
const TILE_GAP = 6;
const WORD_GAP = 20;
const LINE_GAP = 14;
const BOARD_CENTRE_Y = 345;
const REVEAL_STEP_MS = 250;
const SOLVED_PAUSE_MS = 2000;
const KEY_DEBOUNCE_MS = 60;
const ALPHABET = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ");

/**
 * Guess the hidden word or phrase before the clock runs out. Each solve scores the
 * seconds left and starts the next level; time running out or giving up ends the run.
 */
export default class WordRushGameScene extends BasePlatformScene {
  // A moment to read the answer before the score dialog.
  protected endRunDelayMs = 2500;

  private letters: string[] = [];
  private rng: () => number = Math.random;
  private level = 1;
  private totalScore = 0;
  private msLeft = 0;
  /** True while a level is in play: the clock runs and answers are accepted. */
  private gameActive = false;
  private phrase = "";
  private shownLetters = new Set<string>();
  private boughtLetters = new Set<string>();
  private usedPhrases = new Set<string>();
  private answer = "";
  private lastKeyAt = 0;
  private lastWarnSecond = 0;
  private closeModal: (() => void) | null = null;

  private tiles: Tile[] = [];
  private levelObjects: Phaser.GameObjects.GameObject[] = [];
  private levelText!: Phaser.GameObjects.Text;
  private bannerText!: Phaser.GameObjects.Text;
  private inputText!: Phaser.GameObjects.Text;
  private giveUpButton!: Button;
  private buyButton!: Button;
  private submitButton!: Button;
  private keyboard!: Keyboard;

  constructor() {
    super(WORD_RUSH_GAME_KEY);
  }

  protected startRun(data?: object) {
    // The scene object survives "Play again": reset every per-run field.
    this.letters = [...((data as Partial<WordRushStart> | undefined)?.letters ?? [])];
    this.rng = this.host.rng();
    this.level = 1;
    this.totalScore = 0;
    this.msLeft = 0;
    this.gameActive = false;
    this.phrase = "";
    this.shownLetters = new Set();
    this.boughtLetters = new Set();
    this.usedPhrases = new Set();
    this.answer = "";
    this.lastKeyAt = 0;
    this.lastWarnSecond = 0;
    this.closeModal = null;
    this.tiles = [];
    this.levelObjects = [];

    this.hud.setScore(0);
    this.hud.setBest(this.host.best.get());
    this.createUi();
    this.createKeyboards();
    this.startLevel();
  }

  update(_time: number, delta: number) {
    if (this.runEnded || !this.gameActive) return;
    this.msLeft = Math.max(0, this.msLeft - delta);
    this.hud.setTimer(this.msLeft);
    this.buyButton.setEnabled(this.canBuy());

    const secondsLeft = Math.ceil(this.msLeft / 1000);
    if (secondsLeft <= 5 && secondsLeft !== this.lastWarnSecond) {
      this.lastWarnSecond = secondsLeft;
      if (secondsLeft > 0) this.host.audio.beep(440, 60);
    }
    if (this.msLeft <= 0) this.finish("Time's up!");
  }

  // ---------------------------------------------------------------- set-up

  private createUi() {
    const { width } = this.scale;
    const { colors, fonts } = this.host;
    const ink = hexToNumber(colors.ink);

    this.levelText = this.add
      .text(width / 2, 170, "", {
        fontFamily: fonts.display,
        fontSize: "26px",
        fontStyle: "800",
        color: colors.ink,
      })
      .setOrigin(0.5);

    this.bannerText = this.add
      .text(width / 2, 492, "", {
        fontFamily: fonts.display,
        fontSize: "34px",
        fontStyle: "800",
        color: colors.sun,
        stroke: colors.ink,
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    const box = this.add.graphics();
    box.fillStyle(hexToNumber(colors.paper), 1).fillRoundedRect(40, 520, width - 80, 54, 14);
    box.lineStyle(4, ink, 1).strokeRoundedRect(40, 520, width - 80, 54, 14);
    this.inputText = this.add
      .text(width / 2, 547, "", {
        fontFamily: fonts.display,
        fontSize: "26px",
        fontStyle: "800",
        color: colors.ink,
      })
      .setOrigin(0.5);
    this.showInput();

    const y = 625;
    const w = 150;
    const h = 56;
    this.giveUpButton = button(this, this.host, {
      x: 30 + w / 2,
      y,
      w,
      h,
      label: "GIVE UP",
      fill: colors.tomato,
      onTap: () => this.askGiveUp(),
    });
    this.buyButton = button(this, this.host, {
      x: width / 2,
      y,
      w,
      h,
      label: "BUY LETTER",
      fill: colors.sky,
      fontSize: 20,
      onTap: () => this.askBuyLetter(),
    });
    this.submitButton = button(this, this.host, {
      x: width - 30 - w / 2,
      y,
      w,
      h,
      label: "SUBMIT",
      fill: colors.grass,
      onTap: () => this.submit(),
    });
  }

  private createKeyboards() {
    const { colors } = this.host;
    this.keyboard = createOnScreenKeyboard(this, {
      centerX: this.scale.width / 2,
      topY: 712,
      enabled: () => this.canType(),
      getKeyFill: (letter) => {
        if (this.boughtLetters.has(letter)) return hexToNumber(colors.grass);
        if (this.letters.includes(letter)) return hexToNumber(colors.sky);
        return 0x818384;
      },
      onKey: (key) => {
        // A finger resting on a key can fire twice in quick succession.
        if (this.time.now - this.lastKeyAt < KEY_DEBOUNCE_MS) return;
        this.lastKeyAt = this.time.now;
        this.type(key);
      },
      showSpace: true,
      showBackspace: true,
    });

    // A real keyboard on desktop: letters, space, backspace and enter.
    const map: Record<string, () => void> = {
      " ": () => this.type("SPACE"),
      Backspace: () => this.type("BACKSPACE"),
      Enter: () => this.submit(),
    };
    for (const letter of ALPHABET) {
      map[letter] = () => this.type(letter);
      map[letter.toLowerCase()] = () => this.type(letter);
    }
    keys(this, map);
  }

  // ---------------------------------------------------------------- levels

  private startLevel() {
    const pick = pickPhrase(this.level, categories, this.rng, this.usedPhrases);
    if (!pick) {
      this.finish("Out of puzzles!");
      return;
    }
    this.phrase = pick.phrase;
    this.usedPhrases.add(pick.phrase);
    this.shownLetters = new Set(this.letters);
    this.boughtLetters = new Set();
    this.answer = "";
    this.lastWarnSecond = 0;
    this.msLeft = timeFor(this.level);

    this.levelObjects.forEach((o) => o.destroy());
    this.levelObjects = [];
    this.levelText.setText(`Level ${this.level}: ${pick.category}`);
    this.bannerText.setText("");
    this.showInput();
    this.hud.setTimer(this.msLeft);
    this.keyboard.refresh();
    this.giveUpButton.setEnabled(true);
    this.submitButton.setEnabled(true);
    this.buyButton.setEnabled(false);
    this.buildBoard();

    // Flip the chosen letters over one by one, then start the clock.
    const pattern = revealLetters(this.phrase, this.shownLetters);
    const toFlip = this.tiles.filter((t) => t.isLetter && pattern[t.index] !== HIDDEN);
    toFlip.forEach((tile, i) => this.time.delayedCall(i * REVEAL_STEP_MS, () => this.flip(tile)));
    this.time.delayedCall(toFlip.length * REVEAL_STEP_MS + 400, () => {
      if (this.runEnded) return;
      this.gameActive = true;
      this.buyButton.setEnabled(this.canBuy());
    });
  }

  private buildBoard() {
    const { colors, fonts } = this.host;
    const ink = hexToNumber(colors.ink);
    const lines = boardLines(this.phrase);
    const top = BOARD_CENTRE_Y - (lines.length * TILE + (lines.length - 1) * LINE_GAP) / 2;
    this.tiles = [];

    let index = 0; // position in the phrase, spaces included
    lines.forEach((words, row) => {
      const letters = words.reduce((n, w) => n + w.length, 0);
      const lineWidth = letters * (TILE + TILE_GAP) - TILE_GAP + (words.length - 1) * WORD_GAP;
      let x = (this.scale.width - lineWidth) / 2 + TILE / 2;
      const y = top + row * (TILE + LINE_GAP) + TILE / 2;
      words.forEach((word) => {
        for (const ch of word) {
          const isLetter = ch >= "A" && ch <= "Z";
          const bg = this.add.rectangle(x, y, TILE, TILE, hexToNumber(colors.sky));
          bg.setStrokeStyle(3, ink).setVisible(isLetter);
          const text = this.add
            .text(x, y, ch, {
              fontFamily: fonts.display,
              fontSize: "30px",
              fontStyle: "800",
              color: colors.ink,
            })
            .setOrigin(0.5)
            .setVisible(!isLetter);
          this.tiles.push({ index, isLetter, bg, text, shown: !isLetter });
          this.levelObjects.push(bg, text);
          x += TILE + TILE_GAP;
          index++;
        }
        x += WORD_GAP;
        index++; // the space after the word
      });
    });
  }

  /** Turn one tile over to show its letter. */
  private flip(tile: Tile, fill: string = this.host.colors.paper) {
    if (tile.shown) return;
    tile.shown = true;
    this.host.audio.ding();
    this.tweens.add({
      targets: [tile.bg, tile.text],
      scaleX: { from: 1, to: 0 },
      duration: 140,
      onComplete: () => {
        tile.bg.setFillStyle(hexToNumber(fill));
        tile.text.setVisible(true);
        this.tweens.add({
          targets: [tile.bg, tile.text],
          scaleX: { from: 0, to: 1 },
          duration: 140,
        });
      },
    });
  }

  /** Show a tile at once in `fill`, cancelling a flip that is still turning. */
  private showTile(tile: Tile, fill: string) {
    tile.shown = true;
    this.tweens.killTweensOf([tile.bg, tile.text]);
    tile.bg.setScale(1).setFillStyle(hexToNumber(fill));
    tile.text.setScale(1).setVisible(true);
  }

  // ---------------------------------------------------------------- answers

  private canType(): boolean {
    return this.gameActive && this.closeModal === null && !this.runEnded;
  }

  private type(key: string) {
    if (!this.canType()) return;
    const next = typeKey(this.answer, key);
    if (next === this.answer) return;
    this.answer = next;
    this.host.audio.play("tap");
    this.showInput();
  }

  private showInput() {
    const empty = this.answer.length === 0;
    this.inputText.setText(empty ? "Type your answer..." : this.answer);
    this.inputText.setAlpha(empty ? 0.45 : 1);
  }

  private submit() {
    if (!this.canType()) return;
    if (isCorrect(this.answer, this.phrase)) {
      this.solve();
      return;
    }
    this.host.audio.play("miss");
    this.host.haptics.tap();
    this.tweens.killTweensOf(this.inputText);
    this.inputText.setX(this.scale.width / 2);
    this.tweens.add({
      targets: this.inputText,
      x: { from: this.scale.width / 2 - 10, to: this.scale.width / 2 },
      duration: 60,
      repeat: 3,
    });
  }

  private solve() {
    // Stop the clock and further answers at once, so a double tap can't score twice.
    this.gameActive = false;
    const points = scoreFor(this.msLeft);
    this.totalScore += points;
    this.hud.setScore(this.totalScore);
    this.hud.popup(`+${points}`, this.scale.width / 2, BOARD_CENTRE_Y);
    this.host.audio.play("score");
    this.host.haptics.success();
    this.bannerText.setText("Well done!");
    this.setButtonsEnabled(false);
    this.tiles
      .filter((t) => t.isLetter)
      .forEach((tile, i) => {
        this.showTile(tile, this.host.colors.grass);
        this.tweens.add({
          targets: [tile.bg, tile.text],
          scale: { from: 1, to: 1.15 },
          duration: 120,
          delay: i * 40,
          yoyo: true,
        });
      });
    this.time.delayedCall(SOLVED_PAUSE_MS, () => {
      if (this.runEnded) return;
      this.level++;
      this.startLevel();
    });
  }

  /** Time's up or given up: show the answer, then end the run. */
  private finish(message: string) {
    if (this.runEnded) return;
    this.gameActive = false;
    this.closeModal?.();
    this.closeModal = null;
    this.hud.setTimer(this.msLeft);
    this.setButtonsEnabled(false);
    this.bannerText.setText(message);
    this.tiles.forEach((tile) => {
      if (!tile.shown) this.showTile(tile, this.host.colors.sun);
    });
    this.endRun(this.totalScore, { levelsSolved: this.level - 1 });
  }

  private setButtonsEnabled(enabled: boolean) {
    this.giveUpButton.setEnabled(enabled);
    this.buyButton.setEnabled(enabled && this.canBuy());
    this.submitButton.setEnabled(enabled);
  }

  // ---------------------------------------------------------------- dialogs

  private canBuy(): boolean {
    return canBuyLetter(this.msLeft, this.phrase, this.shownLetters);
  }

  private ask(open: (close: () => void) => () => void) {
    if (!this.canType()) return;
    this.host.audio.play("tap");
    const done = () => {
      this.closeModal = null;
    };
    this.closeModal = open(done);
  }

  private askGiveUp() {
    this.ask((done) =>
      confirmModal(this, this.host, {
        title: "Give up?",
        message: "You keep the points you have scored so far.",
        confirmLabel: "GIVE UP",
        cancelLabel: "KEEP GOING",
        accent: this.host.colors.tomato,
        onConfirm: () => {
          done();
          this.finish("The answer was...");
        },
        onCancel: done,
      }),
    );
  }

  private askBuyLetter() {
    if (!this.canBuy()) {
      this.host.audio.play("miss");
      return;
    }
    this.ask((done) =>
      confirmModal(this, this.host, {
        title: "Buy a letter?",
        message: `It shows one hidden letter everywhere it appears. It costs ${BUY_COST_MS / 1000} seconds.`,
        confirmLabel: "BUY",
        cancelLabel: "CANCEL",
        accent: this.host.colors.sky,
        onConfirm: () => {
          done();
          this.buyLetter();
        },
        onCancel: done,
      }),
    );
  }

  private buyLetter() {
    // The clock kept running while the dialog was open; check again.
    if (!this.gameActive || !this.canBuy()) return;
    const letter = pickLetterToBuy(this.phrase, this.shownLetters, this.rng);
    if (!letter) return;
    this.msLeft -= BUY_COST_MS;
    this.hud.setTimer(this.msLeft);
    this.hud.popup(`-${BUY_COST_MS / 1000}s`, this.scale.width / 2, 150, this.host.colors.tomato);
    this.shownLetters.add(letter);
    this.boughtLetters.add(letter);
    this.keyboard.refresh();
    this.buyButton.setEnabled(this.canBuy());

    const pattern = revealLetters(this.phrase, this.shownLetters);
    this.tiles
      .filter((t) => t.isLetter && !t.shown && pattern[t.index] !== HIDDEN)
      .forEach((tile, i) =>
        this.time.delayedCall(i * REVEAL_STEP_MS, () => {
          if (!this.runEnded) this.flip(tile, this.host.colors.grass);
        }),
      );
  }
}
