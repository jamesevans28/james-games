import Phaser from "phaser";

export type OnScreenKeyboardKey = string; // e.g. "A" | "B" | ... | "SPACE" | "BACKSPACE"

export type CreateOnScreenKeyboardOptions = {
  centerX: number;
  topY: number;
  enabled?: () => boolean;
  onKey: (key: OnScreenKeyboardKey) => void;
  getKeyFill?: (key: string) => number;
  showSpace?: boolean;
  showBackspace?: boolean;
};

export type OnScreenKeyboardInstance = {
  container: Phaser.GameObjects.Container;
  letterKeys: Map<string, Phaser.GameObjects.Container>;
  destroy: () => void;
  setVisible: (visible: boolean) => void;
  refresh: () => void;
};

const DEFAULT_FILL = 0x818384;
const HOVER_FILL = 0x565758;
const STROKE = 0x565758;

export function createOnScreenKeyboard(
  scene: Phaser.Scene,
  options: CreateOnScreenKeyboardOptions
): OnScreenKeyboardInstance {
  const {
    centerX,
    topY,
    enabled,
    onKey,
    getKeyFill,
    showSpace = true,
    showBackspace = true,
  } = options;

  const canUse = () => (enabled ? enabled() : true);

  const container = scene.add.container(centerX, topY);
  const letterKeys: Map<string, Phaser.GameObjects.Container> = new Map();

  const sidePadding = 8;
  const availableWidth = scene.scale.width - sidePadding * 2;
  const keySpacing = 4;
  const keyHeight = 56;

  const rows: string[][] = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["Z", "X", "C", "V", "B", "N", "M"],
  ];

  const specialRow: string[] = [];
  if (showSpace) specialRow.push("SPACE");
  if (showBackspace) specialRow.push("BACKSPACE");
  if (specialRow.length > 0) rows.push(specialRow);

  const maxRowKeys = Math.max(
    ...rows.map((r) => r.filter((k) => k.length === 1).length).concat([10])
  );

  const totalSpacing = (maxRowKeys - 1) * keySpacing;
  const keyWidth = (availableWidth - totalSpacing) / maxRowKeys;

  const computeFill = (key: string) => {
    if (key.length !== 1) return DEFAULT_FILL;
    return getKeyFill ? getKeyFill(key) : DEFAULT_FILL;
  };

  const setKeyBgFill = (keyContainer: Phaser.GameObjects.Container, fill: number) => {
    const bg = keyContainer.getAt(0) as Phaser.GameObjects.Rectangle;
    bg.setFillStyle(fill);
  };

  rows.forEach((row, rowIndex) => {
    let rowWidth = 0;
    row.forEach((key) => {
      if (key === "BACKSPACE") {
        rowWidth += keyWidth * 2 + keySpacing;
      } else if (key === "SPACE") {
        rowWidth += keyWidth * 5 + keySpacing;
      } else {
        rowWidth += keyWidth + keySpacing;
      }
    });
    rowWidth -= keySpacing;

    let startX = -rowWidth / 2;
    const rowY = rowIndex * (keyHeight + keySpacing);

    row.forEach((key) => {
      let width = keyWidth;
      if (key === "BACKSPACE") width = keyWidth * 2;
      if (key === "SPACE") width = keyWidth * 5;

      const keyContainer = scene.add.container(startX + width / 2, rowY);
      const bg = scene.add.rectangle(0, 0, width, keyHeight, computeFill(key));
      bg.setStrokeStyle(1, STROKE);

      let label = key;
      let fontSize = "20px";
      if (key === "BACKSPACE") {
        label = "⌫";
        fontSize = "26px";
      } else if (key === "SPACE") {
        label = "";
        fontSize = "16px";
      }

      const keyText = scene.add
        .text(0, 0, label, {
          fontFamily: "Arial, sans-serif",
          fontSize,
          fontStyle: "bold",
          color: "#ffffff",
        })
        .setOrigin(0.5);

      keyContainer.add([bg, keyText]);
      keyContainer.setSize(width, keyHeight);
      keyContainer.setInteractive({ useHandCursor: true });

      if (key.length === 1) letterKeys.set(key, keyContainer);

      keyContainer.on("pointerdown", () => {
        if (!canUse()) return;
        onKey(key);
      });

      keyContainer.on("pointerover", () => {
        setKeyBgFill(keyContainer, HOVER_FILL);
      });

      keyContainer.on("pointerout", () => {
        setKeyBgFill(keyContainer, computeFill(key));
      });

      container.add(keyContainer);
      startX += width + keySpacing;
    });
  });

  const refresh = () => {
    letterKeys.forEach((keyContainer, letter) => {
      setKeyBgFill(keyContainer, computeFill(letter));
    });
  };

  const setVisible = (visible: boolean) => {
    container.setVisible(visible);
  };

  const destroy = () => {
    container.destroy(true);
    letterKeys.clear();
  };

  return {
    container,
    letterKeys,
    destroy,
    setVisible,
    refresh,
  };
}
