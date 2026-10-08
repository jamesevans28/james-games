import { test, beforeEach, afterEach, vi } from "vitest";
import assert from "node:assert/strict";
import { readStored, STORAGE_KEYS } from "./storageKeys.ts";

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

test("reads the g4j: key", () => {
  localStorage.setItem(STORAGE_KEYS.lastPlayed, '["hoop-city"]');
  assert.equal(readStored("lastPlayed"), '["hoop-city"]');
});

test("nothing stored is null", () => assert.equal(readStored("catalog"), null));

test("never throws when storage is unavailable", () => {
  vi.stubGlobal("localStorage", undefined);
  assert.equal(readStored("lastPlayed"), null);
});
