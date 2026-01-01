import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Users, Database } from "lucide-react";
import { adminApi, AdminUserSummary, PaginatedResponse } from "../lib/api";
import { useDebounce } from "../hooks/useDebounce";
import { UserDrawer } from "../components/users/UserDrawer";

export function UsersPage() {
  const [search, setSearch] = useState("");
  const [cursorStack, setCursorStack] = useState<Array<string | undefined>>([undefined]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 300);
  const currentCursor = cursorStack[cursorStack.length - 1];

  const queryKey = useMemo(
    () => ["admin-users", currentCursor, debouncedSearch],
    [currentCursor, debouncedSearch]
  );

  const usersQuery = useQuery<PaginatedResponse<AdminUserSummary>>({
    queryKey,
    queryFn: () =>
      adminApi.listUsers({ cursor: currentCursor, search: debouncedSearch, limit: 25 }),
    placeholderData: (prev) => prev,
  });

  const users = usersQuery.data?.items ?? [];
  const nextCursor = usersQuery.data?.nextCursor;

  const goNext = () => {
    if (nextCursor) setCursorStack((stack) => [...stack, nextCursor]);
  };

  const goPrev = () => {
    if (cursorStack.length > 1) setCursorStack((stack) => stack.slice(0, -1));
  };

  const resetPagination = () => setCursorStack([undefined]);

  return (
    <div className="space-y-6">
      <header className="grid gap-4 rounded-3xl border border-white/5 bg-slate-950/70 p-6 backdrop-blur lg:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-[0.45em] text-slate-500">Control Center</p>
          <h2 className="text-2xl font-semibold text-white">Users</h2>
          <p className="text-sm text-slate-400">
            Manage player accounts, access flags, and credentials.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Total Loaded</p>
          <p className="mt-1 text-3xl font-semibold text-white">
            {users.length.toString().padStart(2, "0")}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Next Cursor</p>
          <p className="mt-1 truncate text-sm text-slate-300">{nextCursor || "End of list"}</p>
        </div>
      </header>

      <div className="rounded-3xl border border-white/5 bg-slate-950/60 p-5 backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-2">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                resetPagination();
              }}
              placeholder="Search by user ID, handle, or email"
              className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={goPrev}
              disabled={cursorStack.length <= 1 || usersQuery.isFetching}
              className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              onClick={goNext}
              disabled={!nextCursor || usersQuery.isFetching}
              className="rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-900">
          <table className="min-w-full divide-y divide-slate-900 text-left text-sm">
            <thead className="bg-slate-950/80 text-xs uppercase tracking-widest text-slate-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Flags</th>
                <th className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {users.map((user) => (
                <tr
                  key={user.userId}
                  className="cursor-pointer bg-slate-900/30 transition hover:bg-slate-900/70"
                  onClick={() => setSelectedUserId(user.userId)}
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold text-white">{user.screenName || "Unnamed"}</p>
                    <p className="text-xs text-slate-500">{user.userId}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-slate-300">{user.username || "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-slate-300">{user.email || "—"}</p>
                    <p className="text-xs text-slate-500">
                      {user.emailProvided ? "Provided" : "Unknown"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold uppercase tracking-widest">
                    <span className="mr-2 inline-flex items-center gap-1 rounded-full border border-amber-400/40 px-2 py-1 text-amber-200">
                      <Users className="h-3 w-3" />
                      {user.betaTester ? "Beta" : "Player"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 px-2 py-1 text-emerald-200">
                      <Database className="h-3 w-3" />
                      {user.admin ? "Admin" : "Member"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {user.updatedAt ? new Date(user.updatedAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
              {!users.length && !usersQuery.isFetching && (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {usersQuery.isFetching && <p className="mt-3 text-xs text-slate-400">Refreshing list…</p>}
      </div>

      {selectedUserId && (
        <UserDrawer userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
      )}
    </div>
  );
}
