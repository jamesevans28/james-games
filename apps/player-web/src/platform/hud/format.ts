/** "1:05" for 65 000 ms; never negative; rounds up so 0:01 shows until time is really up. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** 12345 → "12,345" (fixed locale so tests and screenshots are stable). */
export function formatScore(n: number): string {
  return Math.max(0, Math.floor(n)).toLocaleString("en-AU");
}

/** Phaser wants colours as numbers: "#FF5A4E" → 0xff5a4e. */
export function hexToNumber(hex: string): number {
  return Number.parseInt(hex.replace("#", ""), 16);
}
