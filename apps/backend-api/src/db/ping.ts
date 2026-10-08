/** `npm run db:ping -w apps/backend-api`: checks both connection strings without printing them. */
import postgres from "postgres";

for (const name of ["DATABASE_URL", "DATABASE_URL_MIGRATIONS"] as const) {
  const url = process.env[name];
  if (!url) {
    console.log(`${name}: not set`);
    continue;
  }
  const client = postgres(url, { prepare: false, max: 1, connect_timeout: 10 });
  try {
    const [row] = await client<{ version: string }[]>`select version()`;
    console.log(`${name}: ok (${row?.version.split(" ").slice(0, 2).join(" ")})`);
  } catch (err) {
    // Driver messages can include the host and user; print only the code.
    const code = (err as { code?: string }).code ?? "unknown";
    console.log(`${name}: failed (${code})`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
