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

/**
 * The Supabase project a database or API URL belongs to: `<ref>` from `<ref>.supabase.co`,
 * `db.<ref>.supabase.co` or the pooler user `postgres.<ref>`; "local" for a loopback host
 * (`supabase start`); null when it can't tell. The housekeeping job only deletes auth users
 * when its database and Supabase URL name the same project (T14.10).
 */
export function supabaseProjectRef(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return "local";
  const direct = /^(?:db\.)?([a-z0-9]+)\.supabase\.co$/.exec(host);
  if (direct) return direct[1]!;
  const pooler = /^postgres\.([a-z0-9]+)$/i.exec(decodeURIComponent(parsed.username));
  if (pooler && host.endsWith(".pooler.supabase.com")) return pooler[1]!.toLowerCase();
  return null;
}
