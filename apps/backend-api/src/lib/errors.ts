/**
 * Reads the usual fields off a caught value without trusting its type.
 * `catch (err)` gives `unknown`; this keeps the checks short and type-safe.
 */
export function errorInfo(err: unknown): { message?: string; name?: string; code?: string } {
  if (!err || typeof err !== "object") return {};
  const e = err as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  return { message: str(e.message), name: str(e.name), code: str(e.code) };
}

/** True for DynamoDB's "condition not met" error (a lost race or a duplicate). */
export function isConditionalCheckFailed(err: unknown): boolean {
  return errorInfo(err).name === "ConditionalCheckFailedException";
}
