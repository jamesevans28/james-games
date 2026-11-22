import { expect, test } from "vitest";
import { assertPoolerUrl, supabaseProjectRef } from "./url.js";

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

test("the Supabase project ref comes from the API host, the pooler user or the direct host", () => {
  expect(supabaseProjectRef("https://abcdef.supabase.co")).toBe("abcdef");
  expect(
    supabaseProjectRef(
      "postgresql://postgres.abcdef:pw@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres",
    ),
  ).toBe("abcdef");
  expect(supabaseProjectRef("postgresql://postgres:pw@db.abcdef.supabase.co:5432/postgres")).toBe(
    "abcdef",
  );
  expect(supabaseProjectRef("http://127.0.0.1:54321")).toBe("local");
  expect(supabaseProjectRef("postgresql://postgres:pw@localhost:54322/postgres")).toBe("local");
  expect(supabaseProjectRef("postgresql://postgres:pw@example.com:5432/postgres")).toBeNull();
  expect(supabaseProjectRef("pglite:.local/db")).toBeNull();
  expect(supabaseProjectRef("not a url")).toBeNull();
});
