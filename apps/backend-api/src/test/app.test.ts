import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestApp, type TestApp } from "./app.js";

describe("test harness", () => {
  let api: TestApp;
  beforeAll(async () => {
    api = await startTestApp();
  });
  afterAll(() => api.close());

  it("serves 404 JSON and rejects admin routes for non-admins", async () => {
    expect(await api.request("GET", "/nope")).toEqual({
      status: 404,
      body: { error: "not_found" },
    });
    await api.addUser({ id: "kid" });
    await api.addUser({ id: "boss", admin: true });
    expect((await api.request("GET", "/admin/metrics/dashboard")).status).toBe(401);
    expect((await api.request("GET", "/admin/metrics/dashboard", { as: "kid" })).status).toBe(403);
  });
});
