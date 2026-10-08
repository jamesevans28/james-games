import { z } from "zod";
import type { GameManifest } from "./sdk";

/**
 * Validation for GameManifest (T4.3). Used by tests and scripts only, so zod never
 * ships to players. Keep in step with the type in sdk.ts; the test checks they agree.
 */
const isoDate = z.iso.datetime();

export const manifestSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "lowercase-with-dashes"),
  title: z.string().min(1).max(40),
  tagline: z.string().min(1).max(80),
  description: z.string().min(1),
  objective: z.string().min(1),
  controls: z.string().min(1),
  makers: z.array(z.string().min(1)).min(1),
  note: z.string().min(1).optional(),
  noteBy: z.string().min(1).optional(),
  status: z.enum(["active", "beta", "inactive"]),
  orientation: z.literal("portrait"),
  design: z.strictObject({ w: z.number().int().positive(), h: z.number().int().positive() }),
  input: z.array(z.enum(["tap", "hold", "swipe", "drag", "dpad", "keyboard"])).min(1),
  scoring: z.strictObject({
    max: z.number().positive(),
    perSecondMax: z.number().positive(),
    xpMultiplier: z.number().positive().max(10),
  }),
  // SVG is allowed until Phase 8 covers land; link previews fall back to the brand card.
  cover: z.string().regex(/^\/assets\/.+\.(png|jpe?g|webp|svg)$/, "image under /assets/"),
  createdAt: isoDate,
  updatedAt: isoDate,
  seo: z.strictObject({
    description: z.string().min(20).max(160),
    category: z.enum([
      "reflex",
      "puzzle",
      "word",
      "arcade",
      "sports",
      "memory",
      "action",
      "casual",
      "strategy",
    ]),
  }),
  sfx: z.array(z.string().regex(/^[a-z0-9-]+$/)).optional(),
  remix: z
    .array(
      z.strictObject({
        key: z.string().min(1),
        label: z.string().min(1),
        min: z.number(),
        max: z.number(),
        step: z.number().positive(),
        default: z.number(),
      }),
    )
    .optional(),
});

// Compile-time check that the schema and the GameManifest type describe the same shape.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const schemaMatchesType: Same<z.infer<typeof manifestSchema>, GameManifest> = true;
void schemaMatchesType;

export type ManifestIssue = { path: string; message: string };

/** Validates one manifest; returns readable issues (empty when valid). */
export function checkManifest(value: unknown): ManifestIssue[] {
  const result = manifestSchema.safeParse(value);
  if (result.success) return [];
  return result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
}
