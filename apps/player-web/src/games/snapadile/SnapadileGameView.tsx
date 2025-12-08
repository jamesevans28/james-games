import { forwardRef, useLayoutEffect, useRef } from "react";
import StartSnapadileGame from "./main";

export interface SnapadileRef {
  game: Phaser.Game | null;
  scene: Phaser.Scene | null;
}

interface Props {
  containerId?: string;
}

const SnapadileGameView = forwardRef<SnapadileRef, Props>(function SnapadileGameView(
  { containerId = "snapadile-container" },
  ref
) {
  const game = useRef<Phaser.Game | null>(null);

  useLayoutEffect(() => {
    if (game.current === null) {
      game.current = StartSnapadileGame(containerId);
      if (typeof ref === "function") {
        ref({ game: game.current, scene: null });
      } else if (ref) {
        ref.current = { game: game.current, scene: null };
      }
    }

    return () => {
      if (game.current) {
        game.current.destroy(true);
        game.current = null;
      }
    };
  }, [containerId, ref]);

  return <div id={containerId} style={{ width: "100%", height: "100%", touchAction: "none" }} />;
});

export default SnapadileGameView;
