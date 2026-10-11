/**
 * Supabase's "Direct connection" (db.<ref>.supabase.co) is IPv6-only, so it fails
 * from GitHub Actions and AWS Lambda with ENETUNREACH. The API and the jobs need
 * the pooler strings from Supabase → Connect (T6.1). Fail early with a clear message.
 */
export function assertPoolerUrl(name: string, url: string): void {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error(`${name} is not a valid postgresql:// URL`);
  }
  if (/^db\.[a-z0-9]+\.supabase\.co$/i.test(host)) {
    throw new Error(
      `${name} is Supabase's direct connection (db.<ref>.supabase.co), which only works over IPv6. ` +
        `Use the pooler string from Supabase → Connect: Transaction pooler (port 6543) for DATABASE_URL, ` +
        `Session pooler (port 5432) for DATABASE_URL_MIGRATIONS.`,
    );
  }
}
