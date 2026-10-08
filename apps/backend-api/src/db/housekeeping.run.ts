/**
 * `npm run db:housekeeping -w apps/backend-api`, run daily by
 * .github/workflows/db-housekeeping.yml. The daily query also keeps the free
 * Supabase project from pausing after 7 idle days. Logs counts only.
 */
import { getDb } from "./client.js";
import { runHousekeeping } from "./housekeeping.js";

const counts = await runHousekeeping(getDb());
console.log(JSON.stringify({ event: "db_housekeeping", ...counts }));
process.exit(0);
