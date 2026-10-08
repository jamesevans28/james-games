/**
 * Sticker catalogue (T7.5). A sticker id is what the server stores in
 * user_stickers; this file turns it into art and alt text. Placeholder SVG art
 * until Phase 8 delivers the real set.
 *
 * - Weekly stickers: `week-<isoYear>-<isoWeek>`, collected by playing on 3
 *   different days in one week. The art rotates through WEEKLY_ART by week number.
 * - Achievement stickers (T11.4): add entries to ACHIEVEMENT_STICKERS by id.
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

/** Achievement stickers by id (T11.4 fills this in). */
export const ACHIEVEMENT_STICKERS: Readonly<Record<string, { art: StickerArt; label: string }>> =
  {};

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
