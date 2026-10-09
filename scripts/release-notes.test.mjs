import { expect, test } from "vitest";
import { nextVersion, notesFrom } from "./release-notes.mjs";

test("versions bump from the last tag (or from nothing)", () => {
  expect(nextVersion("", "patch")).toBe("v0.0.1");
  expect(nextVersion("v1.2.3", "patch")).toBe("v1.2.4");
  expect(nextVersion("v1.2.3", "minor")).toBe("v1.3.0");
  expect(nextVersion("v1.2.3", "major")).toBe("v2.0.0");
});

test("notes group conventional commits and skip merges and chores", () => {
  const notes = notesFrom([
    "feat(games): T11.8 Colour Sort (beta)",
    "fix(build): dedupe firebase",
    "ci: split workflows",
    "Merge branch 'x'",
    "docs: money log",
  ]);
  expect(notes).toContain("### New\n\n- **games:** T11.8 Colour Sort (beta)");
  expect(notes).toContain("### Fixed\n\n- **build:** dedupe firebase");
  expect(notes).toContain("### Docs");
  expect(notes).not.toContain("split workflows");
  expect(notes).not.toContain("Merge");
});
