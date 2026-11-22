/**
 * `npm run db:housekeeping -w apps/backend-api`, run daily by
 * .github/workflows/db-housekeeping.yml. The daily query also keeps the free
 * Supabase project from pausing after 7 idle days. Logs counts only.
 *
 * The auth-user sweep (T14.10) runs only when SUPABASE_URL and SUPABASE_SECRET_KEY are set
 * and name the same Supabase project as DATABASE_URL: against another project's database
 * every guest would look like it has no row. Exits 1 when the sweep couldn't list or delete
 * auth users, so the workflow shows it.
 */
import { config } from "../config/index.js";
import { getDb } from "./client.js";
import { runHousekeeping } from "./housekeeping.js";
import { supabaseProjectRef } from "./url.js";

const configured = Boolean(config.supabase.url && config.supabase.secretKey);
const authRef = configured ? supabaseProjectRef(config.supabase.url) : null;
const sameProject =
  authRef !== null && authRef === supabaseProjectRef(process.env.DATABASE_URL ?? "");
const authSkipReason = !configured ? "not_configured" : sameProject ? undefined : "other_project";

const counts = await runHousekeeping(getDb(), new Date(), { sweepAuthUsers: !authSkipReason });
console.log(JSON.stringify({ event: "db_housekeeping", ...counts, authSkipReason }));
const failed =
  counts.authSweep === "failed" ||
  ("authDeleteFailures" in counts && counts.authDeleteFailures > 0);
process.exit(failed ? 1 : 0);
