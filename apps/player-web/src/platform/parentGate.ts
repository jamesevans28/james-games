/**
 * Parental gate (T10.7, Apple Kids category): a sum a young child is unlikely to
 * solve, asked before an external link, an email or any purchase inside the apps.
 * Numbers are spelled out so it can't be read off as digits by a pre-reader.
 */
const WORDS = ["", "", "", "three", "four", "five", "six", "seven", "eight", "nine"];

export type GateChallenge = { question: string; answer: number };

export function makeChallenge(random: () => number = Math.random): GateChallenge {
  const pick = () => 3 + Math.floor(random() * 7); // 3..9
  const a = pick();
  const b = pick();
  return { question: `What is ${WORDS[a]} times ${WORDS[b]}?`, answer: a * b };
}

export function isCorrect(challenge: GateChallenge, input: string): boolean {
  const n = Number(input.trim());
  return Number.isInteger(n) && n === challenge.answer;
}

// --- asking for a grown-up from anywhere (adapters included) -----------------

type Pending = { resolve: (ok: boolean) => void };
let pending: Pending | null = null;
const listeners = new Set<(open: boolean) => void>();

/**
 * Asks a grown-up to answer the sum before something leaves the app (native share,
 * external links). Resolves true when answered, false when cancelled. The modal is
 * GrownUpGateHost (mounted once in App); without it, this resolves false.
 */
export function requestGrownUp(): Promise<boolean> {
  if (listeners.size === 0) return Promise.resolve(false);
  pending?.resolve(false);
  return new Promise((resolve) => {
    pending = { resolve };
    for (const l of listeners) l(true);
  });
}

/** Called by the modal with the outcome. */
export function settleGrownUp(ok: boolean): void {
  pending?.resolve(ok);
  pending = null;
  for (const l of listeners) l(false);
}

export function onGrownUpRequest(listener: (open: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
