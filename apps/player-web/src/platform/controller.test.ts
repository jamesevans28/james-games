import { test, expect, vi } from "vitest";
import { controlGame, type GameLike } from "./controller";
import type { PlatformHost } from "./host";

function setup() {
  const scenes = [makeScene()];
  const game: GameLike & { destroyed: boolean } = {
    destroyed: false,
    scene: {
      getScenes: (activeOnly = true) => scenes.filter((s) => !activeOnly || s.scene.isActive()),
    },
    sound: { mute: false, pauseAll: vi.fn(), resumeAll: vi.fn() },
    destroy(this: { destroyed: boolean }) {
      this.destroyed = true;
    },
  };
  let paused = false;
  const host = {
    beginRun: vi.fn(),
    setPaused: (p: boolean) => (paused = p),
    isPaused: () => paused,
  } as unknown as PlatformHost;
  let booted: GameLike | null = null;
  const boots = vi.fn(() => (booted = game));
  const instance = controlGame(() => booted, host, boots);
  return { instance, game, host, scenes, boots };
}

function makeScene() {
  const state = { active: true, paused: false, restarts: 0 };
  return {
    state,
    scene: {
      isActive: () => state.active && !state.paused,
      isPaused: () => state.paused,
      pause: () => (state.paused = true),
      resume: () => (state.paused = false),
      restart: () => {
        state.restarts++;
        state.paused = false;
      },
    },
  };
}

test("start boots one game and begins a run", () => {
  const { instance, boots, host } = setup();
  instance.start();
  instance.start();
  expect(boots).toHaveBeenCalledTimes(1);
  expect(host.beginRun).toHaveBeenCalledTimes(2);
});

test("restart reuses the same game (no new WebGL context)", () => {
  const { instance, boots, scenes, game } = setup();
  instance.start();
  instance.restart();
  instance.restart();
  expect(boots).toHaveBeenCalledTimes(1);
  expect(scenes[0]?.state.restarts).toBe(2);
  expect(game.destroyed).toBe(false);
});

test("pause and resume flip scenes, sound and the host clock", () => {
  const { instance, scenes, game, host } = setup();
  instance.start();
  instance.pause();
  expect(scenes[0]?.state.paused).toBe(true);
  expect(host.isPaused()).toBe(true);
  expect(game.sound.pauseAll).toHaveBeenCalled();
  instance.resume();
  expect(scenes[0]?.state.paused).toBe(false);
  expect(host.isPaused()).toBe(false);
});

test("restart while paused unpauses", () => {
  const { instance, scenes, host } = setup();
  instance.start();
  instance.pause();
  instance.restart();
  expect(scenes[0]?.state.paused).toBe(false);
  expect(host.isPaused()).toBe(false);
});

test("destroy tears down once and later calls are no-ops", () => {
  const { instance, game, boots } = setup();
  instance.start();
  instance.destroy();
  expect(game.destroyed).toBe(true);
  instance.restart();
  instance.start();
  expect(boots).toHaveBeenCalledTimes(1);
});

test("setMuted mutes the game's sound", () => {
  const { instance, game } = setup();
  instance.start();
  instance.setMuted(true);
  expect(game.sound.mute).toBe(true);
});
