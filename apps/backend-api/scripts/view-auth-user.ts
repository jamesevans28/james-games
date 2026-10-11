/**
 * Looks at Supabase Auth users without printing anything personal (Phase 14).
 *
 *   npm run auth:view -w apps/backend-api               # counts by account type
 *   npm run auth:view -w apps/backend-api -- <user-id>  # one user: exists?, type, providers
 *
 * Reads SUPABASE_URL and SUPABASE_SECRET_KEY from apps/backend-api/.env.local. Never
 * prints emails (real or synthetic), names or other user ids.
 */
import path from "node:path";
import { GoTrueAdminApi, type User } from "@supabase/auth-js";
import dotenv from "dotenv";

dotenv.config({ path: path.join(import.meta.dirname, "..", ".env.local"), quiet: true });

const url = process.env.SUPABASE_URL?.trim();
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
if (!url || !secretKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SECRET_KEY in apps/backend-api/.env.local");
  process.exit(1);
}

const admin = new GoTrueAdminApi({
  url: `${url.replace(/\/+$/, "")}/auth/v1`,
  headers: { Authorization: `Bearer ${secretKey}`, apikey: secretKey },
});

function describe(user: User) {
  const meta = user.app_metadata as { account_type?: string; providers?: string[] };
  return {
    accountType: meta.account_type ?? (user.is_anonymous ? "anonymous" : "(none)"),
    anonymous: Boolean(user.is_anonymous),
    providers: meta.providers ?? [],
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at ?? null,
  };
}

const userId = process.argv[2];
if (userId) {
  const { data, error } = await admin.getUserById(userId);
  if (error?.status === 404 || error?.code === "user_not_found") {
    console.log("No auth user with that id.");
  } else if (error) {
    console.error(`Supabase error: ${error.code ?? error.status ?? "unknown"}`);
    process.exit(1);
  } else {
    console.log(describe(data.user));
  }
} else {
  const counts = new Map<string, number>();
  let total = 0;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.error(`Supabase error: ${error.code ?? error.status ?? "unknown"}`);
      process.exit(1);
    }
    for (const user of data.users) {
      const type = describe(user).accountType;
      counts.set(type, (counts.get(type) ?? 0) + 1);
      total++;
    }
    if (data.users.length < 1000) break;
  }
  console.log(`${total} auth users`);
  for (const [type, n] of [...counts].sort()) console.log(`  ${type}: ${n}`);
}
