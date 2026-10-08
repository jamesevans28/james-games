import { test, expect } from "vitest";
import { ApiError, apiErrorFrom, isSigninRequired, shouldRetry } from "./apiError";

test("reads the server's error and code", async () => {
  const res = new Response(JSON.stringify({ error: "Too many tries", code: "throttled" }), {
    status: 429,
  });
  const err = await apiErrorFrom(res, "Failed");
  expect(err).toBeInstanceOf(ApiError);
  expect(err.status).toBe(429);
  expect(err.code).toBe("throttled");
  expect(err.message).toBe("Too many tries");
});

test("falls back when the body isn't JSON", async () => {
  const err = await apiErrorFrom(new Response("oops", { status: 500 }), "Failed to load");
  expect(err.code).toBe("http_500");
  expect(err.message).toBe("Failed to load: 500");
});

test("401 means sign in", async () => {
  const err = await apiErrorFrom(new Response("", { status: 401 }), "x");
  expect(isSigninRequired(err)).toBe(true);
  expect(err.code).toBe("signin_required");
  expect(err.message).toBe("signin_required");
  expect(isSigninRequired(new Error("signin_required"))).toBe(false);
});

test("retries network and server errors once, never 4xx", () => {
  expect(shouldRetry(0, new TypeError("Failed to fetch"))).toBe(true);
  expect(shouldRetry(1, new TypeError("Failed to fetch"))).toBe(false);
  expect(shouldRetry(0, new ApiError(503, "http_503"))).toBe(true);
  expect(shouldRetry(0, new ApiError(404, "http_404"))).toBe(false);
});
