import { Fragment, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Key, ShieldAlert, Trash2 } from "lucide-react";
import { adminApi, type AdminUserDetail } from "../../lib/api";

const sectionClass = "rounded-2xl border border-slate-800 bg-slate-900/40 p-5";
const buttonClass =
  "rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white disabled:opacity-60";

export function UserDrawer({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [pinDraft, setPinDraft] = useState("");
  const [beta, setBeta] = useState(false);
  const [admin, setAdmin] = useState(false);

  const userQuery = useQuery<AdminUserDetail | null>({
    queryKey: ["admin-user", userId],
    queryFn: () => (userId ? adminApi.getUser(userId) : Promise.resolve(null)),
    enabled: Boolean(userId),
  });

  useEffect(() => {
    if (userQuery.data) {
      setBeta(Boolean(userQuery.data.betaTester));
      setAdmin(Boolean(userQuery.data.admin));
      setPinDraft("");
    }
  }, [userQuery.data]);

  const onUserChanged = (data: AdminUserDetail) => {
    void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    queryClient.setQueryData(["admin-user", userId], data);
  };
  const onActionError = (error: Error) => alert(`Failed: ${error.message || "Unknown error"}`);

  const updateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof adminApi.updateUser>[1]) => {
      if (!userId) return Promise.reject(new Error("no-user"));
      return adminApi.updateUser(userId, payload);
    },
    onSuccess: onUserChanged,
    onError: onActionError,
  });

  const moderationMutation = useMutation({
    mutationFn: (action: "reset-name" | "disable" | "enable" | "supporter") => {
      if (!userId) return Promise.reject(new Error("no-user"));
      if (action === "reset-name") return adminApi.resetScreenName(userId);
      if (action === "supporter") {
        return adminApi.setSupporter(userId, true).then(() => adminApi.getUser(userId));
      }
      return adminApi.setUserEnabled(userId, action === "enable");
    },
    onSuccess: onUserChanged,
    onError: onActionError,
  });

  const deletePlayMutation = useMutation({
    mutationFn: (playId: string) => adminApi.deletePlay(playId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-user", userId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: onActionError,
  });

  const resetPinMutation = useMutation({
    mutationFn: ({ userId, newPin }: { userId: string; newPin: string }) => {
      return adminApi.resetUserPin(userId, newPin);
    },
    onSuccess: () => {
      alert("PIN reset successfully!");
      setPinDraft("");
    },
    onError: (error: Error) => {
      alert(`Failed to reset PIN: ${error.message || "Unknown error"}`);
    },
  });

  if (!userId) return null;

  const user = userQuery.data;
  const busy =
    updateMutation.isPending || moderationMutation.isPending || deletePlayMutation.isPending;
  const closeDrawer = () => {
    if (!busy) onClose();
  };

  async function resetPin() {
    if (!pinDraft || !userId) return;
    if (!/^\d{4,8}$/.test(pinDraft)) {
      alert("PIN must be 4-8 digits");
      return;
    }
    await resetPinMutation.mutateAsync({ userId, newPin: pinDraft });
  }

  function resetName() {
    if (confirm("Replace this player's screen name with a generated one?")) {
      moderationMutation.mutate("reset-name");
    }
  }

  function toggleEnabled(enabled: boolean) {
    if (enabled || confirm("Disable this account? They can sign in but not post scores.")) {
      moderationMutation.mutate(enabled ? "enable" : "disable");
    }
  }

  function deletePlay(playId: string, score: number) {
    if (confirm(`Delete this play (score ${score})? Their best score is recalculated.`)) {
      deletePlayMutation.mutate(playId);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
      <div className="h-full w-full max-w-md bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500">User Settings</p>
            <h2 className="text-xl font-semibold text-white">{user?.screenName || userId}</h2>
          </div>
          <button
            onClick={closeDrawer}
            className="rounded-full border border-slate-800 p-2 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="h-[calc(100%-73px)] space-y-6 overflow-y-auto px-6 py-6">
          {userQuery.isLoading ? (
            <p className="text-sm text-slate-400">Loading profile…</p>
          ) : user ? (
            <Fragment>
              <section className={`${sectionClass} space-y-1 text-sm text-slate-300`}>
                <p>
                  <span className="text-slate-500">Username:</span> {user.username || "—"}
                </p>
                <p>
                  <span className="text-slate-500">Email:</span> {user.email || "—"}
                  {user.email && (user.emailVerified ? " (verified)" : " (unverified)")}
                </p>
                <p>
                  <span className="text-slate-500">Account:</span> {user.accountType || "—"}
                </p>
                <p>
                  <span className="text-slate-500">Level:</span> {user.xp?.level ?? 1} (
                  {user.xp?.total ?? 0} XP)
                </p>
                <p>
                  <span className="text-slate-500">Status:</span>{" "}
                  {user.enabled === false ? (
                    <span className="text-rose-300">
                      Disabled
                      {user.disabledAt
                        ? ` since ${new Date(user.disabledAt).toLocaleString()}`
                        : ""}
                    </span>
                  ) : (
                    "Active"
                  )}
                </p>
              </section>

              <section className={`${sectionClass} space-y-3`}>
                <p className="flex items-center gap-2 text-sm text-slate-400">
                  <ShieldAlert className="h-4 w-4" /> Moderation
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={resetName}
                    disabled={busy}
                    className={`${buttonClass} bg-amber-600`}
                  >
                    Reset Screen Name
                  </button>
                  <button
                    onClick={() => {
                      if (
                        confirm("Give this player's family the supporter extras (Ko-fi supporter)?")
                      ) {
                        moderationMutation.mutate("supporter");
                      }
                    }}
                    disabled={busy}
                    className={`${buttonClass} bg-yellow-600`}
                  >
                    Make supporter
                  </button>
                  {user.enabled === false ? (
                    <button
                      onClick={() => toggleEnabled(true)}
                      disabled={busy}
                      className={`${buttonClass} bg-emerald-700`}
                    >
                      Enable Account
                    </button>
                  ) : (
                    <button
                      onClick={() => toggleEnabled(false)}
                      disabled={busy}
                      className={`${buttonClass} bg-rose-700`}
                    >
                      Disable Account
                    </button>
                  )}
                </div>
              </section>

              <section className={sectionClass}>
                <p className="text-sm text-slate-400">Games</p>
                {user.gameStats?.length ? (
                  <ul className="mt-3 space-y-1 text-sm text-slate-300">
                    {user.gameStats.map((s) => (
                      <li key={s.gameId} className="flex justify-between">
                        <span>{s.title}</span>
                        <span className="text-slate-400">
                          {s.plays} plays • best {s.bestScore}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">No games played yet.</p>
                )}
              </section>

              <section className={sectionClass}>
                <p className="text-sm text-slate-400">Recent plays</p>
                {user.recentPlays?.length ? (
                  <ul className="mt-3 space-y-2 text-sm text-slate-300">
                    {user.recentPlays.map((p) => (
                      <li key={p.playId} className="flex items-center justify-between gap-3">
                        <div>
                          <p>
                            {p.title} • <span className="font-semibold">{p.score}</span>
                          </p>
                          <p className="text-xs text-slate-500">
                            {new Date(p.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <button
                          onClick={() => deletePlay(p.playId, p.score)}
                          disabled={busy}
                          aria-label="Delete play"
                          className="rounded-lg border border-slate-800 p-2 text-rose-300 hover:text-rose-200 disabled:opacity-60"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">No plays recorded.</p>
                )}
              </section>

              <section className={sectionClass}>
                <p className="flex items-center gap-2 text-sm text-slate-400">
                  <Key className="h-4 w-4" /> Reset PIN
                </p>
                <input
                  type="text"
                  value={pinDraft}
                  onChange={(e) => setPinDraft(e.target.value)}
                  placeholder="Enter new PIN (4-8 digits)"
                  maxLength={8}
                  className="mt-3 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
                <button
                  onClick={resetPin}
                  disabled={!pinDraft || resetPinMutation.isPending}
                  className={`mt-3 ${buttonClass} bg-amber-600`}
                >
                  {resetPinMutation.isPending ? "Resetting..." : "Reset PIN"}
                </button>
                <p className="mt-2 text-xs text-slate-500">
                  For users with username+PIN accounts. PIN must be 4-8 digits only.
                </p>
              </section>

              <section className={`${sectionClass} space-y-4`}>
                <div>
                  <label className="flex items-center justify-between text-sm text-slate-300">
                    <span>Beta Tester</span>
                    <input
                      type="checkbox"
                      className="h-5 w-5"
                      checked={beta}
                      onChange={(e) => setBeta(e.target.checked)}
                    />
                  </label>
                </div>
                <div>
                  <label className="flex items-center justify-between text-sm text-slate-300">
                    <span>Admin</span>
                    <input
                      type="checkbox"
                      className="h-5 w-5"
                      checked={admin}
                      onChange={(e) => setAdmin(e.target.checked)}
                    />
                  </label>
                </div>
                <button
                  onClick={() => updateMutation.mutate({ betaTester: beta, admin })}
                  disabled={busy}
                  className={`w-full ${buttonClass} bg-slate-800`}
                >
                  Save Access Flags
                </button>
              </section>
            </Fragment>
          ) : (
            <p className="text-sm text-rose-300">User not found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
