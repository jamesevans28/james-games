import Phaser from "phaser";

export type DPadDirection = "up" | "down" | "left" | "right";

export type DPadMode = "hold" | "sticky";

export type CreateDPadOptions = {
  centerX: number;
  bottomPadding: number;
  buttonSize: number;
  spacing: number;
  alpha: number;
  onDirectionChange: (direction: DPadDirection | null) => void;
  enabled?: () => boolean;
  // Optional keyboard support (defaults to true)
  keyboard?: boolean;
  // Input behavior: 'hold' = press/hold to move; 'sticky' = tap to keep moving.
  mode?: DPadMode;
};

export type DPadInstance = {
  destroy: () => void;
  setVisible: (visible: boolean) => void;
};

export function createDPad(scene: Phaser.Scene, options: CreateDPadOptions): DPadInstance {
  const {
    centerX,
    bottomPadding,
    buttonSize,
    spacing,
    alpha,
    onDirectionChange,
    enabled,
    keyboard = true,
    mode = "hold",
  } = options;

  const canUse = () => (enabled ? enabled() : true);

  const screenHeight = scene.scale.height;
  // Ensure the DOWN button bottom edge stays above the screen bottom.
  const centerY = screenHeight - bottomPadding - buttonSize / 2 - spacing;

  let activeDirection: DPadDirection | null = null;

  const emit = (dir: DPadDirection | null) => {
    activeDirection = dir;
    onDirectionChange(dir);
  };

  const setDirectionFromTap = (dir: DPadDirection) => {
    if (!canUse()) return;
    if (mode === "sticky") {
      // Sticky mode is "tap to set". Stopping is handled by the game (e.g. at junctions/walls).
      // Re-tapping the same direction should re-assert it, not toggle off.
      emit(dir);
    } else {
      emit(dir);
    }
  };

  const releaseIfHold = () => {
    if (mode === "hold") emit(null);
  };

  const makeButton = (x: number, y: number, label: string, dir: DPadDirection) => {
    const rect = scene.add
      .rectangle(x, y, buttonSize, buttonSize, 0x333333, alpha)
      .setStrokeStyle(2, 0xffffff)
      .setInteractive({ useHandCursor: true });

    const text = scene.add
      .text(x, y, label, {
        fontSize: "32px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    rect
      .on("pointerdown", () => {
        setDirectionFromTap(dir);
      })
      .on("pointerup", () => {
        releaseIfHold();
      })
      .on("pointerout", () => {
        releaseIfHold();
      })
      .on("pointerupoutside", () => {
        releaseIfHold();
      });

    return { rect, text };
  };

  const up = makeButton(centerX, centerY - spacing, "▲", "up");
  const down = makeButton(centerX, centerY + spacing, "▼", "down");
  const left = makeButton(centerX - spacing, centerY, "◀", "left");
  const right = makeButton(centerX + spacing, centerY, "▶", "right");

  // Keyboard support (arrow keys)
  let cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
  let keyDownHandler: ((event: KeyboardEvent) => void) | undefined;
  let keyUpHandler: ((event: KeyboardEvent) => void) | undefined;

  if (keyboard && scene.input.keyboard) {
    cursors = scene.input.keyboard.createCursorKeys();

    keyDownHandler = () => {
      if (!canUse()) return;
      // Prefer a deterministic order if multiple keys held
      if (cursors?.up?.isDown) return emit("up");
      if (cursors?.down?.isDown) return emit("down");
      if (cursors?.left?.isDown) return emit("left");
      if (cursors?.right?.isDown) return emit("right");
    };

    keyUpHandler = () => {
      // If any arrow is still down, keep emitting that.
      if (cursors?.up?.isDown) return emit("up");
      if (cursors?.down?.isDown) return emit("down");
      if (cursors?.left?.isDown) return emit("left");
      if (cursors?.right?.isDown) return emit("right");

      // In sticky mode, key up does not stop movement.
      if (mode === "hold") emit(null);
    };

    scene.input.keyboard.on("keydown", keyDownHandler);
    scene.input.keyboard.on("keyup", keyUpHandler);
  }

  const setVisible = (visible: boolean) => {
    up.rect.setVisible(visible);
    up.text.setVisible(visible);
    down.rect.setVisible(visible);
    down.text.setVisible(visible);
    left.rect.setVisible(visible);
    left.text.setVisible(visible);
    right.rect.setVisible(visible);
    right.text.setVisible(visible);
  };

  const destroy = () => {
    up.rect.destroy();
    up.text.destroy();
    down.rect.destroy();
    down.text.destroy();
    left.rect.destroy();
    left.text.destroy();
    right.rect.destroy();
    right.text.destroy();

    if (keyboard && scene.input.keyboard && keyDownHandler && keyUpHandler) {
      scene.input.keyboard.off("keydown", keyDownHandler);
      scene.input.keyboard.off("keyup", keyUpHandler);
    }
  };

  return { destroy, setVisible };
}
