/**
 * The timing rule behind BasePlatformScene.endRun(), kept Phaser-free so it can be
 * tested: a run ends once; the result is reported after a short delay so the
 * end animation can play; restarting before then cancels the report.
 */
export type RunEnder = {
  /** Returns false if the run had already ended. */
  end(report: () => void): boolean;
  readonly ended: boolean;
  /** A new run: forget the old one and cancel any pending report. */
  reset(): void;
};

export function createRunEnder(
  delayMs: number,
  schedule: (ms: number, fn: () => void) => () => void,
): RunEnder {
  let ended = false;
  let cancel: (() => void) | null = null;
  return {
    get ended() {
      return ended;
    },
    end(report) {
      if (ended) return false;
      ended = true;
      cancel = schedule(Math.max(0, delayMs), () => {
        cancel = null;
        report();
      });
      return true;
    },
    reset() {
      cancel?.();
      cancel = null;
      ended = false;
    },
  };
}
