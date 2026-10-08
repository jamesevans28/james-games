import { test, expect, vi, beforeEach } from "vitest";

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

test("mute is remembered and announced", async () => {
  const { isMuted, setMuted, onMutedChange } = await import("./mute");
  const seen: boolean[] = [];
  const off = onMutedChange((m) => seen.push(m));
  expect(isMuted()).toBe(false);
  setMuted(true);
  expect(isMuted()).toBe(true);
  expect(localStorage.getItem("g4j:muted")).toBe("1");
  off();
  setMuted(false);
  expect(seen).toEqual([true]);
});

test("a fresh load reads the saved setting", async () => {
  localStorage.setItem("g4j:muted", "1");
  const { isMuted } = await import("./mute");
  expect(isMuted()).toBe(true);
});

test("before any tap there is no AudioContext and sounds are silently skipped", async () => {
  const { getAudioContext } = await import("./context");
  const { createAudioKit } = await import("./index");
  const kit = createAudioKit("test-game", ["boing"]);
  expect(() => {
    kit.play("boing");
    kit.play("unknown");
    kit.ding();
  }).not.toThrow();
  expect(getAudioContext()).toBeNull();
});
