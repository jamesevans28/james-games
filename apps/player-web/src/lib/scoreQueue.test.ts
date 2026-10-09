import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ApiError } from "./apiError";
import {
  enqueueRun,
  flushQueue,
  MAX_AGE_MS,
  MAX_QUEUED,
  outcomeForError,
  readQueue,
  type QueuedRun,
} from "./scoreQueue";

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

const NOW = 1_800_000_000_000;
const run = (n: number, queuedAt = NOW): QueuedRun => ({
  playId: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  gameId: "snapadile",
  score: n,
  tzOffsetMinutes: 600,
  queuedAt,
});

test("queued runs are kept in order, without duplicates, capped", () => {
  enqueueRun(run(1));
  enqueueRun(run(2));
  enqueueRun(run(1));
  expect(readQueue().map((r) => r.score)).toEqual([2, 1]);
  for (let i = 10; i < 10 + MAX_QUEUED; i++) enqueueRun(run(i));
  expect(readQueue()).toHaveLength(MAX_QUEUED);
  expect(readQueue()[0]!.score).toBe(10);
});

test("flush sends oldest first and stops while still offline", async () => {
  enqueueRun(run(1));
  enqueueRun(run(2));
  enqueueRun(run(3));
  const seen: number[] = [];
  const result = await flushQueue(async (r) => {
    seen.push(r.score);
    return r.score === 2 ? "retry" : "sent";
  }, NOW);
  expect(seen).toEqual([1, 2]);
  expect(result).toEqual({ sent: 1, left: 2 });
  expect(readQueue().map((r) => r.score)).toEqual([2, 3]);
});

test("refused and week-old runs are dropped", async () => {
  enqueueRun(run(1, NOW - MAX_AGE_MS - 1));
  enqueueRun(run(2));
  const result = await flushQueue(async () => "drop", NOW);
  expect(result).toEqual({ sent: 0, left: 0 });
  expect(readQueue()).toEqual([]);
});

test("network trouble retries; a server refusal drops", () => {
  expect(outcomeForError(new TypeError("Failed to fetch"))).toBe("retry");
  expect(outcomeForError(new ApiError(503, "http_503"))).toBe("retry");
  expect(outcomeForError(new ApiError(401, "signin_required"))).toBe("retry");
  expect(outcomeForError(new ApiError(400, "score_too_high"))).toBe("drop");
});
