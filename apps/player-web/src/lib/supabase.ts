/**
 * Supabase Auth for the player app (Phase 14). One client, created on first use and
 * loaded as its own chunk, with the session kept in the platform storage adapter
 * (localStorage on the web, the Preferences mirror in the apps) so it survives restarts.
 *
 * It is `@supabase/auth-js` on its own, the auth half of supabase-js: we only use
 * Supabase for sign-in here, and the full client would add realtime, storage and the
 * database client to the bundle (a 214 kB chunk against 99 kB, 55 kB against 23 kB gzipped).
 *
 * Every function here throws Supabase's AuthError (which has `code` and `status`,
 * never the user's email) or an Error; show them through `errorMessage()`, never raw.
 */
import type { GoTrueClient, Provider, Session } from "@supabase/auth-js";
import { adapters } from "../platform/adapters";

export type { Session };
export type SocialProvider = Extract<Provider, "google" | "apple">;

const SESSION_STORAGE_KEY = "g4j:auth";
const REDIRECT_KEY = "g4j:authRedirect";
export const CALLBACK_PATH = "/auth/callback";

let client: Promise<GoTrueClient> | null = null;

function auth(): Promise<GoTrueClient> {
  client ??= import("@supabase/auth-js").then(({ AuthClient }) => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      // A code, so the log says why (VITE_SUPABASE_* missing from .env.local).
      throw Object.assign(new Error("supabase_not_configured"), {
        code: "supabase_not_configured",
      });
    }
    return new AuthClient({
      url: `${url.replace(/\/+$/, "")}/auth/v1`,
      // The same headers supabase-js's createClient sends to Auth.
      headers: { Authorization: `Bearer ${key}`, apikey: key },
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      // Off on purpose: friend links use `?code=` too. /auth/callback exchanges the code.
      detectSessionInUrl: false,
      storageKey: SESSION_STORAGE_KEY,
      storage: {
        getItem: (key) => adapters.storage.get(key),
        setItem: (key, value) => adapters.storage.set(key, value),
        removeItem: (key) => adapters.storage.remove(key),
      },
    });
  });
  return client;
}

function required(session: Session | null): Session {
  if (!session) throw new Error("no_session");
  return session;
}

/** The stored session (refreshed first when it has expired), or null when signed out. */
export async function currentSession(): Promise<Session | null> {
  const { data, error } = await (await auth()).getSession();
  if (error) throw error;
  return data.session;
}

/** The access token for API calls. supabase-js refreshes it on its own. */
export async function getAccessToken(forceRefresh = false): Promise<string | null> {
  const a = await auth();
  if (forceRefresh) {
    const { data, error } = await a.refreshSession();
    if (error) throw error;
    return data.session?.access_token ?? null;
  }
  const { data } = await a.getSession();
  return data.session?.access_token ?? null;
}

export async function signInAsAnonymous(): Promise<Session> {
  const { data, error } = await (await auth()).signInAnonymously();
  if (error) throw error;
  return required(data.session);
}

/**
 * Turns the one-time `tokenHash` from /auth/register-username or /auth/login-username
 * into a session. No email is involved: the API minted it with the admin API.
 */
export async function signInWithTokenHash(tokenHash: string): Promise<Session> {
  const { data, error } = await (
    await auth()
  ).verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });
  if (error) throw error;
  return required(data.session);
}

/** Signs out on this device even when the server can't be reached. */
export async function signOut(): Promise<void> {
  const a = await auth();
  const { error } = await a.signOut();
  if (error) await a.signOut({ scope: "local" });
}

/** Calls back on sign-in, sign-out, user updates and token refreshes. */
export async function onAuthChange(
  callback: (event: string, session: Session | null) => void,
): Promise<() => void> {
  const { data } = (await auth()).onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}

export function isAnonymousSession(session: Session | null): boolean {
  return session?.user.is_anonymous === true;
}

/** Social providers linked to the session's user ("google", "apple"). */
export function linkedProviders(session: Session | null): string[] {
  const providers = session?.user.app_metadata.providers;
  return Array.isArray(providers)
    ? providers.filter((p): p is string => p === "google" || p === "apple")
    : [];
}

// ---------------------------------------------------------------------------
// Google and Apple (dormant while features.socialSignIn is off)
// ---------------------------------------------------------------------------

export type PendingRedirect = { mode: "signin" | "link"; returnTo: string };

/**
 * Starts a Google/Apple sign-in, or links one to the current (often guest) user so it
 * keeps its id. On the web this leaves the page for the provider and comes back to
 * /auth/callback, so the returned promise never settles. Native sheets are T14.4.
 */
export async function startSocialRedirect(
  provider: SocialProvider,
  mode: PendingRedirect["mode"],
): Promise<never> {
  if (adapters.app.isNative) throw new Error("social_sign_in_unavailable");
  const a = await auth();
  const options = { redirectTo: window.location.origin + CALLBACK_PATH, skipBrowserRedirect: true };
  const { data, error } =
    mode === "link"
      ? await a.linkIdentity({ provider, options })
      : await a.signInWithOAuth({ provider, options });
  if (error) throw error;
  const pending: PendingRedirect = {
    mode,
    returnTo: window.location.pathname + window.location.search,
  };
  adapters.session.set(REDIRECT_KEY, JSON.stringify(pending));
  window.location.assign(data.url);
  // The page is leaving; nothing should run after this.
  return new Promise<never>(() => {});
}

/** What startSocialRedirect remembered, read once. */
export function takePendingRedirect(): PendingRedirect | null {
  const raw = adapters.session.get(REDIRECT_KEY);
  adapters.session.remove(REDIRECT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingRedirect>;
    if ((parsed.mode === "signin" || parsed.mode === "link") && typeof parsed.returnTo === "string")
      return { mode: parsed.mode, returnTo: parsed.returnTo };
  } catch {
    // Unreadable: treat as missing.
  }
  return null;
}

/** An auth-style error for a provider that sent the user back with `?error=`. */
class RedirectError extends Error {
  readonly __isAuthError = true;
  constructor(readonly code: string) {
    super("oauth_redirect_failed");
    this.name = "RedirectError";
  }
}

/** Finishes the redirect on /auth/callback: exchanges `?code=` for the session. */
export async function finishSocialRedirect(search: string): Promise<Session> {
  const params = new URLSearchParams(search);
  const failed = params.get("error_code") ?? params.get("error");
  if (failed) throw new RedirectError(failed);
  const code = params.get("code");
  if (!code) throw new RedirectError("missing_code");
  const { data, error } = await (await auth()).exchangeCodeForSession(code);
  if (error) throw error;
  return required(data.session);
}
