import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createFamilyCode,
  fetchFamily,
  joinFamily,
  unlinkFamilyKid,
  type FamilyKid,
} from "../../lib/api";
import { isApiError } from "../../lib/apiError";
import { queryKeys } from "../../lib/queryClient";
import { useAuth } from "../../context/FirebaseAuthProvider";
import { ProfileAvatar } from "../../components/profile";
import { barHeights, familyErrorText, formatPlayTime, weekdayOf } from "./familyFormat";

const MAX_GROWN_UPS = 2;

/** The server's error code (ApiError keeps it as the message). */
function errorText(err: unknown): string {
  return familyErrorText(isApiError(err) ? err.message : undefined);
}

/**
 * Settings → "Family" (T11.7). A grown-up makes a code; the kid types it in on their
 * own account. The grown-up then sees each linked kid's plays and play time for the
 * last 7 days. Both accounts need a username.
 */
export default function FamilySection() {
  const { user } = useAuth();
  const registered = Boolean(user && !user.isAnonymous && user.accountType !== "anonymous");
  const client = useQueryClient();
  const family = useQuery({
    queryKey: [...queryKeys.family, user?.userId ?? null],
    queryFn: fetchFamily,
    enabled: registered,
  });
  const refresh = () => client.invalidateQueries({ queryKey: queryKeys.family });

  return (
    <section className="p-5 bg-card rounded-2xl border border-line mb-6">
      <h2 className="text-lg font-bold mb-1 text-ink">Family</h2>
      {!registered ? (
        <p className="text-sm text-ink-2">
          A grown-up can link to a kid&rsquo;s account to see how much they play. Both accounts need
          a username first.{" "}
          <Link to="/login" className="font-bold text-brand underline underline-offset-4">
            Make a username
          </Link>
        </p>
      ) : (
        <>
          <p className="text-sm text-ink-2">
            A grown-up can see how long a kid plays each day. Grown-ups make a code here; kids type
            it in on their own account.
          </p>
          {family.isError && (
            <p className="mt-3 text-sm font-medium text-grape" role="alert">
              Couldn&rsquo;t load your family just now.
            </p>
          )}
          <KidsList kids={family.data?.kids ?? []} onChanged={refresh} />
          <MakeCode />
          <JoinWithCode
            grownUps={family.data?.grownUps ?? []}
            loaded={family.isSuccess}
            onJoined={refresh}
          />
        </>
      )}
    </section>
  );
}

function MakeCode() {
  const make = useMutation({ mutationFn: createFamilyCode });
  const code = make.data;
  return (
    <div className="mt-5">
      <h3 className="text-base font-bold text-ink">For grown-ups</h3>
      {code ? (
        <div className="mt-2 rounded-2xl border-2 border-edge bg-paper-2 p-4 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-2">Family code</p>
          <p className="mt-1 font-display text-4xl font-extrabold tracking-[0.2em] text-ink">
            {code.code}
          </p>
          <p className="mt-2 text-sm text-ink-2">
            On your kid&rsquo;s account, open Settings → Family and type it in. It works until{" "}
            {new Date(code.expiresAt).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}
            .
          </p>
        </div>
      ) : (
        <p className="mt-1 text-sm text-ink-2">
          Make a code, then type it in on your kid&rsquo;s account. It works for 15 minutes.
        </p>
      )}
      <button
        type="button"
        className="btn btn-outline mt-3 w-full"
        disabled={make.isPending}
        onClick={() => make.mutate()}
      >
        {code ? "Make a new code" : "Make a family code"}
      </button>
      {make.isError && (
        <p className="mt-2 text-sm font-medium text-grape" role="alert">
          {errorText(make.error)}
        </p>
      )}
    </div>
  );
}

