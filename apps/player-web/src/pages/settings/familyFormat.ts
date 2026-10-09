/** Pure helpers for Settings → Family (T11.7). */

/** "0 min", "45 min", "1 h", "1 h 5 min". Rounds to the nearest minute. */
export function formatPlayTime(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60_000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** "Mon" for "2026-10-05". The date is a local calendar day, so read it as UTC. */
export function weekdayOf(day: string): string {
  const t = Date.parse(`${day}T00:00:00Z`);
  return Number.isNaN(t) ? "" : (WEEKDAYS[new Date(t).getUTCDay()] ?? "");
}

/** Height of each day's bar as a percentage of the busiest day (0 when nobody played). */
export function barHeights(values: readonly number[]): number[] {
  const max = Math.max(0, ...values);
  return values.map((v) => (max > 0 ? Math.round((Math.max(0, v) / max) * 100) : 0));
}

/** A friendly line for an error code the /family endpoints send. */
export function familyErrorText(code: string | undefined): string {
  switch (code) {
    case "code_not_found":
      return "That code didn't work. Check it and try again?";
    case "code_expired":
      return "That code has run out. Ask your grown-up for a new one.";
    case "too_many_grown_ups":
      return "This account already has two grown-ups linked.";
    case "cant_link_self":
      return "That's your own code! Type it in on the kid's account.";
    case "too_many_tries":
      return "Lots of tries! Wait a few minutes, then try again.";
    case "account_upgrade_required":
      return "Make a username first, then try again.";
    default:
      return "That didn't work. Try again?";
  }
}
