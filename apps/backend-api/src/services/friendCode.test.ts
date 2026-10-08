import { expect, test } from "vitest";
import { normalizeFriendCode } from "./friendCode.js";

test("accepts any case, spaces and dashes", () => {
  expect(normalizeFriendCode("ab3c9h")).toBe("AB3C9H");
  expect(normalizeFriendCode(" AB3-C9H ")).toBe("AB3C9H");
  expect(normalizeFriendCode("ab3 c9h")).toBe("AB3C9H");
});

test("rejects anything that can't be a code", () => {
  for (const bad of [
    "",
    "AB3C9",
    "AB3C9H2",
    "AB3C0H",
    "AB1C9H",
    "ABZC9H",
    "AB3C9I",
    123456,
    null,
  ]) {
    expect(normalizeFriendCode(bad), String(bad)).toBeNull();
  }
});
