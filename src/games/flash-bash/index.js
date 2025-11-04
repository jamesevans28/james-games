import Phaser from "phaser";
import FlashBashGame from "./FlashBashGame";

const config = {
  type: Phaser.AUTO,
  // Use RESIZE so the canvas always matches the container size and we can
  // make the container fill the viewport for a true full-screen experience.
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  backgroundColor: "#000000",
  scene: FlashBashGame,
};

export function mount(container) {
  // Keep previous inline styles so we can restore them on destroy
  const prev = {
    position: container.style.position || "",
    left: container.style.left || "",
    top: container.style.top || "",
    width: container.style.width || "",
    height: container.style.height || "",
    zIndex: container.style.zIndex || "",
  };

  // Make the mount container cover the full viewport so Phaser RESIZE maps to the screen
  container.style.position = "fixed";
  container.style.left = "0";
  container.style.top = "0";
  container.style.width = "100vw";
  container.style.height = "100vh";
  container.style.zIndex = "9999";

  const game = new Phaser.Game({ ...config, parent: container });
  return {
    destroy: () => {
      try {
        game.destroy(true);
      } finally {
        // restore container styles
        container.style.position = prev.position;
        container.style.left = prev.left;
        container.style.top = prev.top;
        container.style.width = prev.width;
        container.style.height = prev.height;
        container.style.zIndex = prev.zIndex;
      }
    },
  };
}
