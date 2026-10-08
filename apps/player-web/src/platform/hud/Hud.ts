import Phaser from "phaser";
import type { GameHost } from "../sdk";
import { formatClock, formatScore, hexToNumber } from "./format";

const DEPTH = 1000;
const PAD = 16;

/**
 * The shared in-game HUD, in the sticker-book style: ink-outlined paper panels and
 * the display font. Pieces are created the first time they are used, so a game
 * only shows what it needs. All objects belong to the scene and go with it.
 */
export class Hud {
  private readonly ink: number;
  private readonly paper: number;
  private readonly inkCss: string;
  private readonly font: string;
  private readonly top: number;

  private scoreText?: Phaser.GameObjects.Text;
  private bestText?: Phaser.GameObjects.Text;
  private heartsText?: Phaser.GameObjects.Text;
  private timerText?: Phaser.GameObjects.Text;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly host: GameHost,
  ) {
    this.ink = hexToNumber(host.colors.ink);
    this.paper = hexToNumber(host.colors.paper);
    this.inkCss = host.colors.ink;
    this.font = host.fonts.display;
    // Canvas pixels are design pixels scaled to fit; the inset is a good-enough guide.
    this.top = PAD + Math.min(host.safeArea().top, 40);
  }

  private text(x: number, y: number, value: string, size: number, color = this.inkCss) {
    return this.scene.add
      .text(x, y, value, {
        fontFamily: this.font,
        fontSize: `${size}px`,
        fontStyle: "800",
        color,
        stroke: color === this.inkCss ? undefined : this.inkCss,
        strokeThickness: color === this.inkCss ? 0 : 6,
      })
      .setDepth(DEPTH + 1)
      .setScrollFactor(0); // the HUD stays put when a game scrolls its camera
  }

  /** A rounded paper panel with an ink outline and hard shadow, sized to `content`. */
  private panel(content: Phaser.GameObjects.Text, padX = 14, padY = 6): void {
    const g = this.scene.add.graphics().setDepth(DEPTH).setScrollFactor(0);
    const redraw = () => {
      const b = content.getBounds();
      const x = b.x - padX;
      const y = b.y - padY;
      const w = b.width + padX * 2;
      const h = b.height + padY * 2;
      g.clear();
      g.fillStyle(this.ink, 1).fillRoundedRect(x, y + 4, w, h, 16);
      g.fillStyle(this.paper, 1).fillRoundedRect(x, y, w, h, 16);
      g.lineStyle(4, this.ink, 1).strokeRoundedRect(x, y, w, h, 16);
    };
    redraw();
    content.on("hud:resize", redraw);
  }

  private set(t: Phaser.GameObjects.Text, value: string) {
    if (t.text === value) return;
    t.setText(value);
    t.emit("hud:resize");
  }

  setScore(score: number): void {
    if (!this.scoreText) {
      this.scoreText = this.text(PAD + 14, this.top + 6, "0", 34);
      this.panel(this.scoreText);
    }
    this.set(this.scoreText, formatScore(score));
  }

  setBest(best: number): void {
    if (!this.bestText) {
      this.bestText = this.text(PAD + 14, this.top + 64, "", 20);
      this.panel(this.bestText, 12, 4);
    }
    this.set(this.bestText, `Best ${formatScore(best)}`);
  }

  setHearts(current: number, max: number): void {
    const value = "♥".repeat(Math.max(0, current)) + "♡".repeat(Math.max(0, max - current));
    if (!this.heartsText) {
      const width = this.scene.scale.width;
      this.heartsText = this.text(
        width - PAD - 14,
        this.top + 4,
        value,
        34,
        this.host.colors.tomato,
      );
      this.heartsText.setOrigin(1, 0);
      this.panel(this.heartsText);
    }
    this.set(this.heartsText, value);
  }

  setTimer(ms: number): void {
    if (!this.timerText) {
      this.timerText = this.text(this.scene.scale.width / 2, this.top + 6, "0:00", 30);
      this.timerText.setOrigin(0.5, 0);
      this.panel(this.timerText);
    }
    this.set(this.timerText, formatClock(ms));
  }

  /** A word that pops up and floats away ("+1", "Perfect!"). */
  popup(text: string, x: number, y: number, color: string = this.host.colors.sun): void {
    const t = this.text(x, y, text, 30, color).setOrigin(0.5).setScale(0.6);
    this.scene.tweens.add({
      targets: t,
      scale: 1,
      y: y - 60,
      alpha: { from: 1, to: 0 },
      duration: 700,
      ease: "Back.Out",
      onComplete: () => t.destroy(),
    });
  }

  /**
   * "3, 2, 1, Go!" in the middle of the screen. Resolves when it's done, or early if
   * the scene shuts down, so check your own run state before acting on it.
   */
  countdown(from = 3): Promise<void> {
    const { width, height } = this.scene.scale;
    const words = [...Array.from({ length: from }, (_, i) => String(from - i)), "Go!"];
    return new Promise((resolve) => {
      // Stop (and resolve) if the scene shuts down mid-count, e.g. on Play again.
      let cancelled = false;
      this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => (cancelled = true));
      const show = (i: number) => {
        if (i >= words.length || cancelled) return resolve();
        const t = this.text(width / 2, height / 2, words[i] ?? "", 96, this.host.colors.sun)
          .setOrigin(0.5)
          .setScale(0.4);
        this.host.audio.beep(i === words.length - 1 ? 880 : 520, 80);
        this.scene.tweens.add({
          targets: t,
          scale: 1,
          alpha: { from: 1, to: 0 },
          duration: 650,
          ease: "Back.Out",
          onComplete: () => {
            t.destroy();
            show(i + 1);
          },
        });
      };
      show(0);
    });
  }
}
