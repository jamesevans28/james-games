// @vitest-environment node
import { test, expect } from "vitest";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { checkManifest } from "./manifestSchema";
import { defineGame, type GameManifest } from "./sdk";

const publicDir = fileURLToPath(new URL("../../public", import.meta.url));

const valid: GameManifest = defineGame({
  id: "stack-tower",
  title: "Stack Tower",
  tagline: "Stack the blocks as high as you can.",
  description: "Tap to drop each block on the tower.",
  objective: "Build the tallest tower.",
  controls: "Tap anywhere to drop.",
  makers: ["Harvey"],
  status: "beta",
  orientation: "portrait",
  design: { w: 540, h: 960 },
  input: ["tap"],
  scoring: { max: 10_000, perSecondMax: 50, xpMultiplier: 1 },
  cover: "/assets/stack-tower/cover.png",
  createdAt: "2026-10-08T00:00:00.000Z",
  updatedAt: "2026-10-08T00:00:00.000Z",
  seo: { description: "Stack the blocks as high as you can. Free, no ads.", category: "casual" },
});

test("a well-formed manifest passes", () => {
  expect(checkManifest(valid)).toEqual([]);
});

test("a deliberately broken manifest fails with readable issues", () => {
  const broken = {
    ...valid,
    id: "Stack Tower",
    scoring: { max: 0, perSecondMax: 50, xpMultiplier: 1 },
    cover: "cover.gif",
    extra: true,
  };
  const paths = checkManifest(broken).map((i) => i.path);
  expect(paths).toEqual(expect.arrayContaining(["id", "scoring.max", "cover", ""]));
});

// Every real game: valid, unique, folder name = id, cover file exists.
const manifests = import.meta.glob<{ default: GameManifest }>("../games/*/manifest.ts", {
  eager: true,
});

test.each(Object.entries(manifests))("%s is valid", (path, mod) => {
  const m = mod.default;
  expect(checkManifest(m)).toEqual([]);
  expect(path).toBe(`../games/${m.id}/manifest.ts`);
  expect(existsSync(`${publicDir}${m.cover}`), `missing cover ${m.cover}`).toBe(true);
});

test("game ids are unique", () => {
  const ids = Object.values(manifests).map((m) => m.default.id);
  expect(new Set(ids).size).toBe(ids.length);
});
