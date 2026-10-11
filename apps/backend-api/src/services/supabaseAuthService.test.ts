import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { SignJWT, exportJWK, generateKeyPair, type CryptoKey, type JWTPayload } from "jose";
import { config } from "../config/index.js";
import { isSyntheticEmail, syntheticEmail, verifyAccessToken } from "./supabaseAuthService.js";

// A stand-in for https://<ref>.supabase.co/auth/v1/.well-known/jwks.json with one ES256 key.
let server: Server;
let issuer: string;
let signingKey: CryptoKey;
let otherKey: CryptoKey;

beforeAll(async () => {
  const pair = await generateKeyPair("ES256");
  signingKey = pair.privateKey;
  otherKey = (await generateKeyPair("ES256")).privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: "test-key", alg: "ES256", use: "sig" };
  server = createServer((req, res) => {
    if (req.url !== "/auth/v1/.well-known/jwks.json") return void res.writeHead(404).end();
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  config.supabase.url = origin;
  issuer = `${origin}/auth/v1`;
});

afterAll(async () => {
  config.supabase.url = "";
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function token(
  claims: JWTPayload,
  opts: { key?: CryptoKey; issuer?: string; audience?: string; expiresIn?: string } = {},
) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "ES256", kid: "test-key" })
    .setIssuer(opts.issuer ?? issuer)
    .setAudience(opts.audience ?? "authenticated")
    .setIssuedAt()
    .setExpirationTime(opts.expiresIn ?? "1h")
    .sign(opts.key ?? signingKey);
}

describe("verifyAccessToken", () => {
  test("accepts a token signed by the project key and returns its claims", async () => {
    const claims = await verifyAccessToken(
      await token({
        sub: "8d0f1c2e-guest",
        role: "authenticated",
        is_anonymous: true,
        app_metadata: { providers: ["anonymous"] },
      }),
    );
    expect(claims).toMatchObject({
      sub: "8d0f1c2e-guest",
      role: "authenticated",
      is_anonymous: true,
    });
  });

  test("rejects a wrong key, issuer, audience, an expired token and a token without a subject", async () => {
    const claims = { sub: "x", role: "authenticated" };
    await expect(verifyAccessToken(await token(claims, { key: otherKey }))).rejects.toThrow();
    await expect(
      verifyAccessToken(await token(claims, { issuer: "https://evil.example/auth/v1" })),
    ).rejects.toThrow();
    await expect(verifyAccessToken(await token(claims, { audience: "anon" }))).rejects.toThrow();
    await expect(verifyAccessToken(await token(claims, { expiresIn: "-1m" }))).rejects.toThrow();
    await expect(verifyAccessToken(await token({ role: "authenticated" }))).rejects.toThrow();
    await expect(verifyAccessToken("not-a-jwt")).rejects.toThrow();
  });
});

test("synthetic emails are lower-case and recognised", () => {
  expect(syntheticEmail("Tilly_1")).toBe("tilly_1@pin.games4james.com");
  expect(isSyntheticEmail("TILLY_1@PIN.GAMES4JAMES.COM")).toBe(true);
  expect(isSyntheticEmail("family@example.com")).toBe(false);
  expect(isSyntheticEmail(undefined)).toBe(false);
});
