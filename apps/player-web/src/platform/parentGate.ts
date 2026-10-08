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
