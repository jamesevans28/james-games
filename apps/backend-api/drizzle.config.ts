import { defineConfig } from "drizzle-kit";

// `db:generate` needs no database; `db:migrate` uses the session pooler (port 5432),
// because migrations need a real session, not the transaction pooler.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL_MIGRATIONS ?? "" },
  strict: true,
});
