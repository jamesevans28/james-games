import { Link, useNavigate } from "react-router";
import Seo from "../../components/Seo";
import Sticker from "../../components/stickers/Sticker";
import { ProfileAvatar } from "../../components/profile";
import { useAuth } from "../../context/FirebaseAuthProvider";
import { usePresenceReporter } from "../../hooks/usePresenceReporter";
import { SITE_URL } from "../../utils/seoKeywords";
import { brand, makersLine } from "../../config/brand";
import { dailyPlayPath, dayLabel } from "./dailyRules";
import { useDaily } from "./useDaily";

/**
 * Today's challenge (T11.3): one game for everyone, with the same start, and a
 * board for the day. Your first run of the day is the one that counts.
 */
export default function DailyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const daily = useDaily();
  const { game, myRun, board } = daily;
  usePresenceReporter({ status: "home" });

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      <Seo
        title={`Today's challenge | ${brand.name}`}
        description={`One game a day, the same for everyone. Can you top today's board on ${brand.name}?`}
        url={`${SITE_URL}/daily`}
        canonical={`${SITE_URL}/daily`}
      />

      <header>
        <h1 className="font-display text-3xl font-extrabold text-ink">Today&apos;s challenge</h1>
        <p className="mt-1 text-base font-semibold text-ink-2">{dayLabel(daily.day)}</p>
      </header>

      {daily.isLoading && !game && <p className="text-base text-ink-2">Loading…</p>}

      {!daily.isLoading && !game && (
        <p className="text-base text-ink-2">No challenge today. Come back tomorrow!</p>
      )}

      {game && (
        <section className="card overflow-hidden p-0">
          <div className="flex items-center gap-4 p-4">
            <img
              src={game.thumbnail || brand.logoMark}
              alt=""
              width={96}
              height={96}
              className="h-24 w-24 shrink-0 rounded-2xl border-2 border-edge bg-paper-2 object-contain"
            />
            <div className="min-w-0">
              <h2 className="font-display text-2xl font-extrabold leading-tight text-ink">
                {game.title}
              </h2>
              <p className="truncate text-sm text-ink-2">
                by {makersLine(game.makers ?? brand.makers)}
              </p>
              <p className="mt-1 text-sm font-semibold text-ink-2">
                Everyone gets the same game today, with the same start.
              </p>
            </div>
          </div>
          <div className="border-t-2 border-line px-4 py-4">
            {myRun ? (
              <p className="mb-3 text-base font-bold text-ink">
                Your score today: <span className="text-brand">{myRun.score.toLocaleString()}</span>
                <span className="block text-sm font-semibold text-ink-2">
                  More goes are just for fun. Come back tomorrow for a new one!
                </span>
              </p>
            ) : (
              <p className="mb-3 text-sm font-semibold text-ink-2">
                Your first go today is the one that counts.
              </p>
            )}
            <Link
              to={dailyPlayPath(game.id, daily.day)}
              className="btn btn-primary w-full py-4 text-xl"
            >
              {myRun ? "Play again" : "Play today's challenge"}
            </Link>
            {!user && (
              <p className="mt-3 text-center text-sm text-ink-2">
                <Link to="/login" className="font-bold underline underline-offset-4">
                  Sign in
                </Link>{" "}
                to get on today&apos;s board.
              </p>
            )}
          </div>
        </section>
      )}

      <section className="flex items-center gap-3 rounded-2xl border-2 border-line bg-card px-4 py-3">
        <Sticker id="daily-trio" size={48} className="shrink-0" />
        <p className="text-sm font-semibold text-ink-2">
          Play the challenge on 3 days in one week to get the Daily trio sticker.
        </p>
      </section>

      {game && (
        <section>
          <h2 className="mb-3 font-display text-xl font-extrabold text-ink">
            Today&apos;s top scores
          </h2>
          {!daily.online && !daily.isLoading && (
            <p className="text-base text-ink-2">
              Scores will show up here when you&apos;re online.
            </p>
          )}
          {daily.online && board.length === 0 && (
            <p className="text-base text-ink-2">No scores yet today. Yours could be the first!</p>
          )}
          {board.length > 0 && (
            <ol className="card overflow-hidden p-0">
              {board.map((r, i) => {
                const isMe = r.userId === user?.userId;
                return (
                  <li key={r.userId}>
                    <button
                      type="button"
                      className={`flex min-h-14 w-full items-center gap-3 border-b border-line px-4 py-2 text-left last:border-b-0 hover:bg-paper-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                        isMe ? "bg-brand/10" : ""
                      }`}
                      onClick={() => void navigate(`/profile/${r.userId}`)}
                    >
                      <span className="w-7 text-base font-extrabold text-ink-3">{i + 1}</span>
                      <ProfileAvatar user={{ avatar: r.avatar }} size={32} />
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block truncate text-base font-bold ${isMe ? "text-brand" : "text-ink"}`}
                        >
                          {r.screenName}
                        </span>
                        <span className="block text-sm text-ink-2">Level {r.level}</span>
                      </span>
                      <span
                        className={`font-mono text-base font-extrabold ${isMe ? "text-brand" : "text-ink"}`}
                      >
                        {r.score.toLocaleString()}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}
