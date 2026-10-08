import { expect, test } from "vitest";
import {
  isValidAvatar,
  isValidPin,
  isValidPrefs,
  isValidUsername,
  normalizeUsername,
} from "./usernamePolicy.js";

test("usernames are 3-20 letters, digits or underscores", () => {
  expect(isValidUsername("tilly_2")).toBe(true);
  expect(isValidUsername("ab")).toBe(false);
  expect(isValidUsername("a".repeat(21))).toBe(false);
  expect(isValidUsername("has space")).toBe(false);
  expect(isValidUsername(42)).toBe(false);
  expect(normalizeUsername("Tilly")).toBe("tilly");
});

test("PINs are exactly 6 digits", () => {
  expect(isValidPin("123456")).toBe(true);
  expect(isValidPin("1234")).toBe(false);
  expect(isValidPin("12345678")).toBe(false);
  expect(isValidPin("1234567")).toBe(false);
  expect(isValidPin("12a4")).toBe(false);
});

test("avatars and preferences", () => {
  expect(isValidAvatar(3)).toBe(true);
  expect(isValidAvatar(0)).toBe(false);
  expect(isValidAvatar(1.5)).toBe(false);
  expect(isValidAvatar("3")).toBe(false);
  expect(isValidPrefs({ theme: "dark" })).toBe(true);
  expect(isValidPrefs([])).toBe(false);
  expect(isValidPrefs(null)).toBe(false);
  expect(isValidPrefs({ big: "x".repeat(5000) })).toBe(false);
});
