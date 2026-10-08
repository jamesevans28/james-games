import { test, beforeEach, afterEach, vi } from "vitest";
import assert from "node:assert/strict";
import { readMigrated, STORAGE_KEYS } from "./storageKeys.ts";

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

test("moves a legacy value to the new key and removes the old one", () => {
  localStorage.setItem("flingo_last_played_games", '["snapadile"]');
  assert.equal(readMigrated("lastPlayed"), '["snapadile"]');
  assert.equal(localStorage.getItem(STORAGE_KEYS.lastPlayed), '["snapadile"]');
  assert.equal(localStorage.getItem("flingo_last_played_games"), null);
});

test("a value already under the new key wins over a legacy one", () => {
  localStorage.setItem(STORAGE_KEYS.lastPlayed, '["hoop-city"]');
  localStorage.setItem("flingo_last_played_games", '["snapadile"]');
  assert.equal(readMigrated("lastPlayed"), '["hoop-city"]');
  assert.equal(localStorage.getItem("flingo_last_played_games"), null);
});

test("nothing stored is null", () => assert.equal(readMigrated("catalog"), null));

test("never throws when storage is unavailable", () => {
  vi.stubGlobal("localStorage", undefined);
  assert.equal(readMigrated("lastPlayed"), null);
});
