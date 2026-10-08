import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  countVisit,
  DISMISS_FOR_MS,
  dismissOverlay,
  isStillDismissed,
  pickOverlay,
  readDismissedAt,
} from "./overlays";

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
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
}

beforeEach(() => {
  vi.stubGlobal("localStorage", new MemoryStorage());
  vi.stubGlobal("sessionStorage", new MemoryStorage());
});
afterEach(() => vi.unstubAllGlobals());

test("the update prompt beats install hints; nothing wanting means nothing shown", () => {
  expect(pickOverlay([])).toBeNull();
  expect(pickOverlay(["install", "update"])).toBe("update");
  expect(pickOverlay(["ios-install", "install"])).toBe("ios-install");
});

test("dismissals last 14 days", () => {
  const now = 1_000_000_000_000;
  dismissOverlay("install", now);
  expect(readDismissedAt("install")).toBe(now);
  expect(isStillDismissed(now, now + DISMISS_FOR_MS - 1)).toBe(true);
  expect(isStillDismissed(now, now + DISMISS_FOR_MS)).toBe(false);
  expect(isStillDismissed(null, now)).toBe(false);
});

test("a visit is counted once per browser session", () => {
  expect(countVisit()).toBe(1);
  expect(countVisit()).toBe(1);
  sessionStorage.clear();
  expect(countVisit()).toBe(2);
});
