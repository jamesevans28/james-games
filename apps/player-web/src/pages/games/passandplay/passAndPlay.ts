/**
 * Pass-and-play (T11.6): two kids share one phone and take a turn each. The names
 * stay on this device (session storage) and are never sent anywhere. Pure logic
 * here; the toggle and the screens are in this folder, PlayGame wires them up.
 */
import { adapters } from "../../../platform/adapters";

export const NAME_MAX = 12;
export const DEFAULT_NAMES: readonly [string, string] = ["Player 1", "Player 2"];
const SESSION_KEY = "g4j:passAndPlay";

export type PassAndPlaySetup = { on: boolean; names: [string, string] };

/** Trims, squashes spaces, drops control characters and caps the length. Empty → fallback. */
export function cleanPlayerName(raw: string, fallback: string): string {
  const cleaned = Array.from(
    raw
      .replace(/\p{Cc}/gu, "")
      .replace(/\s+/g, " ")
      .trim(),
  )
    .slice(0, NAME_MAX)
    .join("")
    .trim();
  return cleaned || fallback;
}

/** The two names to play with: cleaned, with defaults for blanks. */
export function playerNames(names: readonly [string, string]): [string, string] {
  return [cleanPlayerName(names[0], DEFAULT_NAMES[0]), cleanPlayerName(names[1], DEFAULT_NAMES[1])];
}

export type PlayerScore = { name: string; score: number };

export type PassAndPlayOutcome = { kind: "win"; winner: 0 | 1; name: string } | { kind: "draw" };

/** Higher score wins; the same score is a draw. */
export function passAndPlayWinner(a: PlayerScore, b: PlayerScore): PassAndPlayOutcome {
  if (a.score === b.score) return { kind: "draw" };
  return a.score > b.score
    ? { kind: "win", winner: 0, name: a.name }
    : { kind: "win", winner: 1, name: b.name };
}

/** The headline on the comparison screen. */
export function outcomeLine(outcome: PassAndPlayOutcome): string {
  return outcome.kind === "draw" ? "It’s a draw!" : `${outcome.name} wins!`;
}

// ---- The two-turn flow ----

/**
 * turn: someone is playing. handoff: player 1 finished, pass the phone.
 * result: both finished, show who won.
 */
export type PassAndPlayState = {
  names: [string, string];
  turn: 0 | 1;
  scores: [number | null, number | null];
  stage: "turn" | "handoff" | "result";
};

export type PassAndPlayAction =
  | { type: "start"; setup: PassAndPlaySetup | null }
  | { type: "finish"; score: number }
  | { type: "next" }
  | { type: "again" }
  | { type: "stop" };

export function passAndPlayReducer(
  state: PassAndPlayState | null,
  action: PassAndPlayAction,
): PassAndPlayState | null {
  switch (action.type) {
    case "start":
      if (!action.setup?.on) return null;
      return {
        names: playerNames(action.setup.names),
        turn: 0,
        scores: [null, null],
        stage: "turn",
      };
    case "finish": {
      if (!state || state.stage !== "turn") return state;
      const scores: [number | null, number | null] = [...state.scores];
      scores[state.turn] = action.score;
      return { ...state, scores, stage: state.turn === 0 ? "handoff" : "result" };
    }
    case "next":
      if (!state || state.stage !== "handoff") return state;
      return { ...state, turn: 1, stage: "turn" };
    case "again":
      if (!state) return state;
      return { ...state, turn: 0, scores: [null, null], stage: "turn" };
    case "stop":
      return null;
  }
}

// ---- Session storage (this tab only; cleared when the app closes) ----

export function readPassAndPlay(): PassAndPlaySetup {
  const raw = adapters.session.get(SESSION_KEY);
  if (!raw) return { on: false, names: ["", ""] };
  try {
    const parsed = JSON.parse(raw) as Partial<PassAndPlaySetup>;
    const names = Array.isArray(parsed.names) ? parsed.names : [];
    const name = (i: number) => (typeof names[i] === "string" ? names[i].slice(0, NAME_MAX) : "");
    return { on: parsed.on === true, names: [name(0), name(1)] };
  } catch {
    return { on: false, names: ["", ""] };
  }
}

export function writePassAndPlay(setup: PassAndPlaySetup): void {
  adapters.session.set(SESSION_KEY, JSON.stringify(setup));
}
