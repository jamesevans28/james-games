import Phaser from "phaser";
import {
  classifySwipe,
  isTap,
  sideOf,
  zoneIndex,
  type Direction4,
  type SwipeOptions,
} from "./gestures";

/** Every input helper returns this; helpers also tear themselves down on scene shutdown. */
export type InputHandle = { destroy: () => void };

function autoDestroy(scene: Phaser.Scene, destroy: () => void): InputHandle {
  let done = false;
  const once = () => {
    if (done) return;
    done = true;
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, once);
    destroy();
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, once);
  return { destroy: once };
}

/**
 * Hold the left or right half of the screen to move; a quick tap can nudge.
 * Arrow keys and A/D mirror it on desktop. (Paddle Pop, Cosmic Clash, Car Crash.)
 */
export function holdZones(
  scene: Phaser.Scene,
  opts: {
    onChange: (direction: -1 | 0 | 1) => void;
    onTap?: (direction: -1 | 1) => void;
    tapMs?: number;
    keyboard?: boolean;
  },
): InputHandle & { direction(): -1 | 0 | 1 } {
  let pointerDir: -1 | 0 | 1 = 0;
  let keyDir: -1 | 0 | 1 = 0;
  let pressedAt = 0;
  let current: -1 | 0 | 1 = 0;
  const width = () => scene.scale.width;
  const update = () => {
    const next = keyDir || pointerDir;
    if (next !== current) {
      current = next;
      opts.onChange(next);
    }
  };
  const down = (p: Phaser.Input.Pointer) => {
    pointerDir = sideOf(p.x, width());
    pressedAt = scene.time.now;
    update();
  };
  const up = (p: Phaser.Input.Pointer) => {
    if (pointerDir !== 0 && opts.onTap && isTap(scene.time.now - pressedAt, opts.tapMs)) {
      opts.onTap(sideOf(p.x, width()));
    }
    pointerDir = 0;
    update();
  };
  scene.input.on("pointerdown", down);
  scene.input.on("pointerup", up);
  scene.input.on("pointerupoutside", up);

  const kb = opts.keyboard === false ? null : scene.input.keyboard;
  const keyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "a") keyDir = -1;
    else if (e.key === "ArrowRight" || e.key === "d") keyDir = 1;
    else return;
    update();
  };
  const keyUp = (e: KeyboardEvent) => {
    if (
      (keyDir === -1 && (e.key === "ArrowLeft" || e.key === "a")) ||
      (keyDir === 1 && (e.key === "ArrowRight" || e.key === "d"))
    ) {
      keyDir = 0;
      update();
    }
  };
  kb?.on("keydown", keyDown);
  kb?.on("keyup", keyUp);

  const handle = autoDestroy(scene, () => {
    scene.input.off("pointerdown", down);
    scene.input.off("pointerup", up);
    scene.input.off("pointerupoutside", up);
    kb?.off("keydown", keyDown);
    kb?.off("keyup", keyUp);
  });
  return { ...handle, direction: () => current };
}

/** Tap one of `count` vertical strips (0 = leftmost). */
export function tapZones(
  scene: Phaser.Scene,
  opts: { count: number; onTap: (zone: number, pointer: Phaser.Input.Pointer) => void },
): InputHandle {
  const down = (p: Phaser.Input.Pointer) =>
    opts.onTap(zoneIndex(p.x, scene.scale.width, opts.count), p);
  scene.input.on("pointerdown", down);
  return autoDestroy(scene, () => scene.input.off("pointerdown", down));
}

/** Swipe anywhere; arrow keys and WASD mirror it on desktop. */
export function swipe(
  scene: Phaser.Scene,
  opts: SwipeOptions & { onSwipe: (direction: Direction4) => void; keyboard?: boolean },
): InputHandle {
  let start: { x: number; y: number; t: number } | null = null;
  const down = (p: Phaser.Input.Pointer) => {
    start = { x: p.x, y: p.y, t: scene.time.now };
  };
  const up = (p: Phaser.Input.Pointer) => {
    if (!start) return;
    const dir = classifySwipe(p.x - start.x, p.y - start.y, scene.time.now - start.t, opts);
    start = null;
    if (dir) opts.onSwipe(dir);
  };
  scene.input.on("pointerdown", down);
  scene.input.on("pointerup", up);
  const offKeys =
    opts.keyboard === false
      ? () => {}
      : keys(scene, {
          ArrowUp: () => opts.onSwipe("up"),
          w: () => opts.onSwipe("up"),
          ArrowDown: () => opts.onSwipe("down"),
          s: () => opts.onSwipe("down"),
          ArrowLeft: () => opts.onSwipe("left"),
          a: () => opts.onSwipe("left"),
          ArrowRight: () => opts.onSwipe("right"),
          d: () => opts.onSwipe("right"),
        }).destroy;
  return autoDestroy(scene, () => {
    scene.input.off("pointerdown", down);
    scene.input.off("pointerup", up);
    offKeys();
  });
}

/** Map key names (KeyboardEvent.key) to actions, for desktop play. */
export function keys(scene: Phaser.Scene, map: Record<string, () => void>): InputHandle {
  const kb = scene.input.keyboard;
  const onKey = (e: KeyboardEvent) => map[e.key]?.();
  kb?.on("keydown", onKey);
  return autoDestroy(scene, () => kb?.off("keydown", onKey));
}
