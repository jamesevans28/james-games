import { test, beforeEach, afterEach, vi } from "vitest";
import assert from "node:assert/strict";
import { getBest, setBest } from "./bestScore.ts";

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
  key() {
    return null;
  }
  get length() {
    return this.m.size;
  }
}
beforeEach(() => {
  vi.stubGlobal("localStorage", new MemoryStorage());
});
afterEach(() => {
  vi.unstubAllGlobals();
});

test("no score yet is 0", () => assert.equal(getBest("snapadile"), 0));

test("setBest only ever raises the best", () => {
  assert.equal(setBest("snapadile", 40), 40);
  assert.equal(setBest("snapadile", 12), 40);
  assert.equal(getBest("snapadile"), 40);
});

test("migrates the highest legacy key into the new key", () => {
  localStorage.setItem("hoop-city-best", "90");
  localStorage.setItem("hoop-city-best-score", "120");
  localStorage.setItem("best_score_hoop-city", "15");
  assert.equal(getBest("hoop-city"), 120);
  assert.equal(localStorage.getItem("g4j:best:hoop-city"), "120");
});

test("ignores junk values", () => {
  localStorage.setItem("g4j:best:blocker", "NaN");
  localStorage.setItem("blocker-best", "-5");
  assert.equal(getBest("blocker"), 0);
});

test("never throws when storage is unavailable", () => {
  vi.stubGlobal("localStorage", undefined);
  assert.equal(getBest("serpento"), 0);
  assert.equal(setBest("serpento", 7), 7);
});
