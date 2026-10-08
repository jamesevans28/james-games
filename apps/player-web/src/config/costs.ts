/**
 * What it costs to run Games4James, shown on the support page (T12.1). Claude keeps
 * this in step with docs/money.md (T12.5). Amounts in Australian dollars.
 */
export type CostRow = { item: string; perYear: number; note: string };

export const COSTS_UPDATED = "October 2026";

export const COSTS: readonly CostRow[] = [
  { item: "Web address (games4james.com)", perYear: 25, note: "the domain name" },
  { item: "Hosting on AWS", perYear: 12, note: "the website and the game server" },
  { item: "Database (Supabase)", perYear: 0, note: "free plan for now" },
  { item: "Sign-in (Firebase)", perYear: 0, note: "free plan" },
  { item: "Apple App Store", perYear: 155, note: "needed for the iPhone app (US$99)" },
  { item: "Google Play", perYear: 8, note: "a one-off US$25, spread over five years" },
  { item: "Art and sound tools", perYear: 60, note: "making the pictures and sounds" },
];

export function totalPerYear(rows: readonly CostRow[] = COSTS): number {
  return rows.reduce((sum, r) => sum + r.perYear, 0);
}
