/**
 * Offline score queue (T10.4). A run that can't reach the server is kept on the
 * device (through the storage adapter, so Preferences in the native apps) and sent
 * later with the same play id; the server treats a resend as a no-op, so a run is
 * never counted twice.
 */
import { adapters } from "../platform/adapters";
import { isApiError } from "./apiError";

export type QueuedRun = {
  playId: string;
  gameId: string;
  score: number;
  durationMs?: number;
  /** The player's UTC offset when they played, so the streak counts the right day. */
  tzOffsetMinutes: number;
  /** The saved remix the run was played on (T11.2), sent along when the run is. */
  remixId?: string;
  queuedAt: number;
};

const KEY = "g4j:scoreQueue";
/** Keep at most this many runs, newest wins. */
export const MAX_QUEUED = 20;
/** Older runs are dropped rather than sent: a week-old score is no longer news. */
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function readQueue(): QueuedRun[] {
  const raw = adapters.storage.get(KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedRun[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(runs: QueuedRun[]): void {
  if (runs.length) adapters.storage.set(KEY, JSON.stringify(runs));
  else adapters.storage.remove(KEY);
}

export function enqueueRun(run: QueuedRun): void {
  const others = readQueue().filter((r) => r.playId !== run.playId);
  writeQueue([...others, run].slice(-MAX_QUEUED));
}

/** What to do with a run after one send attempt. */
export type SendOutcome = "sent" | "retry" | "drop";

/** Network trouble or a server hiccup → try again later; any other refusal → drop. */
export function outcomeForError(err: unknown): SendOutcome {
  if (!isApiError(err)) return "retry"; // fetch failed: offline or DNS
  if (err.status === 0 || err.status === 401 || err.status === 429 || err.status >= 500) {
    return "retry";
  }
  return "drop"; // 400/403/404/409: the server said no, resending won't change that
}

let flushing: Promise<{ sent: number; left: number }> | null = null;

/**
 * Sends queued runs oldest first. Stops at the first "retry" (still offline) so the
 * order is kept. Only one flush runs at a time.
 */
export function flushQueue(
  send: (run: QueuedRun) => Promise<SendOutcome>,
  now = Date.now(),
): Promise<{ sent: number; left: number }> {
  flushing ??= (async () => {
    let sent = 0;
    const pending = readQueue().filter((r) => now - r.queuedAt < MAX_AGE_MS);
    while (pending.length) {
      const next = pending[0]!;
      const outcome = await send(next);
      if (outcome === "retry") break;
      pending.shift();
      if (outcome === "sent") sent++;
      writeQueue(pending);
    }
    writeQueue(pending);
    return { sent, left: pending.length };
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

export function newPlayId(): string {
  return crypto.randomUUID();
}
