import type Phaser from "phaser";
import { BasePlatformScene } from "../../../platform/scenes/BasePlatformScene";
import { hexToNumber } from "../../../platform/hud/format";
import { button, type Button } from "../ui/widgets";
import { CONSONANTS, PICKS, VOWELS, isVowel, picksComplete, togglePick } from "../useCases/letters";

export const LETTER_SELECTION_KEY = "LetterSelection";
export const WORD_RUSH_GAME_KEY = "WordRushGame";

/** What the letter picker hands the game scene. */
export type WordRushStart = { letters: string[] };

const TILE = 60;
const GAP = 8;

/** Pick 4 consonants and 2 vowels; they show on every board this run. */
export default class LetterSelectionScene extends BasePlatformScene {
  private picks: string[] = [];
  private tiles = new Map<string, Phaser.GameObjects.Rectangle>();
  private selectionText!: Phaser.GameObjects.Text;
  private startButton!: Button;
  private starting = false;

  constructor() {
    super(LETTER_SELECTION_KEY);
  }

  protected startRun() {
    this.picks = [];
    this.tiles = new Map();
    this.starting = false;

    const { width } = this.scale;
    const { colors, fonts } = this.host;
    const heading = (y: number, text: string, size: number, color: string = colors.ink) =>
      this.add
        .text(width / 2, y, text, {
          fontFamily: fonts.display,
          fontSize: `${size}px`,
          fontStyle: "800",
          color,
          stroke: color === colors.ink ? undefined : colors.ink,
          strokeThickness: color === colors.ink ? 0 : 6,
        })
        .setOrigin(0.5);

    heading(80, "WORD RUSH", 56, colors.sun);
    heading(160, "Pick your letters", 30);
    this.add
      .text(
        width / 2,
        200,
        `${PICKS.consonants} consonants and ${PICKS.vowels} vowels. They show on every puzzle.`,
        {
          fontFamily: fonts.body,
          fontSize: "20px",
          color: colors.ink,
          align: "center",
          wordWrap: { width: width - 80 },
        },
      )
      .setOrigin(0.5, 0);

    heading(285, "CONSONANTS", 22, colors.sky);
    this.grid(CONSONANTS, 7, 330);
    heading(565, "VOWELS", 22, colors.grass);
    this.grid(VOWELS, 5, 610);

    heading(700, "Your letters", 22);
    this.selectionText = heading(750, "", 36);

    this.startButton = button(this, this.host, {
      x: width / 2,
      y: 855,
      w: 300,
      h: 76,
      label: "START",
      fill: colors.grass,
      fontSize: 32,
      onTap: () => this.start(),
    });
    this.refresh();
  }

  private grid(letters: readonly string[], cols: number, top: number) {
    const step = TILE + GAP;
    const left = (this.scale.width - (cols * step - GAP)) / 2 + TILE / 2;
    letters.forEach((letter, i) => {
      const x = left + (i % cols) * step;
      const y = top + Math.floor(i / cols) * step;
      this.letterTile(x, y, letter);
    });
  }

  private letterTile(x: number, y: number, letter: string) {
    const { colors, fonts } = this.host;
    const ink = hexToNumber(colors.ink);
    const c = this.add.container(x, y);
    const shadow = this.add.rectangle(0, 4, TILE, TILE, ink);
    const tile = this.add.rectangle(0, 0, TILE, TILE, hexToNumber(colors.paper));
    tile.setStrokeStyle(4, ink);
    const text = this.add
      .text(0, 0, letter, {
        fontFamily: fonts.display,
        fontSize: "32px",
        fontStyle: "800",
        color: colors.ink,
      })
      .setOrigin(0.5);
    c.add([shadow, tile, text]);
    c.setSize(TILE, TILE);
    c.setInteractive({ useHandCursor: true });
    c.on("pointerdown", () => this.toggle(letter));
    this.tiles.set(letter, tile);
  }

  private toggle(letter: string) {
    if (this.starting) return;
    const next = togglePick(this.picks, letter);
    if (!next.ok) {
      this.host.audio.play("miss");
      this.host.haptics.tap();
      return;
    }
    this.picks = next.picks;
    this.host.audio.play("tap");
    this.refresh();
  }

  private refresh() {
    const { colors } = this.host;
    this.tiles.forEach((tile, letter) => {
      const picked = this.picks.includes(letter);
      const fill = !picked ? colors.paper : isVowel(letter) ? colors.grass : colors.sky;
      tile.setFillStyle(hexToNumber(fill));
    });
    this.selectionText.setText(this.picks.length > 0 ? this.picks.join(" ") : "-");

    const ready = picksComplete(this.picks);
    this.startButton.setEnabled(ready);
    this.tweens.killTweensOf(this.startButton.container);
    this.startButton.container.setScale(1);
    if (ready) {
      this.tweens.add({
        targets: this.startButton.container,
        scale: { from: 0.95, to: 1.05 },
        duration: 600,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  private start() {
    if (this.starting || !picksComplete(this.picks)) return;
    this.starting = true;
    this.host.audio.beep(880, 120);
    const data: WordRushStart = { letters: [...this.picks] };
    this.scene.start(WORD_RUSH_GAME_KEY, data);
  }
}
