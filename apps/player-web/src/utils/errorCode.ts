/**
 * A loggable summary of an error: its code or name, never the object itself.
 * Firebase errors can carry the user's email in `customData`, so raw errors must
 * not be logged (org rule: no PII in logs).
 */
export function errorCode(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { code?: unknown; name?: unknown };
    if (typeof e.code === "string") return e.code;
    if (typeof e.name === "string") return e.name;
  }
  return "error";
}
