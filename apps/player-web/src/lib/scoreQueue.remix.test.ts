import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { enqueueRun, flushQueue, type QueuedRun } from "./scoreQueue";

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
}

beforeEach(() => vi.stubGlobal("localStorage", new MemoryStorage()));
afterEach(() => vi.unstubAllGlobals());

test("a queued remix run is sent later with its remix id (T11.2)", async () => {
  const now = 1_800_000_000_000;
  enqueueRun({
    playId: "p-remix",
    gameId: "snapadile",
    score: 30,
    tzOffsetMinutes: 600,
    remixId: "6f1d2c3b-4a5e-4f60-9a7b-8c9d0e1f2a3b",
    queuedAt: now,
  });
  const sent: QueuedRun[] = [];
  await flushQueue(async (r) => {
    sent.push(r);
    return "sent";
  }, now);
  expect(sent).toHaveLength(1);
  expect(sent[0]?.remixId).toBe("6f1d2c3b-4a5e-4f60-9a7b-8c9d0e1f2a3b");
});
