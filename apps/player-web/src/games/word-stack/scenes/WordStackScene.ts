import Phaser from "phaser";
import { BasePlatformScene } from "../../../platform/scenes/BasePlatformScene";
import { hexToNumber } from "../../../platform/hud/format";
import { SCRABBLE_LETTER_SCORES } from "../../../game/words/scrabble";
import { dailySeed } from "../useCases/dailySeed";
import {
  availableSteps,
  dealPlayableOffers,
  judgeStep,
  pickStartWord,
  replaceAt,
  replaceOffer,
  stepScore,
  WORD_LENGTH,
  type Offer,
  type Rng,
} from "../useCases/rules";

const W = 540;

// Layout (design px). The HUD owns the top ~140.
const STATUS_Y = 168;
const CURRENT_Y = 250;
const CURRENT_TILE = 76;
const CURRENT_GAP = 10;
const STACK_TOP_Y = 336;
const STACK_TILE = 42;
const STACK_GAP = 8;
const STACK_ROW = 52;
const STACK_ROWS = 6;
const HINT_Y = 668;
const VOWELS_Y = 738;
const CONSONANTS_Y = 828;
const OFFER_TILE = 68;
const OFFER_GAP = 12;
const FINISH_Y = 916;

// A dragged tile runs ahead of the finger so the finger doesn't hide the word.
const DRAG_Y_MULTIPLIER = 1.6;
const DRAG_Y_OFFSET = 70;
const DRAG_DEPTH = 1500;
const MODAL_DEPTH = 2000;

type Phase = "play" | "confirm" | "over";

type WordTile = {
  index: number;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
};

type OfferTile = {
  container: Phaser.GameObjects.Container;
  letter: Phaser.GameObjects.Text;
  value: Phaser.GameObjects.Text;
};

/**
 * Word Stack: everyone starts the day on the same word. Drag an offered letter onto
 * a letter of the word to make a new word; each new word scores its Scrabble value.
 * The run ends when no offered letter makes a new word, or when you press Finish.
 */
export default class WordStackScene extends BasePlatformScene {
  protected endRunDelayMs = 1500; // time to read "No more words!"

  private rng: Rng = Math.random;
  private phase: Phase = "play";
  private score = 0;
  private currentWord = "";
  private history: string[] = [];
  private used = new Set<string>();
  private offers: Offer[] = [];
  private highlighted: number | null = null;

  private ink = 0;
  private paper = 0;
  private sun = 0;

  private statusText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private currentLayer!: Phaser.GameObjects.Container;
  private stackLayer!: Phaser.GameObjects.Container;
  private wordTiles: WordTile[] = [];
  private offerTiles: OfferTile[] = [];
  private finishButton!: Phaser.GameObjects.Container;
  private modal: Phaser.GameObjects.Container | null = null;

  constructor() {
    super("WordStack");
  }

  protected startRun() {
    // The scene object survives restarts: reset every per-run field first.
    this.rng = this.host.rng();
    this.phase = "play";
    this.score = 0;
    this.highlighted = null;
    this.wordTiles = [];
    this.offerTiles = [];
    this.modal = null;

    const c = this.host.colors;
    this.ink = hexToNumber(c.ink);
    this.paper = hexToNumber(c.paper);
    this.sun = hexToNumber(c.sun);

    // Same start word for every player today; Play again keeps it.
    this.currentWord = pickStartWord(this.host.rng(dailySeed(new Date())));
    this.history = [];
    this.used = new Set([this.currentWord]);
    this.offers = dealPlayableOffers(this.rng, this.currentWord, this.used);

    this.hud.setScore(0);
    this.hud.setBest(this.host.best.get());

    this.statusText = this.text(W / 2, STATUS_Y, "", 24, this.host.fonts.body).setOrigin(0.5);
    this.hintText = this.text(W / 2, HINT_Y, "", 20, this.host.fonts.body).setOrigin(0.5);
    this.currentLayer = this.add.container(0, 0);
    this.stackLayer = this.add.container(0, 0);

    this.drawCurrentWord();
    this.drawStack();
    this.createOfferTiles();
    this.finishButton = this.createButton(W / 2, FINISH_Y, 200, 56, "Finish", c.sun, () =>
      this.askFinish(),
    );

    this.setStatus("Drag a letter onto the word");
    this.updateHint();
  }

  // ---------------------------------------------------------------- drawing

  private text(
    x: number,
    y: number,
    value: string,
    size: number,
    font: string = this.host.fonts.display,
  ) {
    return this.add.text(x, y, value, {
      fontFamily: font,
      fontSize: `${size}px`,
      fontStyle: "800",
      color: this.host.colors.ink,
    });
  }