function JoinWithCode({
  grownUps,
  loaded,
  onJoined,
}: {
  grownUps: { userId: string; screenName: string }[];
  loaded: boolean;
  onJoined: () => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const join = useMutation({
    mutationFn: (value: string) => joinFamily(value),
    onSuccess: async () => {
      setCode("");
      await onJoined();
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (code.trim()) join.mutate(code.trim());
  };
  const full = grownUps.length >= MAX_GROWN_UPS;

  return (
    <div className="mt-5">
      <h3 className="text-base font-bold text-ink">For kids</h3>
      {grownUps.length > 0 && (
        <p className="mt-1 text-sm text-ink-2">
          Linked to:{" "}
          <span className="font-bold text-ink">
            {grownUps.map((g) => g.screenName).join(" and ")}
          </span>
          . They can see how long you play.
        </p>
      )}
      {join.isSuccess && (
        <p className="mt-2 text-sm font-bold text-grass" aria-live="polite">
          Linked to {join.data.grownUp.screenName}!
        </p>
      )}
      {loaded && full ? (
        <p className="mt-1 text-sm text-ink-2">
          That&rsquo;s two grown-ups, the most there can be.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-2 flex gap-2">
          <label className="sr-only" htmlFor="family-code">
            Code from your grown-up
          </label>
          <input
            id="family-code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={8}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="Code from your grown-up"
            className="min-h-11 min-w-0 flex-1 bg-paper-2 border border-line rounded-xl px-4 py-2 text-base font-bold tracking-widest text-ink placeholder-ink-3 placeholder:font-normal placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-brand/50"
          />
          <button
            type="submit"
            className="btn btn-primary shrink-0"
            disabled={join.isPending || !code.trim()}
          >
            Link
          </button>
        </form>
      )}
      {join.isError && (
        <p className="mt-2 text-sm font-medium text-grape" role="alert">
          {errorText(join.error)}
        </p>
      )}
    </div>
  );
}

function KidsList({ kids, onChanged }: { kids: FamilyKid[]; onChanged: () => Promise<void> }) {
  if (kids.length === 0) return null;
  return (
    <div className="mt-4 space-y-3">
      <h3 className="text-base font-bold text-ink">Your kids this week</h3>
      {kids.map((kid) => (
        <KidCard key={kid.userId} kid={kid} onChanged={onChanged} />
      ))}
    </div>
  );
}

function KidCard({ kid, onChanged }: { kid: FamilyKid; onChanged: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const unlink = useMutation({
    mutationFn: () => unlinkFamilyKid(kid.userId),
    onSuccess: onChanged,
  });
  const heights = barHeights(kid.days.map((d) => d.playMs));
  const name = kid.screenName || "Player";

  return (
    <div className="rounded-2xl border border-line bg-paper p-3">
      <div className="flex items-center gap-3">
        <ProfileAvatar user={{ avatar: kid.avatar }} size={48} />
        <div className="min-w-0 flex-1">
          <Link
            to={`/profile/${kid.userId}`}
            className="block truncate text-base font-bold text-ink hover:text-brand"
          >
            {name}
          </Link>
          <p className="text-sm text-ink-2">
            {formatPlayTime(kid.totalPlayMs)} · {kid.totalPlays}{" "}
            {kid.totalPlays === 1 ? "game" : "games"} in 7 days
          </p>
        </div>
      </div>

      {/* Play time per day: one bar per day, today on the right. */}
      <div className="mt-3 flex h-24 items-end gap-0.5" aria-hidden>
        {kid.days.map((d, i) => (
          <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end">
            <div
              className="w-full max-w-7 rounded-t bg-sky"
              style={{ height: `${Math.max(heights[i] ?? 0, d.playMs > 0 ? 4 : 0)}%` }}
              title={`${weekdayOf(d.day)}: ${formatPlayTime(d.playMs)}, ${d.plays} ${d.plays === 1 ? "game" : "games"}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-0.5 border-t border-line pt-1" aria-hidden>
        {kid.days.map((d, i) => (
          <span
            key={d.day}
            className={`flex-1 text-center text-xs ${i === kid.days.length - 1 ? "font-bold text-ink" : "text-ink-2"}`}
          >
            {i === kid.days.length - 1 ? "Today" : weekdayOf(d.day)}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{name}&rsquo;s play time, last 7 days</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Play time</th>
            <th scope="col">Games</th>
          </tr>
        </thead>
        <tbody>
          {kid.days.map((d) => (
            <tr key={d.day}>
              <th scope="row">{d.day}</th>
              <td>{formatPlayTime(d.playMs)}</td>
              <td>{d.plays}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3">
        {confirming ? (
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-outline flex-1"
              disabled={unlink.isPending}
              onClick={() => unlink.mutate()}
            >
              Yes, unlink
            </button>
            <button
              type="button"
              className="btn btn-outline flex-1"
              onClick={() => setConfirming(false)}
            >
              Keep
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="min-h-11 text-sm font-bold text-ink-2 underline underline-offset-4"
            onClick={() => setConfirming(true)}
          >
            Unlink {name}
          </button>
        )}
        {unlink.isError && (
          <p className="mt-2 text-sm font-medium text-grape" role="alert">
            {errorText(unlink.error)}
          </p>
        )}
      </div>
    </div>
  );
}
