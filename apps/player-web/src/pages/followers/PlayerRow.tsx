import type { ReactNode } from "react";
import { Link } from "react-router";
import { ProfileAvatar } from "../../components/profile";

/** A titled card holding a list of players. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border border-line rounded-2xl bg-card shadow-card p-5">
      <h2 className="text-lg font-bold text-ink mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/**
 * One player: avatar, screen name, a detail line, an "Online" badge (only when they
 * share it) and, below, whatever actions the section needs.
 */
export function PlayerRow({
  player,
  detail,
  online = false,
  linkToProfile = false,
  options,
  children,
}: {
  player: { userId: string; screenName: string; avatar: number };
  detail?: string;
  online?: boolean;
  linkToProfile?: boolean;
  /** A "more" button that shows the row's actions. */
  options?: { open: boolean; onToggle: () => void };
  children?: ReactNode;
}) {
  const name = player.screenName || "Player";
  return (
    <div className="rounded-2xl border border-line bg-paper p-3">
      <div className="flex items-center gap-3">
        <ProfileAvatar user={{ avatar: player.avatar }} size={48} />
        <div className="min-w-0 flex-1">
          {linkToProfile ? (
            <Link
              to={`/profile/${player.userId}`}
              className="block truncate text-base font-bold text-ink hover:text-brand"
            >
              {name}
            </Link>
          ) : (
            <p className="truncate text-base font-bold text-ink">{name}</p>
          )}
          <p className="flex items-center gap-2 text-sm text-ink-2">
            {online && (
              <span className="inline-flex items-center gap-1 font-bold text-ink">
                <span className="h-2.5 w-2.5 rounded-full bg-grass" aria-hidden />
                Online
              </span>
            )}
            {detail && <span>{detail}</span>}
          </p>
        </div>
        {options && (
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-paper-2"
            onClick={options.onToggle}
            aria-expanded={options.open}
            aria-label={`Options for ${name}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>
        )}
      </div>
      {children && <div className="mt-3 empty:hidden">{children}</div>}
    </div>
  );
}
