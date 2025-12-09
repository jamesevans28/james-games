import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Gamepad2, LineChart, Users } from "lucide-react";
import { adminApi, DashboardMetrics } from "../lib/api";

const numberFormatter = new Intl.NumberFormat("en-US");

export function HomePage() {
  const metricsQuery = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: adminApi.getDashboardMetrics,
  });

  const metrics = metricsQuery.data;
  const timeframeLabel = useMemo(() => {
    if (!metrics) return "";
    const since = new Date(metrics.timeframe.since);
    return since.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }, [metrics]);

  return (
    <div className="space-y-6 px-6 py-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Command Center</p>
          <h1 className="text-3xl font-semibold text-white">Platform Pulse</h1>
          {metrics && (
            <p className="text-sm text-slate-400">
              Tracking the last 7 days since {timeframeLabel}
            </p>
          )}
        </div>
      </div>

      {metricsQuery.isLoading ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6 text-slate-400">
          Loading latest metrics…
        </div>
      ) : metricsQuery.isError ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-950/30 p-6 text-rose-200">
          Unable to load dashboard data. Please refresh or try again later.
        </div>
      ) : metrics ? (
        <>
          <section>
            <div className="grid gap-4 lg:grid-cols-3">
              <MetricCard
                title="Total Users"
                value={metrics.totals.users}
                icon={Users}
                accent="from-sky-500/20 via-sky-400/10 to-transparent"
                detail={`${metrics.totals.betaTesters} beta • ${metrics.totals.admins} admins`}
              />
              <MetricCard
                title="Active This Week"
                value={metrics.activity.activeUsers7d}
                icon={Activity}
                accent="from-emerald-500/20 via-emerald-400/10 to-transparent"
                detail={`${metrics.totals.newUsers7d} new sign-ups`}
              />
              <MetricCard
                title="Weekly Plays"
                value={metrics.activity.totalPlays7d}
                icon={LineChart}
                accent="from-violet-500/20 via-violet-400/10 to-transparent"
                detail={`Avg score ${metrics.activity.avgScore7d}`}
              />
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-6 lg:col-span-2">
              <header className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Top Games</p>
                  <h2 className="text-xl font-semibold text-white">Most played this week</h2>
                </div>
                <span className="text-xs text-slate-400">
                  Share of {metrics.activity.totalPlays7d} plays
                </span>
              </header>
              <div className="space-y-4">
                {metrics.topGames.length ? (
                  metrics.topGames.map((game) => <TopGameRow key={game.gameId} game={game} />)
                ) : (
                  <p className="text-sm text-slate-500">No recent sessions recorded.</p>
                )}
              </div>
            </div>
            <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
              <header>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Next Moves</p>
                <h2 className="text-xl font-semibold text-white">Recommendations</h2>
              </header>
              <ul className="space-y-3 text-sm text-slate-200">
                {metrics.recommendations.map((rec, idx) => (
                  <li key={idx} className="rounded-xl bg-slate-900/60 px-4 py-3">
                    • {rec}
                  </li>
                ))}
              </ul>
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/80 p-4 text-xs text-slate-400">
                <p>
                  {metrics.totals.gamesLive} games live • {metrics.totals.users} total players •{" "}
                  {metrics.activity.totalPlays7d} plays this week
                </p>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  accent,
}: {
  title: string;
  value: number;
  detail?: string;
  icon: typeof Users;
  accent: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent}`} />
      <div className="relative flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">{title}</p>
          <p className="text-3xl font-semibold text-white">{numberFormatter.format(value)}</p>
          {detail && <p className="text-xs text-slate-400">{detail}</p>}
        </div>
        <div className="rounded-2xl border border-slate-800/70 bg-slate-950/70 p-3 text-slate-300">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function TopGameRow({ game }: { game: DashboardMetrics["topGames"][number] }) {
  const percent = Math.round(game.share * 100);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-slate-300">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-200">
            <Gamepad2 className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold text-white">{game.title}</p>
            <p className="text-xs text-slate-400">{game.plays7d} plays</p>
          </div>
        </div>
        <p className="text-xs text-slate-400">{percent}%</p>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
