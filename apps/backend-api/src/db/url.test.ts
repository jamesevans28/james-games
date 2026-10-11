import { expect, test } from "vitest";
import { assertPoolerUrl } from "./url.js";

test("the direct Supabase host is refused with a helpful message; poolers pass", () => {
  expect(() =>
    assertPoolerUrl("DATABASE_URL", "postgresql://postgres:pw@db.abcdef.supabase.co:5432/postgres"),
  ).toThrow(/pooler/);
  expect(() =>
    assertPoolerUrl(
      "DATABASE_URL",
      "postgresql://postgres.abcdef:pw@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres",
    ),
  ).not.toThrow();
  expect(() => assertPoolerUrl("DATABASE_URL", "not a url")).toThrow(/valid/);
});
