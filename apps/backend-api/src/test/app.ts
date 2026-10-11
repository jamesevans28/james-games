/**
 * Route tests: the real Express app on a random port, a fresh pglite database,
 * fake Supabase access tokens and a recording fake of the Supabase admin API.
 * A token is `test:<uid>[:<accountType>[:<email>]]`.
 *
 *   const api = await startTestApp();
 *   await api.addUser({ id: "u1", screenName: "bouncy-otter-42" });
 *   const res = await api.request("GET", "/me", { as: "u1" });
 *   afterAll(() => api.close());
 *
 * `api.authAdmin.calls` lists the admin calls in order; `api.authAdmin.failNext(name)`
 * makes the next call of that name throw.
 */
import type { AddressInfo } from "node:net";
import { app } from "../index.js";
import { setTokenVerifierForTests } from "../middleware/authGuards.js";
import {
  setAuthAdminForTests,
  type AccessTokenClaims,
  type AuthAdmin,
} from "../services/supabaseAuthService.js";
import { users, type NewUser } from "../db/schema.js";
import type { Db } from "../db/client.js";
import { createTestDb } from "./db.js";

export type TestAccountType = "anonymous" | "username_pin" | "linked";

export function testToken(
  uid: string,
  accountType: TestAccountType = "username_pin",
  email?: string,
) {
  return ["test", uid, accountType, email].filter(Boolean).join(":");
}

function fakeVerify(token: string): Promise<AccessTokenClaims> {
  const [prefix, uid, accountType = "username_pin", email] = token.split(":");
  if (prefix !== "test" || !uid) return Promise.reject(new Error("bad test token"));
  const providers =
    accountType === "anonymous" ? [] : accountType === "linked" ? ["google"] : ["email"];
  return Promise.resolve({
    sub: uid,
    role: "authenticated",
    email,
    is_anonymous: accountType === "anonymous",
    app_metadata: {
      ...(accountType === "anonymous" ? {} : { account_type: accountType }),
      providers,
    },
  });
}

type AdminCall = {
  [K in keyof AuthAdmin]: { name: K; args: Parameters<AuthAdmin[K]> };
}[keyof AuthAdmin];

/** Records every admin call; `mintSignIn` returns `token-hash-for-<uid>`. */
export function fakeAuthAdmin() {
  const calls: AdminCall[] = [];
  const failing = new Set<keyof AuthAdmin>();
  const run = <K extends keyof AuthAdmin>(name: K, args: Parameters<AuthAdmin[K]>) => {
    calls.push({ name, args } as AdminCall);
    if (failing.delete(name)) return Promise.reject(new Error(`supabase_admin_${name}_failed`));
    return Promise.resolve();
  };
  const admin: AuthAdmin = {
    convertToPinAccount: (...args) => run("convertToPinAccount", args),
    mintSignIn: (...args) => run("mintSignIn", args).then(() => `token-hash-for-${args[0]}`),
    setAccountType: (...args) => run("setAccountType", args),
    deleteAuthUser: (...args) => run("deleteAuthUser", args),
  };
  return {
    admin,
    calls,
    failNext(name: keyof AuthAdmin) {
      failing.add(name);
    },
    callsTo<K extends keyof AuthAdmin>(name: K): Parameters<AuthAdmin[K]>[] {
      return calls.filter((c) => c.name === name).map((c) => c.args as Parameters<AuthAdmin[K]>);
    },
  };
}

// Tests poke at arbitrary JSON response fields; `any` keeps them readable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TestResponse = { status: number; body: any };

export async function startTestApp() {
  const db: Db = await createTestDb();
  setTokenVerifierForTests(fakeVerify);
  const authAdmin = fakeAuthAdmin();
  setAuthAdminForTests(authAdmin.admin);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    db,
    base,
    authAdmin,
    /** Inserts a user row directly (defaults: avatar 1, username_pin account). */
    async addUser(row: Partial<NewUser> & { id: string }) {
      const [created] = await db
        .insert(users)
        .values({ screenName: `player-${row.id}`, accountType: "username_pin", ...row })
        .returning();
      return created!;
    },
    async request(
      method: string,
      path: string,
      opts: { as?: string; accountType?: TestAccountType; email?: string; body?: unknown } = {},
    ): Promise<TestResponse> {
      const headers: Record<string, string> = {};
      if (opts.as)
        headers.authorization = `Bearer ${testToken(opts.as, opts.accountType, opts.email)}`;
      if (opts.body !== undefined) headers["content-type"] = "application/json";
      const res = await fetch(base + path, {
        method,
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      });
      const text = await res.text();
      let body: unknown = text;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        // Non-JSON body: keep the text.
      }
      return { status: res.status, body };
    },
    async close() {
      setTokenVerifierForTests(null);
      setAuthAdminForTests(null);
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

export type TestApp = Awaited<ReturnType<typeof startTestApp>>;
