import type Phaser from "phaser";
import type { GameHost } from "../../../platform/sdk";
import { hexToNumber } from "../../../platform/hud/format";

export type Button = {
  container: Phaser.GameObjects.Container;
  setEnabled(enabled: boolean): void;
};

export type ButtonOptions = {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  /** CSS hex fill; the label is white with an ink outline unless `fill` is paper. */
  fill: string;
  fontSize?: number;
  onTap: () => void;
};

/** A sticker-style button: coloured panel, ink outline and hard shadow. */
export function button(scene: Phaser.Scene, host: GameHost, opts: ButtonOptions): Button {
  const ink = hexToNumber(host.colors.ink);
  const onPaper = opts.fill === host.colors.paper;
  const c = scene.add.container(opts.x, opts.y);
  const shadow = scene.add.rectangle(0, 4, opts.w, opts.h, ink);
  const bg = scene.add.rectangle(0, 0, opts.w, opts.h, hexToNumber(opts.fill));
  bg.setStrokeStyle(4, ink);
  const text = scene.add
    .text(0, 0, opts.label, {
      fontFamily: host.fonts.display,
      fontSize: `${opts.fontSize ?? 22}px`,
      fontStyle: "800",
      color: onPaper ? host.colors.ink : "#FFFFFF",
      stroke: host.colors.ink,
      strokeThickness: onPaper ? 0 : 5,
      align: "center",
    })
    .setOrigin(0.5);
  c.add([shadow, bg, text]);
  c.setSize(opts.w, opts.h);
  c.setInteractive({ useHandCursor: true });

  let enabled = true;
  c.on("pointerdown", () => {
    if (enabled) opts.onTap();
  });
  return {
    container: c,
    setEnabled(next: boolean) {
      if (next === enabled) return;
      enabled = next;
      c.setAlpha(next ? 1 : 0.4);
    },
  };
}

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  /** CSS hex colour for the box outline and the confirm button. */
  accent: string;
  onConfirm: () => void;
  onCancel?: () => void;
};

const MODAL_DEPTH = 900; // under the HUD (1000), so the clock stays visible

/**
 * The game's one confirm dialog (Give up? Buy a letter?). A dim layer swallows taps
 * on the board and keyboard underneath. Returns `close()`, which is safe to call twice.
 */
export function confirmModal(
  scene: Phaser.Scene,
  host: GameHost,
  opts: ConfirmOptions,
): () => void {
  const { width, height } = scene.scale;
  const ink = hexToNumber(host.colors.ink);
  const cx = width / 2;
  const cy = height / 2;
  const boxW = 420;
  const boxH = 290;

  const dim = scene.add.rectangle(cx, cy, width, height, ink, 0.55).setInteractive();
  const shadow = scene.add.rectangle(cx, cy + 6, boxW, boxH, ink);
  const box = scene.add.rectangle(cx, cy, boxW, boxH, hexToNumber(host.colors.paper));
  box.setStrokeStyle(6, hexToNumber(opts.accent));
  const title = scene.add
    .text(cx, cy - 92, opts.title, {
      fontFamily: host.fonts.display,
      fontSize: "36px",
      fontStyle: "800",
      color: host.colors.ink,
    })
    .setOrigin(0.5);
  const message = scene.add
    .text(cx, cy - 22, opts.message, {
      fontFamily: host.fonts.body,
      fontSize: "20px",
      color: host.colors.ink,
      align: "center",
      wordWrap: { width: boxW - 50 },
    })
    .setOrigin(0.5);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    [dim, shadow, box, title, message, yes.container, no.container].forEach((o) => o.destroy());
  };
  const yes = button(scene, host, {
    x: cx - 95,
    y: cy + 80,
    w: 170,
    h: 60,
    label: opts.confirmLabel,
    fill: opts.accent,
    onTap: () => {
      close();
      opts.onConfirm();
    },
  });
  const no = button(scene, host, {
    x: cx + 95,
    y: cy + 80,
    w: 170,
    h: 60,
    label: opts.cancelLabel,
    fill: host.colors.paper,
    onTap: () => {
      close();
      opts.onCancel?.();
    },
  });

  [dim, shadow, box, title, message, yes.container, no.container].forEach((o, i) =>
    o.setDepth(MODAL_DEPTH + i),
  );
  return close;
}
