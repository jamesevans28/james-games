import { expect, test } from "vitest";
import { dispatchBack } from "./backButton";

test("with no screen handling it, back falls through to the default", () => {
  expect(dispatchBack()).toBe(false);
});
