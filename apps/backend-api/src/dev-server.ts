// Development entrypoint: the Express app on a local port.
// DATABASE_URL=pglite:<dir> runs on a local on-disk Postgres instead of Supabase (npm run local).
import { config } from "./config/index.js";
import { app } from "./index.js";
import { log } from "./lib/log.js";

const dbUrl = process.env.DATABASE_URL ?? "";
if (dbUrl.startsWith("pglite:")) {
  const { useLocalDatabase } = await import("./db/local.js");
  await useLocalDatabase(dbUrl.slice("pglite:".length));
  log.info("local_database_ready", { engine: "pglite" });
}

const port = Number(process.env.PORT || config.port || 8787);
app.listen(port, () => {
  log.info("server_listening", { port, url: `http://localhost:${port}` });
});
