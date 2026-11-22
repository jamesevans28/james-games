import { test, expect } from "vitest";
import { pinLengthOk } from "./pinRules";

test("sign-in takes 4 to 6 digits, for players from the old site", () => {
  expect(pinLengthOk("login", "123")).toBe(false);
  expect(pinLengthOk("login", "1234")).toBe(true);
  expect(pinLengthOk("login", "123456")).toBe(true);
});

test("a new account still needs 6 digits", () => {
  expect(pinLengthOk("register", "1234")).toBe(false);
  expect(pinLengthOk("register", "123456")).toBe(true);
});
