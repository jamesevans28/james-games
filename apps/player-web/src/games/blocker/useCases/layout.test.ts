import { test, expect } from "vitest";
import {
  cellCentre,
  hitTestTray,
  pieceCellCentres,
  placedCentre,
  slotCentres,
  snapToGrid,
  TRAY_SLOTS,
  traySlotsFor,
  type GridGeometry,
  type TraySlot,
} from "./layout";
import { makePiece, SHAPES, type Shape } from "./pieces";

const byId = (id: string): Shape => {
  const s = SHAPES.find((x) => x.id === id);
  if (!s) throw new Error(id);
  return s;
};
const single = makePiece(byId("single"));
const domino = makePiece(byId("domino"));
const corner = makePiece(byId("corner-three"));
const tee = makePiece(byId("tee-five"));

const GRID: GridGeometry = { x: 70, y: 170, cell: 50, size: 8 };

test("three slots share the width evenly", () => {
  expect(TRAY_SLOTS).toBe(3);
  expect(slotCentres(540)).toEqual([90, 270, 450]);
  expect(slotCentres(400, 2)).toEqual([100, 300]);
});

test("cell centres of a piece drawn around a point", () => {
  expect(pieceCellCentres(single, { x: 100, y: 100 }, 40)).toEqual([{ x: 100, y: 100 }]);
  expect(pieceCellCentres(domino, { x: 100, y: 100 }, 40)).toEqual([
    { x: 80, y: 100 },
    { x: 120, y: 100 },
  ]);
});

const tray: TraySlot[] = [
  { piece: single, centre: { x: 90, y: 740 } },
  { piece: corner, centre: { x: 270, y: 740 } },
  { piece: tee, centre: { x: 450, y: 740 } },
];

test("tapping a piece's cells picks that slot", () => {
  expect(hitTestTray({ x: 90, y: 740 }, tray, 35, 20)).toBe(0);
  expect(hitTestTray({ x: 450, y: 705 }, tray, 35, 20)).toBe(2);
  // Just outside the single's cell but within the slop.
  expect(hitTestTray({ x: 90 + 17 + 15, y: 740 }, tray, 35, 20)).toBe(0);
});

test("a corner piece's empty corner is a miss without slop", () => {
  // corner-three: cells (0,0) (0,1) (1,1); the top-right square is empty.
  const topRight = { x: 270 + 17.5, y: 740 - 17.5 };
  expect(hitTestTray(topRight, [tray[1] as TraySlot], 35, 0)).toBe(-1);
  expect(hitTestTray(topRight, [tray[1] as TraySlot], 35, 20)).toBe(0);
});

test("the gaps between slots and the rotate button below the tray don't start a drag", () => {
  expect(hitTestTray({ x: 180, y: 740 }, tray, 35, 20)).toBe(-1);
  expect(hitTestTray({ x: 270, y: 890 }, tray, 35, 20)).toBe(-1); // rotate button
  expect(hitTestTray({ x: 270, y: 850 }, tray, 35, 20)).toBe(-1); // its top edge
  expect(hitTestTray({ x: 270, y: 400 }, tray, 35, 20)).toBe(-1); // the board
});

test("empty slots can't be picked, and the nearest piece wins", () => {
  const withGap: TraySlot[] = [{ piece: null, centre: { x: 90, y: 740 } }, ...tray.slice(1)];
  expect(hitTestTray({ x: 90, y: 740 }, withGap, 35, 20)).toBe(-1);
  const close: TraySlot[] = [
    { piece: single, centre: { x: 100, y: 100 } },
    { piece: single, centre: { x: 140, y: 100 } },
  ];
  expect(hitTestTray({ x: 115, y: 100 }, close, 35, 30)).toBe(0);
  expect(hitTestTray({ x: 125, y: 100 }, close, 35, 30)).toBe(1);
});

test("snap rounds the piece's top-left to the nearest cell", () => {
  // A single centred on cell (0,0).
  expect(snapToGrid(single, cellCentre({ row: 0, col: 0 }, GRID), GRID)).toEqual({
    row: 0,
    col: 0,
  });
  // A domino centred between cells (3,4) and (3,5), nudged a little.
  const c = { x: GRID.x + 5 * 50 + 10, y: GRID.y + 3.5 * 50 - 12 };
  expect(snapToGrid(domino, c, GRID)).toEqual({ row: 3, col: 4 });
});

test("snap returns null far from the board but allows hanging off the edge", () => {
  expect(snapToGrid(single, { x: 270, y: 740 }, GRID)).toBeNull();
  expect(snapToGrid(single, { x: 0, y: 0 }, GRID)).toBeNull();
  expect(snapToGrid(single, { x: 600, y: 300 }, GRID)).toBeNull();
  // Half a cell off the left edge: snaps to column -1, which fits() will reject.
  expect(snapToGrid(single, { x: GRID.x - 30, y: GRID.y + 25 }, GRID)).toEqual({ row: 0, col: -1 });
});

test("cell and placed centres", () => {
  expect(cellCentre({ row: 0, col: 0 }, GRID)).toEqual({ x: 95, y: 195 });
  expect(placedCentre(domino, { row: 0, col: 0 }, GRID)).toEqual({ x: 120, y: 195 });
  const t = placedCentre(tee, { row: 2, col: 2 }, GRID);
  expect(t.x).toBeCloseTo(GRID.x + 3.5 * 50);
  expect(t.y).toBeCloseTo(GRID.y + (2.5 * 3 + 3.5 + 4.5) * 10);
});

test("the remix tray size is 1 to 4 slots, 3 by default (T11.2)", () => {
  expect(traySlotsFor(3)).toBe(TRAY_SLOTS);
  expect(traySlotsFor(1)).toBe(1);
  expect(traySlotsFor(4)).toBe(4);
  expect(traySlotsFor(9)).toBe(4);
  expect(traySlotsFor(0)).toBe(1);
  expect(traySlotsFor(Number.NaN)).toBe(TRAY_SLOTS);
});
