import { Menu } from "lucide-react";
import { useLocation } from "react-router-dom";
import clsx from "clsx";

const titles: Record<string, string> = {
  "/users": "User Management",
  "/games": "Games Configuration",
};

export function TopBar({ onMenu }: { onMenu?: () => void }) {
  const location = useLocation();
  const envLabel = import.meta.env.MODE === "production" ? "Production" : "Preview";
  const title = titles[location.pathname] || "Admin Portal";

  return (
    <header className="sticky top-0 z-10 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950">
      <div className="flex items-center justify-between px-4 py-3 text-slate-200">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenu}
            className="inline-flex items-center rounded-lg border border-slate-800/50 p-2 text-slate-200 hover:bg-slate-800/40 lg:hidden"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open Navigation</span>
          </button>
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">{envLabel}</p>
            <p className="text-xl font-semibold text-white">{title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest">
          <span className="rounded-full border border-emerald-500/40 px-3 py-1 text-emerald-300">
            Secure Area
          </span>
          <span
            className={clsx(
              "rounded-full border px-3 py-1",
              envLabel === "Production"
                ? "border-rose-400/50 text-rose-200"
                : "border-amber-400/50 text-amber-200"
            )}
          >
            {envLabel}
          </span>
        </div>
      </div>
    </header>
  );
}