  /** A letter tile: coloured square, ink outline, letter and its Scrabble value. */
  private letterTile(x: number, y: number, size: number, letter: string, fill: number) {
    const bg = this.add.rectangle(0, 0, size, size, fill).setStrokeStyle(3, this.ink);
    const label = this.text(0, 2, letter, Math.round(size * 0.5)).setOrigin(0.5);
    const value = this.text(
      size / 2 - 5,
      -size / 2 + 3,
      String(SCRABBLE_LETTER_SCORES[letter] ?? 0),
      Math.max(12, Math.round(size * 0.2)),
      this.host.fonts.body,
    ).setOrigin(1, 0);
    const container = this.add.container(x, y, [bg, label, value]).setSize(size, size);
    return { container, bg, label, value };
  }

  private rowStartX(count: number, size: number, gap: number) {
    return (W - (count * size + (count - 1) * gap)) / 2 + size / 2;
  }

  /** The big word you change. Drawn once; the stack below shows only earlier words. */
  private drawCurrentWord() {
    this.currentLayer.removeAll(true);
    this.wordTiles = [];
    const x0 = this.rowStartX(WORD_LENGTH, CURRENT_TILE, CURRENT_GAP);
    for (let i = 0; i < WORD_LENGTH; i++) {
      const letter = this.currentWord[i] ?? "";
      const x = x0 + i * (CURRENT_TILE + CURRENT_GAP);
      const { container, bg } = this.letterTile(x, CURRENT_Y, CURRENT_TILE, letter, this.paper);
      this.currentLayer.add(container);
      this.wordTiles.push({ index: i, container, bg });
    }
    this.highlighted = null;
  }

  /** Earlier words, newest first, fading out with age. */
  private drawStack() {
    this.stackLayer.removeAll(true);
    const recent = this.history.slice(-STACK_ROWS).reverse();
    const x0 = this.rowStartX(WORD_LENGTH, STACK_TILE, STACK_GAP);
    recent.forEach((word, row) => {
      const y = STACK_TOP_Y + row * STACK_ROW;
      const alpha = 1 - row * 0.12;
      for (let i = 0; i < WORD_LENGTH; i++) {
        const x = x0 + i * (STACK_TILE + STACK_GAP);
        const tile = this.letterTile(x, y, STACK_TILE, word[i] ?? "", this.paper);
        tile.bg.setStrokeStyle(2, this.ink);
        tile.container.setAlpha(alpha);
        this.stackLayer.add(tile.container);
      }
      const right = x0 + (WORD_LENGTH - 1) * (STACK_TILE + STACK_GAP) + STACK_TILE / 2 + 12;
      const pts = this.text(right, y, `+${stepScore(word)}`, 18, this.host.fonts.body)
        .setOrigin(0, 0.5)
        .setAlpha(alpha);
      this.stackLayer.add(pts);
    });
  }

  private createOfferTiles() {
    const grass = hexToNumber(this.host.colors.grass);
    const sky = hexToNumber(this.host.colors.sky);
    const vowels = this.offers.filter((o) => o.kind === "vowel").length;
    const consonants = this.offers.length - vowels;
    const vowelX0 = this.rowStartX(vowels, OFFER_TILE, OFFER_GAP);
    const consX0 = this.rowStartX(consonants, OFFER_TILE, OFFER_GAP);
    let v = 0;
    let k = 0;

    this.offers.forEach((offer, index) => {
      const isVowel = offer.kind === "vowel";
      const x = isVowel
        ? vowelX0 + v++ * (OFFER_TILE + OFFER_GAP)
        : consX0 + k++ * (OFFER_TILE + OFFER_GAP);
      const y = isVowel ? VOWELS_Y : CONSONANTS_Y;
      const tile = this.letterTile(x, y, OFFER_TILE, offer.letter, isVowel ? grass : sky);
      this.offerTiles.push({ container: tile.container, letter: tile.label, value: tile.value });
      this.makeDraggable(tile.container, index, x, y);
    });
  }

  private makeDraggable(
    container: Phaser.GameObjects.Container,
    index: number,
    homeX: number,
    homeY: number,
  ) {
    container.setInteractive({ useHandCursor: true });
    this.input.setDraggable(container);

    const goHome = () => {
      container.setPosition(homeX, homeY).setDepth(0);
      this.setHighlighted(null);
    };

    container.on("dragstart", () => {
      if (this.phase !== "play") return;
      container.setDepth(DRAG_DEPTH);
    });

    container.on("drag", (_p: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      if (this.phase !== "play") return;
      const y = homeY + (dragY - homeY) * DRAG_Y_MULTIPLIER - DRAG_Y_OFFSET;
      container.setPosition(dragX, y);
      this.setHighlighted(this.dropTarget(container.x, container.y));
    });

    container.on("dragend", () => {
      const target = this.phase === "play" ? this.dropTarget(container.x, container.y) : null;
      goHome();
      if (target !== null) this.tryStep(index, target);
    });
  }

