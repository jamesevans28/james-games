/**
 * Route tests: the real Express app on a random port, a fresh pglite database,
 * and fake Firebase tokens. A token is `test:<uid>[:<accountType>[:<email>]]`.
 *
 *   const api = await startTestApp();
 *   await api.addUser({ id: "u1", screenName: "bouncy-otter-42" });
 *   const res = await api.request("GET", "/me", { as: "u1" });
 *   afterAll(() => api.close());
 */
import type { AddressInfo } from "node:net";
import type { DecodedIdToken } from "firebase-admin/auth";
import { app } from "../index.js";
import { setTokenVerifierForTests } from "../middleware/authGuards.js";
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

function fakeVerify(token: string): Promise<DecodedIdToken> {
  const [prefix, uid, accountType = "username_pin", email] = token.split(":");
  if (prefix !== "test" || !uid) return Promise.reject(new Error("bad test token"));
  const provider =
    accountType === "anonymous" ? "anonymous" : accountType === "linked" ? "google.com" : "custom";
  return Promise.resolve({
    uid,
    accountType,
    email,
    email_verified: Boolean(email),
    firebase: { sign_in_provider: provider, identities: {} },
  } as unknown as DecodedIdToken);
}

export type TestResponse = { status: number; body: any };

export async function startTestApp() {
  const db: Db = await createTestDb();
  setTokenVerifierForTests(fakeVerify);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    db,
    base,
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
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

export type TestApp = Awaited<ReturnType<typeof startTestApp>>;
