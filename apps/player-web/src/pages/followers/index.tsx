import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  acceptFriendRequest,
  blockPlayer,
  declineFriendRequest,
  removeFriend,
  unblockPlayer,
} from "../../lib/api";
import ShareFollowCodeCard from "../../components/ShareFollowCodeCard";
import { OfflineBanner } from "../../components/OfflineBanner";
import { usePresenceReporter } from "../../hooks/usePresenceReporter";
import { useFriendAction, useFriendsSummary } from "../../hooks/useFriends";
import { friendErrorMessage } from "../../utils/friends";
import AddFriendForm from "./AddFriendForm";
import ConfirmDialog from "./ConfirmDialog";
import { PlayerRow, Section } from "./PlayerRow";

type Pending = { kind: "remove" | "block"; userId: string; name: string };

/**
 * Friends (T7.6): your code, add by code, requests, friends (with "online" only when
 * they share it), requests you sent, and the players you blocked.
 */
export default function FriendsPage() {
  const { data, isLoading, error } = useFriendsSummary();
  const { run, busy } = useFriendAction();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pending, setPending] = useState<Pending | null>(null);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  usePresenceReporter({ status: "home" });

  const act = async (action: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await run(action);
      setPending(null);
      setOpenRow(null);
    } catch (err) {
      setActionError(friendErrorMessage(err));
    }
  };

  const confirm = () => {
    if (!pending) return;
    const { kind, userId } = pending;
    void act(() => (kind === "remove" ? removeFriend(userId) : blockPlayer(userId)));
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-ink">Friends</h1>
        <Link to="/" className="text-sm text-ink-2 font-medium hover:text-brand py-3">
          Back to games
        </Link>
      </div>
      <OfflineBanner />
      {isLoading && <p className="text-ink-2">Loading…</p>}
      {error && !data && (
        <p className="text-base text-ink-2">
          {friendErrorMessage(error, "Couldn't load friends.")}
        </p>
      )}
      <p className="text-sm font-medium text-grape empty:hidden" aria-live="polite">
        {actionError}
      </p>

      {data && data.incoming.length > 0 && (
        <Section title="Friend requests">
          {data.incoming.map((r) => (
            <PlayerRow key={r.userId} player={r} detail={`Level ${r.level}`}>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-primary min-h-11"
                  disabled={busy}
                  onClick={() => void act(() => acceptFriendRequest(r.userId))}
                >
                  Yes!
                </button>
                <button
                  type="button"
                  className="btn btn-outline min-h-11"
                  disabled={busy}
                  onClick={() => void act(() => declineFriendRequest(r.userId))}
                >
                  Not now
                </button>
                <button
                  type="button"
                  className="ml-auto min-h-11 px-3 text-sm font-bold text-ink-2 hover:text-ink"
                  onClick={() =>
                    setPending({ kind: "block", userId: r.userId, name: r.screenName })
                  }
                >
                  Block
                </button>
              </div>
            </PlayerRow>
          ))}
        </Section>
      )}

      {data && (
        <Section title="Your friends">
          {data.friends.length === 0 ? (
            <p className="text-base text-ink-2">
              No friends yet. Swap friend codes with someone you know!
            </p>
          ) : (
            data.friends.map((f) => (
              <PlayerRow
                key={f.userId}
                player={f}
                linkToProfile
                online={f.online}
                detail={`Level ${f.level}`}
                options={{
                  open: openRow === f.userId,
                  onToggle: () => setOpenRow(openRow === f.userId ? null : f.userId),
                }}
              >
                {openRow === f.userId && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn btn-outline min-h-11"
                      onClick={() =>
                        setPending({ kind: "remove", userId: f.userId, name: f.screenName })
                      }
                    >
                      Remove friend
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline min-h-11"
                      onClick={() =>
                        setPending({ kind: "block", userId: f.userId, name: f.screenName })
                      }
                    >
                      Block
                    </button>
                  </div>
                )}
              </PlayerRow>
            ))
          )}
        </Section>
      )}

      {data && (
        <AddFriendForm
          initialCode={searchParams.get("code") ?? ""}
          run={run}
          onSent={() => setSearchParams({}, { replace: true })}
        />
      )}

      {data && <ShareFollowCodeCard friendCode={data.friendCode} />}

      {data && data.outgoing.length > 0 && (
        <Section title="Waiting for a yes">
          {data.outgoing.map((r) => (
            <PlayerRow key={r.userId} player={r} detail="Request sent">
              <button
                type="button"
                className="btn btn-outline min-h-11"
                disabled={busy}
                onClick={() => void act(() => declineFriendRequest(r.userId))}
              >
                Cancel request
              </button>
            </PlayerRow>
          ))}
        </Section>
      )}

      {data && data.blocked.length > 0 && (
        <Section title="Blocked">
          <p className="text-sm text-ink-2">
            You and these players can't see each other or send requests.
          </p>
          {data.blocked.map((b) => (
            <PlayerRow key={b.userId} player={b}>
              <button
                type="button"
                className="btn btn-outline min-h-11"
                disabled={busy}
                onClick={() => void act(() => unblockPlayer(b.userId))}
              >
                Unblock
              </button>
            </PlayerRow>
          ))}
        </Section>
      )}

      {pending && (
        <ConfirmDialog
          title={pending.kind === "remove" ? `Remove ${pending.name}?` : `Block ${pending.name}?`}
          body={
            pending.kind === "remove"
              ? "You won't be friends any more. You can always swap codes again later."
              : "You won't see each other, and they can't send you requests. You can unblock them on this page any time."
          }
          confirmLabel={pending.kind === "remove" ? "Remove" : "Block"}
          cancelLabel={pending.kind === "remove" ? "Keep friend" : "Cancel"}
          busy={busy}
          onConfirm={confirm}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