  private dropTarget(x: number, y: number): number | null {
    for (const t of this.wordTiles) {
      if (t.container.getBounds().contains(x, y)) return t.index;
    }
    return null;
  }

  private setHighlighted(index: number | null) {
    if (this.highlighted === index) return;
    this.highlighted = index;
    for (const t of this.wordTiles) {
      t.bg.setFillStyle(t.index === index ? this.sun : this.paper);
    }
  }

  private createButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    fill: string,
    onTap: () => void,
    fontSize = 24,
  ) {
    const bg = this.add.rectangle(0, 0, w, h, hexToNumber(fill)).setStrokeStyle(4, this.ink);
    const t = this.text(0, 1, label, fontSize).setOrigin(0.5);
    const button = this.add.container(x, y, [bg, t]).setSize(w, h);
    button.setInteractive({ useHandCursor: true });
    button.on("pointerdown", onTap);
    return button;
  }

  private setStatus(message: string) {
    this.statusText.setText(message);
  }

  private updateHint() {
    if (this.phase === "over") {
      this.hintText.setVisible(false);
      return;
    }
    const letters = this.offers.map((o) => o.letter);
    const n = availableSteps(this.currentWord, letters, this.used).length;
    const label = n > 10 ? "10+ words to find" : `${n} word${n === 1 ? "" : "s"} to find`;
    this.hintText.setText(label).setVisible(true);
  }

  // ---------------------------------------------------------------- play

  private tryStep(offerIndex: number, position: number) {
    if (this.phase !== "play") return;
    const offer = this.offers[offerIndex];
    if (!offer) return;

    const candidate = replaceAt(this.currentWord, position, offer.letter);
    const verdict = judgeStep(this.currentWord, candidate, this.used);
    if (verdict !== "ok") {
      this.setStatus(
        verdict === "same"
          ? "That's the same word"
          : verdict === "used"
            ? `${candidate} is already in your stack`
            : `${candidate} isn't a word`,
      );
      this.host.audio.play("miss");
      this.host.haptics.tap();
      return;
    }

    const points = stepScore(candidate);
    this.score += points;
    this.history.push(this.currentWord);
    this.currentWord = candidate;
    this.used.add(candidate);
    this.hud.setScore(this.score);
    this.hud.popup(`+${points}`, W / 2, CURRENT_Y - 40, this.host.colors.grass);
    this.host.audio.play("score");
    this.host.haptics.success();

    this.offers = replaceOffer(this.offers, offerIndex, this.rng);
    const next = this.offers[offerIndex];
    const tile = this.offerTiles[offerIndex];
    if (next && tile) {
      tile.letter.setText(next.letter);
      tile.value.setText(String(SCRABBLE_LETTER_SCORES[next.letter] ?? 0));
    }

    this.drawCurrentWord();
    this.drawStack();

    const letters = this.offers.map((o) => o.letter);
    if (availableSteps(this.currentWord, letters, this.used).length === 0) {
      this.finish("No more words! Great stack.");
      return;
    }
    this.setStatus(`${candidate}! Keep going`);
    this.updateHint();
  }

  private askFinish() {
    if (this.phase !== "play") return;
    this.phase = "confirm";

    const shade = this.add.rectangle(W / 2, 480, W, 960, this.ink, 0.35).setInteractive(); // swallows taps behind the dialog
    const panel = this.add.rectangle(W / 2, 480, 400, 230, this.paper).setStrokeStyle(4, this.ink);
    const title = this.text(W / 2, 425, "Finish this stack?", 30).setOrigin(0.5);
    const yes = this.createButton(W / 2 - 90, 520, 150, 56, "Finish", this.host.colors.sun, () =>
      this.finish("All done!"),
    );
    const no = this.createButton(
      W / 2 + 90,
      520,
      150,
      56,
      "Keep going",
      this.host.colors.paper,
      () => this.closeModal(),
      20,
    );

    this.modal = this.add.container(0, 0, [shade, panel, title, yes, no]).setDepth(MODAL_DEPTH);
  }

  private closeModal() {
    this.modal?.destroy(true);
    this.modal = null;
    if (this.phase === "confirm") this.phase = "play";
  }

  private finish(message: string) {
    if (this.phase === "over") return;
    this.closeModal();
    this.phase = "over";
    this.setHighlighted(null);
    this.setStatus(message);
    this.updateHint();
    this.finishButton.setVisible(false);
    this.endRun(this.score, { words: this.history.length });
  }
}
