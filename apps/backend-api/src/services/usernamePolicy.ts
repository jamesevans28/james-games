/** The fields of a stored user row that username ownership depends on. */
export type UsernameOwner = { userId: string } | null | undefined;

/**
 * True when `username` already belongs to a different account than `uid`.
 * Applies to every account type, including old "migrated" rows: a username can
 * only be re-registered by the account that already owns it.
 */
export function isUsernameTakenByOther(existing: UsernameOwner, uid: string): boolean {
  return Boolean(existing && existing.userId !== uid);
}
