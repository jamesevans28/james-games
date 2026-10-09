/**
 * Avatar set. Placeholder SVG animal faces until Phase 8 delivers the AI set.
 *
 * Profiles store a 1-based number (users.avatar).
 */
export type AvatarDef = {
  id: number;
  name: string;
  src: string;
  background: string;
  /** Gold set: a thank-you for supporters' families (T12.2; the server checks too). */
  supporterOnly?: boolean;
};

const BASE = "/brand/avatars";

const DEFAULT_AVATAR: AvatarDef = {
  id: 1,
  name: "Cat",
  src: `${BASE}/cat.svg`,
  background: "#FFF1C7",
};

export const AVATARS: readonly AvatarDef[] = [
  DEFAULT_AVATAR,
  { id: 2, name: "Dog", src: `${BASE}/dog.svg`, background: "#DDEFFF" },
  { id: 3, name: "Frog", src: `${BASE}/frog.svg`, background: "#FFE1DE" },
  { id: 4, name: "Bear", src: `${BASE}/bear.svg`, background: "#DDF5E5" },
  { id: 5, name: "Fox", src: `${BASE}/fox.svg`, background: "#EEE7FF" },
  { id: 6, name: "Panda", src: `${BASE}/panda.svg`, background: "#DDF5E5" },
  { id: 7, name: "Rabbit", src: `${BASE}/rabbit.svg`, background: "#DDEFFF" },
  { id: 8, name: "Owl", src: `${BASE}/owl.svg`, background: "#FFF1C7" },
];

/** Supporters' gold set starts at this id (mirrors SUPPORTER_AVATAR_MIN on the server). */
export const SUPPORTER_AVATAR_MIN = 101;

/** The same animals on gold, for supporters (placeholder art until Phase 8's avatar set). */
export const SUPPORTER_AVATARS: readonly AvatarDef[] = AVATARS.map((a, i) => ({
  ...a,
  id: SUPPORTER_AVATAR_MIN + i,
  name: `Gold ${a.name}`,
  background: "#FFD25A",
  supporterOnly: true,
}));

const ALL_AVATARS = [...AVATARS, ...SUPPORTER_AVATARS];

/** The avatar for a stored number; anything missing or invalid is avatar 1. */
export function avatarFor(value: unknown): AvatarDef {
  const n = typeof value === "number" ? value : Number(value);
  return ALL_AVATARS.find((a) => a.id === n) ?? DEFAULT_AVATAR;
}
