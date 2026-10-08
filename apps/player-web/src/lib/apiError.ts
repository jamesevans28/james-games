/**
 * The one error type the API client throws (T7.10). `status` is the HTTP status
 * (0 when the request never reached the server); `code` is the server's `code`
 * field when it sent one, otherwise a short generic code.
 *
 * Never log an ApiError's message as-is from auth endpoints; log `code` instead.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

/** True for 401s: the caller needs to sign in (again). */
export function isSigninRequired(err: unknown): boolean {
  return isApiError(err) && (err.status === 401 || err.code === "signin_required");
}

/**
 * Builds an ApiError from a failed response, using the `{ error, code }` body when
 * the server sent one.
 */
export async function apiErrorFrom(res: Response, fallback: string): Promise<ApiError> {
  const signin = res.status === 401;
  let code = signin ? "signin_required" : `http_${res.status}`;
  let message = signin ? "signin_required" : `${fallback}: ${res.status}`;
  try {
    const body = (await res.json()) as { error?: unknown; code?: unknown };
    if (typeof body.code === "string" && body.code) code = body.code;
    if (typeof body.error === "string" && body.error) message = body.error;
  } catch {
    // not JSON: keep the generic code and message
  }
  return new ApiError(res.status, code, message);
}

/** Retry policy for queries: never retry a 4xx (it won't change); retry anything else once. */
export function shouldRetry(failureCount: number, err: unknown): boolean {
  if (isApiError(err) && err.status >= 400 && err.status < 500) return false;
  return failureCount < 1;
}
