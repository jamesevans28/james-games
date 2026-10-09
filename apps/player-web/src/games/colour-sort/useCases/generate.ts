import { CAPACITY, isSolved, isTubeDone, pourCount, topRun, type Board } from "./tubes";

/** Ball colours available: the five crayons plus paper. Each has its own shape too. */
export const MAX_COLOURS = 6;

export type LevelOptions = {
  /** Remix knob: the most colours a level can have (2–6). */
  maxColours?: number;
  /** Remix knob: empty tubes on top of one tube per colour (1–3). */
  spare?: number;
};

export type LevelConfig = { colours: number; tubes: number; scramble: number };

/**
 * How big level `level` (1-based) is. One more colour every three levels: 2 colours for
 * levels 1–3, 3 for 4–6 … 6 from level 13. The board always has one tube per colour
 * plus `spare` empty ones, and gets a few more mixing moves within each colour band.
 */
export function levelConfig(level: number, opts: LevelOptions = {}): LevelConfig {
  const cap = clamp(Math.round(opts.maxColours ?? MAX_COLOURS), 2, MAX_COLOURS);
  const spare = clamp(Math.round(opts.spare ?? 2), 1, 3);
  const lvl = Math.max(1, Math.floor(level));
  const colours = Math.min(cap, 2 + Math.floor((lvl - 1) / 3));
  const scramble = colours * 4 + ((lvl - 1) % 3) * 2;
  return { colours, tubes: colours + spare, scramble };
}

export type Level = {
  board: Board;
  /** The moves the generator used to mix it: the level can always be solved in this many. */
  par: number;
};

/** A solved board: one full tube per colour, then the empty ones. */
export function solvedBoard(colours: number, tubes: number): Board {
  return Array.from({ length: tubes }, (_, i) =>
    i < colours ? Array.from({ length: CAPACITY }, () => i) : [],
  );
}

type Reverse = { from: number; to: number; count: number };

/**
 * Every "un-pour" from `board`: taking `count` balls off the top of tube `from` and
 * putting them on tube `to`, such that pouring `to` back into `from` is a legal move
 * that moves exactly those balls. Doing these from a solved board only ever reaches
 * boards that can be solved again.
 */
export function reverseMoves(board: Board): Reverse[] {
  const out: Reverse[] = [];
  board.forEach((src, from) => {
    const run = topRun(src);
    board.forEach((dst, to) => {
      if (from === to) return;
      for (let count = 1; count <= run && dst.length + count <= CAPACITY; count++) {
        const next = applyReverse(board, { from, to, count });
        if (pourCount(next, to, from) === count) out.push({ from, to, count });
      }
    });
  });
  return out;
}

export function applyReverse(board: Board, m: Reverse): Board {
  const moved = (board[m.from] ?? []).slice(-m.count);
  return board.map((tube, i) => {
    if (i === m.from) return tube.slice(0, tube.length - m.count);
    if (i === m.to) return [...tube, ...moved];
    return tube;
  });
}

/**
 * A level that is always solvable: start from the solved board and make `scramble`
 * random un-pours (never straight back the way we came), then shuffle the tube order.
 * Boards that still have a finished tube are retried a few times (the least-finished
 * attempt wins), so every level starts properly mixed.
 */
export function generateLevel(cfg: LevelConfig, rng: () => number): Level {
  let best: Level | null = null;
  let bestDone = Infinity;
  for (let attempt = 0; attempt < 12; attempt++) {
    let board = solvedBoard(cfg.colours, cfg.tubes);
    let last: Reverse | null = null;
    let par = 0;
    for (let i = 0; i < cfg.scramble; i++) {
      const options = reverseMoves(board).filter(
        (m) => !last || !(m.from === last.to && m.to === last.from),
      );
      const pick = options[Math.floor(rng() * options.length)];
      if (!pick) break;
      board = applyReverse(board, pick);
      last = pick;
      par++;
    }
    board = shuffle(board, rng);
    const done = board.filter((t) => isTubeDone(t)).length;
    if (!isSolved(board) && done < bestDone) {
      best = { board, par };
      bestDone = done;
      if (done === 0) break;
    }
  }
  // Unreachable in practice (a scramble of ≥ 8 un-pours always mixes something).
  return best ?? { board: solvedBoard(cfg.colours, cfg.tubes), par: 0 };
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
