/**
 * Sticker catalogue (T7.5). A sticker id is what the server stores in
 * user_stickers; this file turns it into art and alt text. Placeholder SVG art
 * until Phase 8 delivers the real set.
 *
 * - Weekly stickers: `week-<isoYear>-<isoWeek>`, collected by playing on 3
 *   different days in one week. The art rotates through WEEKLY_ART by week number.
 * - Achievement stickers (T11.4): one per id in ACHIEVEMENTS. The server decides
 *   who gets one (apps/backend-api/src/services/achievements.ts, the same ids);
 *   this list only has the art, the name and the hint for the sticker book.
 */

const BASE = "/brand/stickers";

export type StickerArt = { name: string; src: string };

const art = (name: string): StickerArt => ({ name, src: `${BASE}/${name}.svg` });

/** Weekly art, in rotation order. Adding one changes which art later weeks get. */
export const WEEKLY_ART: readonly StickerArt[] = [
  art("star"),
  art("rainbow"),
  art("rocket"),
  art("sun"),
];

export type AchievementSticker = {
  id: string;
  art: StickerArt;
  /** The sticker's name, also its alt text. */
  label: string;
  /** How to get it, shown under a locked sticker in your sticker book. */
  hint: string;
  /** Not shown as a locked sticker (given by a grown-up, not earned by playing). */
  hiddenUntilEarned?: boolean;
};

/** Achievement stickers in sticker-book order (T11.4). */
export const ACHIEVEMENTS: readonly AchievementSticker[] = [
  { id: "first-play", art: art("balloon"), label: "First game!", hint: "Play any game" },
  {
    id: "beat-best",
    art: art("trophy"),
    label: "Beat your best",
    hint: "Beat your own best score in a game",
  },
  { id: "five-games", art: art("dice"), label: "Game explorer", hint: "Try 5 different games" },
  {
    id: "daily-trio",
    art: art("calendar"),
    label: "Daily trio",
    hint: "Play today's challenge on 3 days in one week",
  },
  {
    id: "reflex-ring-100",
    art: art("ring"),
    label: "Ring master",
    hint: "Score 100 in Reflex Ring",
  },
  { id: "serpento-20", art: art("snake"), label: "Long snake", hint: "Eat 20 apples in Serpento" },
  {
    id: "snapadile-50",
    art: art("croc"),
    label: "Croc stopper",
    hint: "Snap 50 crocs in Snapadile",
  },
  { id: "hoop-city-50", art: art("hoop"), label: "Hoop hero", hint: "Score 50 in Hoop City" },
  {
    id: "friend-made",
    art: art("hearts"),
    label: "Best buds",
    hint: "Make a friend with your friend code",
  },
  {
    id: "supporter",
    art: art("supporter"),
    label: "Supporter",
    hint: "A thank-you from the family",
    hiddenUntilEarned: true,
  },
];

/** Achievement stickers by id. */
export const ACHIEVEMENT_STICKERS: Readonly<Record<string, AchievementSticker>> =
  Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

/** How to collect a weekly sticker, for the sticker book. */
export const WEEKLY_HINT = "Play on 3 different days in one week";

export type StickerInfo = {
  id: string;
  kind: "weekly" | "achievement" | "unknown";
  src: string;
  /** Alt text: says what the sticker is for, in the family voice. */
  alt: string;
};

const WEEKLY_ID = /^week-(\d{4})-(\d{1,2})$/;

/** Parses `week-2026-41` into its ISO year and week, or null. */
export function parseWeeklyStickerId(id: string): { isoYear: number; isoWeek: number } | null {
  const m = WEEKLY_ID.exec(id);
  if (!m) return null;
  const isoYear = Number(m[1]);
  const isoWeek = Number(m[2]);
  if (isoWeek < 1 || isoWeek > 53) return null;
  return { isoYear, isoWeek };
}

/** Art and alt text for any sticker id. Unknown ids still render (as a star). */
export function stickerInfo(id: string): StickerInfo {
  const weekly = parseWeeklyStickerId(id);
  if (weekly) {
    const a = WEEKLY_ART[weekly.isoWeek % WEEKLY_ART.length] ?? WEEKLY_ART[0]!;
    return {
      id,
      kind: "weekly",
      src: a.src,
      alt: `${capitalise(a.name)} sticker for week ${weekly.isoWeek} of ${weekly.isoYear}`,
    };
  }
  const achievement = ACHIEVEMENT_STICKERS[id];
  if (achievement) {
    return { id, kind: "achievement", src: achievement.art.src, alt: achievement.label };
  }
  return { id, kind: "unknown", src: WEEKLY_ART[0]!.src, alt: "A sticker" };
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export type StickerBook = {
  /** Every achievement you have, plus the ones still to get (hidden ones only once earned). */
  achievements: Array<AchievementSticker & { earned: boolean }>;
  /** Weekly stickers you have, newest week first. */
  weekly: string[];
};

/** Lays out the sticker book from the ids a player has collected (any order). */
export function stickerBook(collected: readonly string[]): StickerBook {
  const have = new Set(collected);
  const achievements = ACHIEVEMENTS.filter((a) => have.has(a.id) || !a.hiddenUntilEarned).map(
    (a) => ({ ...a, earned: have.has(a.id) }),
  );
  const weekNumber = (id: string) => {
    const w = parseWeeklyStickerId(id);
    return w ? w.isoYear * 100 + w.isoWeek : -1;
  };
  const weekly = [...have]
    .filter((id) => weekNumber(id) > 0)
    .sort((a, b) => weekNumber(b) - weekNumber(a));
  return { achievements, weekly };
}

/** The words for the game-over sticker moment: always happy, never counts what's missing. */
export function stickerMomentText(
  stickers: ReadonlyArray<{ id: string; kind: "weekly" | "achievement" }>,
): { title: string; detail: string } {
  const [first] = stickers;
  if (stickers.length === 1 && first?.kind === "weekly") {
    return { title: "You got this week's sticker!", detail: "You played on 3 days this week." };
  }
  const names = stickers.map((s) =>
    s.kind === "weekly" ? "This week's sticker" : stickerInfo(s.id).alt,
  );
  if (stickers.length === 1) return { title: "You got a sticker!", detail: names[0] ?? "" };
  return { title: `You got ${stickers.length} stickers!`, detail: names.join(" · ") };
}
