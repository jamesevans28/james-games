import { Fragment, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Mail, Key, AtSign } from "lucide-react";
import { adminApi, type AdminUserDetail } from "../../lib/api";

export function UserDrawer({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [usernameDraft, setUsernameDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
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
      setUsernameDraft(userQuery.data.username || "");
      setEmailDraft(userQuery.data.email || "");
      setBeta(Boolean(userQuery.data.betaTester));
      setAdmin(Boolean(userQuery.data.admin));
      setPinDraft("");
    }
  }, [userQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof adminApi.updateUser>[1]) => {
      if (!userId) return Promise.reject("no-user");
      return adminApi.updateUser(userId, payload);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.setQueryData(["admin-user", userId], data);
    },
  });

  const resetPinMutation = useMutation({
    mutationFn: ({ userId, newPin }: { userId: string; newPin: string }) => {
      return adminApi.resetUserPin(userId, newPin);
    },
    onSuccess: () => {
      alert("PIN reset successfully!");
      setPinDraft("");
    },
    onError: (error: any) => {
      alert(`Failed to reset PIN: ${error.message || "Unknown error"}`);
    },
  });

  if (!userId) return null;

  const user = userQuery.data;
  const closeDrawer = () => {
    if (!updateMutation.isPending) onClose();
  };

  async function saveUsername() {
    await updateMutation.mutateAsync({ username: usernameDraft });
  }

  async function saveEmail() {
    await updateMutation.mutateAsync({ email: emailDraft });
  }

  async function resetPin() {
    if (!pinDraft || !userId) return;
    if (!/^\d{4,8}$/.test(pinDraft)) {
      alert("PIN must be 4-8 digits");
      return;
    }
    await resetPinMutation.mutateAsync({ userId, newPin: pinDraft });
  }

  async function saveFlags() {
    await updateMutation.mutateAsync({ betaTester: beta, admin });
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
              <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                <div className="flex items-center gap-3 text-sm text-slate-400">
                  {" "}
                  <AtSign className="h-4 w-4" />
                  <span>Username</span>
                </div>
                <input
                  type="text"
                  value={usernameDraft}
                  onChange={(e) => setUsernameDraft(e.target.value)}
                  placeholder="username (optional)"
                  className="mt-3 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
                <button
                  onClick={saveUsername}
                  disabled={updateMutation.isPending}
                  className="mt-3 rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white disabled:opacity-60"
                >
                  Update Username
                </button>
                <p className="mt-2 text-xs text-slate-500">
                  Username for username+PIN authentication. Leave blank if not using this auth
                  method.
                </p>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                <div className="flex items-center gap-3 text-sm text-slate-400">
                  {" "}
                  <AtSign className="h-4 w-4" />
                  <span>Username</span>
                </div>
                <input
                  type="text"
                  value={usernameDraft}
                  onChange={(e) => setUsernameDraft(e.target.value)}
                  placeholder="username (optional)"
                  className="mt-3 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
                <button
                  onClick={saveUsername}
                  disabled={updateMutation.isPending}
                  className="mt-3 rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white disabled:opacity-60"
                >
                  Update Username
                </button>
                <p className="mt-2 text-xs text-slate-500">
                  Username for username+PIN authentication. Leave blank if not using this auth
                  method.
                </p>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                <div className="flex items-center gap-3 text-sm text-slate-400">
                  <Mail className="h-4 w-4" />
                  <span>Email</span>
                </div>
                <input
                  type="email"
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  className="mt-3 w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
                <button
                  onClick={saveEmail}
                  disabled={updateMutation.isPending}
                  className="mt-3 rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white disabled:opacity-60"
                >
                  Update Email
                </button>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
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
                  className="mt-3 rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white disabled:opacity-60"
                >
                  {resetPinMutation.isPending ? "Resetting..." : "Reset PIN"}
                </button>
                <p className="mt-2 text-xs text-slate-500">
                  For users with username+PIN accounts. PIN must be 4-8 digits only.
                </p>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
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
                  onClick={saveFlags}
                  disabled={updateMutation.isPending}
                  className="w-full rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white disabled:opacity-60"
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
