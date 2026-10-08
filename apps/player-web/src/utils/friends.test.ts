import { expect, test } from "vitest";
import { cleanFriendCodeInput, friendErrorMessage, normalizeFriendCode } from "./friends";

test("input is cleaned as you type", () => {
  expect(cleanFriendCodeInput("ab3 c")).toBe("AB3C");
  expect(cleanFriendCodeInput("ab3-c9h-xx")).toBe("AB3C9H");
});

test("normalizes a code in any case, with spaces or dashes", () => {
  expect(normalizeFriendCode(" ab3-c9h ")).toBe("AB3C9H");
  expect(normalizeFriendCode("AB3C9H")).toBe("AB3C9H");
});

test("rejects things that can't be codes", () => {
  for (const bad of ["", null, undefined, "AB3C9", "AB3C9H2", "AB0C9H", "AB1C9H", "ABZC9H"]) {
    expect(normalizeFriendCode(bad), String(bad)).toBeNull();
  }
});

test("turns server codes into kind words, with a fallback", () => {
  expect(friendErrorMessage(new Error("already_friends"))).toBe("You're already friends!");
  expect(friendErrorMessage(new Error("weird"), "Try again")).toBe("Try again");
  expect(friendErrorMessage("nope", "Try again")).toBe("Try again");
});
