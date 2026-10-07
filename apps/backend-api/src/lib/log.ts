/**
 * Structured logging with no personal data (org rule: no PII in logs).
 *
 * - One JSON line per event: { level, event, ...fields }.
 * - Field names that identify a person are dropped, whatever their value.
 * - Errors are reduced to name, code and a short message with emails scrubbed;
 *   the raw error object (which can carry tokens, emails or request data) is never logged.
 */
export type LogValue = string | number | boolean | null | undefined;
export type LogFields = Record<string, LogValue>;

const IDENTIFYING_KEYS = new Set([
  "email", "username", "screenname", "displayname", "name", "userid", "uid", "targetuserid",
  "token", "idtoken", "customtoken", "pin", "pinhash", "password", "phone", "ip",
]);

const EMAIL = /[^\s@"'<>]+@[^\s@"'<>]+\.[^\s@"'<>]+/g;

function scrub(text: string): string {
  return text.replace(EMAIL, "[email]").slice(0, 200);
}

export function safeFields(fields: LogFields = {}): LogFields {
  const out: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (IDENTIFYING_KEYS.has(key.toLowerCase())) continue;
    out[key] = typeof value === "string" ? scrub(value) : value;
  }
  return out;
}

export function errorFields(err: unknown): LogFields {
  if (!err || typeof err !== "object") return err === undefined ? {} : { error: scrub(String(err)) };
  const e = err as { name?: unknown; code?: unknown; message?: unknown };
  return {
    errorName: typeof e.name === "string" ? e.name : undefined,
    errorCode: typeof e.code === "string" || typeof e.code === "number" ? e.code : undefined,
    errorMessage: typeof e.message === "string" ? scrub(e.message) : undefined,
  };
}

function emit(level: "info" | "warn" | "error", event: string, fields?: LogFields, err?: unknown) {
  const line = JSON.stringify({ level, event, ...safeFields(fields), ...errorFields(err) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const log = {
  info: (event: string, fields?: LogFields) => emit("info", event, fields),
  warn: (event: string, fields?: LogFields, err?: unknown) => emit("warn", event, fields, err),
  error: (event: string, fields?: LogFields, err?: unknown) => emit("error", event, fields, err),
};
