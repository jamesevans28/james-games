import { describe, expect, test } from "vitest";
import { authUserFromClaims } from "./authGuards.js";

describe("authUserFromClaims", () => {
  test("an anonymous guest", () => {
    expect(
      authUserFromClaims({
        sub: "0b5e-guest",
        role: "authenticated",
        is_anonymous: true,
        app_metadata: { providers: [] },
      }),
    ).toEqual({
      userId: "0b5e-guest",
      email: undefined,
      emailVerified: false,
      isAnonymous: true,
      accountType: "anonymous",
      providers: [],
    });
  });

  test("a PIN account never exposes its synthetic email", () => {
    const user = authUserFromClaims({
      sub: "kid",
      role: "authenticated",
      email: "tilly_1@pin.games4james.com",
      is_anonymous: false,
      app_metadata: { account_type: "username_pin", providers: ["email"] },
    });
    expect(user).toMatchObject({
      userId: "kid",
      email: undefined,
      emailVerified: false,
      isAnonymous: false,
      accountType: "username_pin",
      providers: [],
    });
  });

  test("a Google account keeps the provider's email", () => {
    expect(
      authUserFromClaims({
        sub: "grown-up",
        role: "authenticated",
        email: "family@example.com",
        app_metadata: { account_type: "linked", providers: ["google"] },
      }),
    ).toMatchObject({ email: "family@example.com", emailVerified: true, accountType: "linked" });
  });

  test("unknown account types fall back to anonymous", () => {
    expect(
      authUserFromClaims({ sub: "x", role: "authenticated", app_metadata: { account_type: "x" } })
        ?.accountType,
    ).toBe("anonymous");
  });

  test("tokens that aren't a signed-in user's are refused", () => {
    expect(authUserFromClaims({ sub: "x", role: "anon" })).toBeNull();
    expect(authUserFromClaims({ sub: "x", role: "service_role" })).toBeNull();
    expect(authUserFromClaims({ sub: "x" })).toBeNull();
  });
});
