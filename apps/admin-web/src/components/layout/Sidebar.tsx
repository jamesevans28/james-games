import { NavLink } from "react-router-dom";
import { Users, Gamepad2, LogOut, LayoutDashboard } from "lucide-react";
import clsx from "clsx";
import { useAdminAuth } from "../../context/AdminAuthContext";

const navItems = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Users", to: "/users", icon: Users },
  { label: "Games", to: "/games", icon: Gamepad2 },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, signOut } = useAdminAuth();

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-200">
      <div className="border-b border-slate-800 px-6 py-5">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">James Games</p>
        <p className="text-xl font-semibold text-white">Admin Portal</p>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 rounded-xl px-4 py-2 text-sm font-medium transition hover:bg-slate-800",
                  isActive ? "bg-slate-800 text-white" : "text-slate-400"
                )
              }
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
      <div className="border-t border-slate-800 p-4 text-sm">
        <p className="text-xs text-slate-500">Signed in as</p>
        <p className="font-semibold text-white">
          {user?.screenName || user?.email || user?.userId}
        </p>
        <button
          onClick={() => {
            signOut();
            onNavigate?.();
          }}
          className="mt-3 flex w-full items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-300 hover:bg-slate-700"
        >
          <LogOut className="h-3.5 w-3.5" /> Logout
        </button>
      </div>
    </div>
  );
}
