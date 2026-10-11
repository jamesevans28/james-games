// Supabase Auth (Phase 14): access-token verification, the admin calls the account
// flows need, and PIN hashing. Tokens are ES256 JWTs checked against the project's
// published key set, so a request costs no network call once the keys are cached.
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { config } from "../config/index.js";

// ============================================================================
// Token verification
// ============================================================================

/** The access-token claims the API reads. Supabase sets all of them itself. */
export type AccessTokenClaims = JWTPayload & {
  sub: string;
  role?: string;
  email?: string;
  is_anonymous?: boolean;
  app_metadata?: { account_type?: string; providers?: string[] };
};

function supabaseUrl(): string {
  if (!config.supabase.url) throw new Error("SUPABASE_URL is not set");
  return config.supabase.url;
}

// One key set per container; jose caches the keys and refetches on an unknown kid.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

/** Verifies a Supabase access token (signature, issuer, audience, expiry). */
export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  const issuer = `${supabaseUrl()}/auth/v1`;
  jwks ??= createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  const { payload } = await jwtVerify(token, jwks, { issuer, audience: "authenticated" });
  if (typeof payload.sub !== "string" || !payload.sub) throw new Error("token_without_subject");
  return payload as AccessTokenClaims;
}

// ============================================================================
// Synthetic emails for username + PIN accounts
// ============================================================================

/**
 * A PIN account's auth user carries `<username>@pin.games4james.com` so the admin API
 * can mint sign-ins for it. Never shown, never mailed, never returned by the API; the
 * domain is ours, so it can't belong to a real person.
 */
export const PIN_EMAIL_DOMAIN = "pin.games4james.com";

export function syntheticEmail(username: string): string {
  return `${username.toLowerCase()}@${PIN_EMAIL_DOMAIN}`;
}

export function isSyntheticEmail(email: string | undefined | null): boolean {
  return Boolean(email?.toLowerCase().endsWith(`@${PIN_EMAIL_DOMAIN}`));
}

// ============================================================================
// Admin calls
// ============================================================================

export type AuthAccountType = "username_pin" | "linked";

/** What the account flows need from Supabase's admin API. Route tests swap in a fake. */
export interface AuthAdmin {
  /** Gives the auth user (usually anonymous) its synthetic email and the PIN account type. */
  convertToPinAccount(uid: string, username: string): Promise<void>;
  /** A one-time token hash the client turns into a session with `verifyOtp`. No email is sent. */
  mintSignIn(email: string): Promise<string>;
  setAccountType(uid: string, accountType: AuthAccountType): Promise<void>;
  /** Deletes the auth user; one that is already gone counts as deleted. */
  deleteAuthUser(uid: string): Promise<void>;
}

/** Supabase errors carry a code and status; only those are ever logged or rethrown. */
class SupabaseAdminError extends Error {
  constructor(
    readonly code: string,
    readonly status: number | undefined,
  ) {
    super(`supabase_admin_${code}`);
    this.name = "SupabaseAdminError";
  }
}

type AdminFailure = { code?: string; status?: number } | null;

function check(error: AdminFailure): void {
  if (error) throw new SupabaseAdminError(error.code ?? "unknown", error.status);
}

let client: SupabaseClient | null = null;

function adminClient(): SupabaseClient {
  if (client) return client;
  if (!config.supabase.secretKey) throw new Error("SUPABASE_SECRET_KEY is not set");
  client = createClient(supabaseUrl(), config.supabase.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}

const supabaseAdmin: AuthAdmin = {
  async convertToPinAccount(uid, username) {
    const { error } = await adminClient().auth.admin.updateUserById(uid, {
      email: syntheticEmail(username),
      email_confirm: true,
      app_metadata: { account_type: "username_pin" },
    });
    check(error);
  },
  async mintSignIn(email) {
    const { data, error } = await adminClient().auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    check(error);
    const tokenHash = data.properties?.hashed_token;
    if (!tokenHash) throw new SupabaseAdminError("no_token_hash", undefined);
    return tokenHash;
  },
  async setAccountType(uid, accountType) {
    const { error } = await adminClient().auth.admin.updateUserById(uid, {
      app_metadata: { account_type: accountType },
    });
    check(error);
  },
  async deleteAuthUser(uid) {
    const { error } = await adminClient().auth.admin.deleteUser(uid);
    if (error?.code === "user_not_found" || error?.status === 404) return;
    check(error);
  },
};

let authAdmin: AuthAdmin = supabaseAdmin;

/** Route tests swap in a recording fake (src/test/app.ts); production never calls this. */
export function setAuthAdminForTests(fake: AuthAdmin | null): void {
  authAdmin = fake ?? supabaseAdmin;
}

export const convertToPinAccount: AuthAdmin["convertToPinAccount"] = (uid, username) =>
  authAdmin.convertToPinAccount(uid, username);
export const mintSignIn: AuthAdmin["mintSignIn"] = (email) => authAdmin.mintSignIn(email);
export const setAccountType: AuthAdmin["setAccountType"] = (uid, accountType) =>
  authAdmin.setAccountType(uid, accountType);
export const deleteAuthUser: AuthAdmin["deleteAuthUser"] = (uid) => authAdmin.deleteAuthUser(uid);

// ============================================================================
// PIN hashing
// ============================================================================

const PIN_SALT_ROUNDS = 10;

export async function hashPin(pin: string): Promise<string> {
  return await bcrypt.hash(pin, PIN_SALT_ROUNDS);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(pin, hash);
}
