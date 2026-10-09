/** Where each tube sits on the 540 × 960 design, in design pixels. */
export type TubeSlot = { x: number; top: number; spacing: number };

/** Tube tops for one row, and for the two rows used when there are more than five tubes. */
export const ONE_ROW_TOP = 400;
export const TWO_ROW_TOPS = [290, 600] as const;
const MAX_SPACING = 120;

/**
 * Lays `count` tubes out centred: one row up to five tubes, else two rows with the
 * extra tube on the top row. `spacing` is the gap between tube centres in that row
 * (also the width of each tube's touch target).
 */
export function tubeLayout(count: number, width: number): TubeSlot[] {
  if (count <= 0) return [];
  const rows = count <= 5 ? [count] : [Math.ceil(count / 2), Math.floor(count / 2)];
  const tops = rows.length === 1 ? [ONE_ROW_TOP] : TWO_ROW_TOPS;
  const widest = Math.max(...rows);
  const spacing = Math.min(MAX_SPACING, width / widest);
  const out: TubeSlot[] = [];
  rows.forEach((n, r) => {
    for (let i = 0; i < n; i++) {
      out.push({
        x: width / 2 + (i - (n - 1) / 2) * spacing,
        top: tops[r] ?? ONE_ROW_TOP,
        spacing,
      });
    }
  });
  return out;
}
