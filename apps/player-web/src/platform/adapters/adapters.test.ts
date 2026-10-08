import { afterEach, expect, test, vi } from "vitest";
import { adapters, isNativeShell, setAdaptersForTests } from "./index";
import { webAdapters, webStorage } from "./web";

afterEach(() => {
  vi.unstubAllGlobals();
  setAdaptersForTests(null);
});

test("web storage never throws when storage is blocked", () => {
  const blocked = webStorage(() => {
    throw new Error("SecurityError");
  });
  expect(blocked.get("k")).toBeNull();
  expect(() => blocked.set("k", "v")).not.toThrow();
  expect(() => blocked.remove("k")).not.toThrow();
});

test("the web is not the native shell; Capacitor's flag is", () => {
  expect(isNativeShell()).toBe(false);
  vi.stubGlobal("Capacitor", { isNativePlatform: () => true });
  expect(isNativeShell()).toBe(true);
});

test("share falls back to the clipboard when there's no share sheet", async () => {
  const writeText = vi.fn(() => Promise.resolve());
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  expect(await webAdapters.share.share({ title: "t", url: "https://x.test/" })).toBe("copied");
  expect(writeText).toHaveBeenCalledWith("https://x.test/");
});

test("adapters can be swapped for tests", () => {
  const fake = { ...webAdapters, app: { ...webAdapters.app, platform: "ios" as const } };
  setAdaptersForTests(fake);
  expect(adapters.app.platform).toBe("ios");
});
