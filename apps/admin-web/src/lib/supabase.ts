/**
 * Supabase Auth for the admin console (Phase 14): Google sign-in only, as a redirect
 * back to this site. `@supabase/auth-js` on its own (the auth half of supabase-js).
 * Admin status is never read from the token: the API checks `users.admin` on `GET /me`.
 */
import { AuthClient, type Session } from "@supabase/auth-js";

const url = (import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "");
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

export const auth = new AuthClient({
  url: `${url}/auth/v1`,
  // The same headers supabase-js's createClient sends to Auth.
  headers: { Authorization: `Bearer ${key}`, apikey: key },
  flowType: "pkce",
  persistSession: true,
  autoRefreshToken: true,
  // Google sends James back to the admin with `?code=`; the client exchanges it on load.
  detectSessionInUrl: true,
  storageKey: "g4j-admin:auth",
});

/** Leaves for Google; the page comes back signed in (onAuthStateChange fires). */
export async function signInWithGoogle(): Promise<void> {
  const { error } = await auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin + "/" },
  });
  if (error) throw error;
}

/** Signs out on this device even when the server can't be reached. */
export async function signOut(): Promise<void> {
  const { error } = await auth.signOut();
  if (error) await auth.signOut({ scope: "local" });
}

/** The access token for API calls (refreshed by the client when it expires). */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await auth.getSession();
  return data.session?.access_token ?? null;
}

export type { Session };
