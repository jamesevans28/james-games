/**
 * Avatar set. Placeholder SVG animal faces until Phase 8 delivers the AI set.
 *
 * Profiles store a 1-based number. Numbers from the old 89-tile sprite sheets
 * wrap onto this set, so every existing profile still shows a face.
 */
export type AvatarDef = { id: number; name: string; src: string; background: string };

const BASE = "/brand/avatars";

export const AVATARS: readonly AvatarDef[] = [
  { id: 1, name: "Cat", src: `${BASE}/cat.svg`, background: "#FFF1C7" },
  { id: 2, name: "Dog", src: `${BASE}/dog.svg`, background: "#DDEFFF" },
  { id: 3, name: "Frog", src: `${BASE}/frog.svg`, background: "#FFE1DE" },
  { id: 4, name: "Bear", src: `${BASE}/bear.svg`, background: "#DDF5E5" },
  { id: 5, name: "Fox", src: `${BASE}/fox.svg`, background: "#EEE7FF" },
  { id: 6, name: "Panda", src: `${BASE}/panda.svg`, background: "#DDF5E5" },
  { id: 7, name: "Rabbit", src: `${BASE}/rabbit.svg`, background: "#DDEFFF" },
  { id: 8, name: "Owl", src: `${BASE}/owl.svg`, background: "#FFF1C7" },
];

/** The avatar for a stored number; anything missing or invalid is avatar 1. */
export function avatarFor(value: unknown): AvatarDef {
  const n = typeof value === "number" ? value : Number(value);
  const index = Number.isInteger(n) && n >= 1 ? (n - 1) % AVATARS.length : 0;
  return AVATARS[index] ?? AVATARS[0]!;
}
