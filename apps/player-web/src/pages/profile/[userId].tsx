import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  acceptFriendRequest,
  blockPlayer,
  declineFriendRequest,
  fetchMyStickers,
  fetchUserProfile,
  type ProfileResponse,
} from "../../lib/api";
import { queryKeys } from "../../lib/queryClient";
import { ProfileAvatar } from "../../components/profile";
import ShareFollowCodeCard from "../../components/ShareFollowCodeCard";
import Sticker from "../../components/stickers/Sticker";
import StickerBook from "../../components/stickers/StickerBook";
import { ExperienceBar } from "../../components/ExperienceBar";
import Seo from "../../components/Seo";
import { useAuth } from "../../context/FirebaseAuthProvider";
import { usePresenceReporter } from "../../hooks/usePresenceReporter";
import { useFriendAction } from "../../hooks/useFriends";
import { friendErrorMessage } from "../../utils/friends";
import { SITE_URL } from "../../utils/seoKeywords";
import { brand } from "../../config/brand";
import ConfirmDialog from "../followers/ConfirmDialog";

/**
 * A player's profile (T7.6): screen name, avatar, level and stickers. No friend
 * lists, counts or last-seen. Friends also see when they became friends.
 */
export default function ProfilePage() {
  const { userId = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { run, busy } = useFriendAction();
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  usePresenceReporter({ status: "home" });

  const { data, isLoading, error } = useQuery({
    queryKey: [...queryKeys.profile(userId), user?.userId ?? null],
    queryFn: () => fetchUserProfile(userId),
    enabled: Boolean(userId),
  });
  // Your own sticker book needs every sticker, not just the newest on the profile.
  const isSelf = Boolean(data?.isSelf);
  const mine = useQuery({
    queryKey: [...queryKeys.stickers, user?.userId ?? null],
    queryFn: fetchMyStickers,
    enabled: isSelf,
  });

  const act = async (action: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await run(action);
    } catch (err) {
      setActionError(friendErrorMessage(err));
    }
  };

  if (isLoading) return <div className="p-4 text-ink-2 font-medium">Loading profile…</div>;
  if (error) {
    return (
      <div className="p-4 text-base text-ink-2">
        We couldn't load this profile. Check your connection and try again.
      </div>
    );
  }
  if (!data) {
    return (
      <div className="p-4 space-y-2">
        <p className="text-lg font-bold text-ink">We couldn't find that player.</p>
        <Link to="/" className="text-ink-2 hover:text-brand font-medium">
          ← Back to games
        </Link>
      </div>
    );
  }

  const { profile } = data;
  const canBlock = Boolean(user) && !data.isSelf;

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      <Seo
        title={`${profile.screenName} | ${brand.name}`}
        description={`${profile.screenName} on ${brand.name}.`}
        url={`${SITE_URL}/profile/${userId}`}
        canonical={`${SITE_URL}/profile/${userId}`}
        noindex={true}
      />

      <div className="flex items-center gap-4">
        {data.isSelf ? (
          <Link
            to="/settings/avatar"
            className="rounded-full focus:outline-none focus:ring-2 focus:ring-brand/50"
            aria-label="Change avatar"
          >
            <ProfileAvatar user={{ avatar: profile.avatar }} size={72} />
          </Link>
        ) : (
          <ProfileAvatar user={{ avatar: profile.avatar }} size={72} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-2xl font-extrabold text-ink">{profile.screenName}</h1>
            {data.isSelf && (
              <Link
                to="/settings"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-2 hover:text-brand"
                aria-label="Change screen name"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M13.5 6.5L17.5 10.5M5 19H9L19 9C19.8284 8.17157 19.8284 6.82843 19 6L18 5C17.1716 4.17157 15.8284 4.17157 15 5L5 15V19Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            )}
          </div>
          {data.isSelf && user?.experience ? (
            <div className="mt-2">
              <ExperienceBar
                level={user.experience.level}
                progress={user.experience.progress}
                required={user.experience.required}
              />
            </div>
          ) : (
            <span className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-ink bg-accent/30 px-3 py-1 rounded-full border border-accent">
              ⭐ Level {profile.level}
            </span>
          )}
        </div>
      </div>

      <FriendshipPanel data={data} busy={busy} act={act} />
      <p className="text-sm font-medium text-grape empty:hidden" aria-live="polite">
        {actionError}
      </p>

      {data.isSelf ? (
        <section className="border border-line rounded-2xl bg-card shadow-card p-5">
          <h2 className="text-lg font-bold text-ink mb-3">Sticker book</h2>
          <StickerBook collected={mine.data?.map((s) => s.id) ?? data.stickers} />
        </section>
      ) : (
        <section className="border border-line rounded-2xl bg-card shadow-card p-5">
          <h2 className="text-lg font-bold text-ink mb-3">Stickers</h2>
          {data.stickers.length === 0 ? (
            <p className="text-base text-ink-2">No stickers yet.</p>
          ) : (
            <ul className="flex flex-wrap gap-3">
              {data.stickers.map((id) => (
                <li key={id}>
                  <Sticker id={id} size={48} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {data.isSelf && data.friendCode && (
        <ShareFollowCodeCard friendCode={data.friendCode}>
          <Link to="/followers" className="text-sm font-bold text-brand hover:underline">
            See your friends →
          </Link>
        </ShareFollowCodeCard>
      )}

      {canBlock && (
        <div className="text-center">
          <button
            type="button"
            className="min-h-11 px-4 text-sm font-bold text-ink-2 hover:text-ink"
            onClick={() => setConfirmBlock(true)}
          >
            Block {profile.screenName}
          </button>
        </div>
      )}

      {confirmBlock && (
        <ConfirmDialog
          title={`Block ${profile.screenName}?`}
          body="You won't see each other, and they can't send you requests. You can unblock them on your Friends page any time."
          confirmLabel="Block"
          busy={busy}
          onCancel={() => setConfirmBlock(false)}
          onConfirm={() =>
            void run(() => blockPlayer(profile.userId))
              .then(() => navigate(user && !user.isAnonymous ? "/followers" : "/"))
              .catch((err: unknown) => {
                setConfirmBlock(false);
                setActionError(friendErrorMessage(err));
              })
          }
        />
      )}
    </div>
  );
}

/** "Friends since…", a pending request, or nothing. Friends are only made by code. */
function FriendshipPanel({
  data,
  busy,
  act,
}: {
  data: ProfileResponse;
  busy: boolean;
  act: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const otherId = data.profile.userId;
  switch (data.friendship) {
    case "friends":
      return (
        <p className="inline-flex items-center gap-2 rounded-full border border-grass bg-grass/15 px-4 py-2 text-sm font-bold text-ink">
          Friends
          {data.friendsSince &&
            ` since ${new Date(data.friendsSince).toLocaleDateString(undefined, {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}`}
        </p>
      );
    case "request_sent":
      return <p className="text-base text-ink-2">Friend request sent. Now we wait for a yes!</p>;
    case "request_received":
      return (
        <div className="border border-line rounded-2xl bg-card shadow-card p-4 space-y-3">
          <p className="text-base font-bold text-ink">
            {data.profile.screenName} wants to be friends.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary min-h-11"
              disabled={busy}
              onClick={() => void act(() => acceptFriendRequest(otherId))}
            >
              Yes!
            </button>
            <button
              type="button"
              className="btn btn-outline min-h-11"
              disabled={busy}
              onClick={() => void act(() => declineFriendRequest(otherId))}
            >
              Not now
            </button>
          </div>
        </div>
      );
    default:
      return null;
  }
}
