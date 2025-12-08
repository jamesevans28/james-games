import { useState } from "react";
import clsx from "clsx";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AdminLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <div className="hidden w-72 border-r border-slate-900 lg:block">
        <Sidebar />
      </div>
      <div className="flex flex-1 flex-col">
        <TopBar onMenu={() => setDrawerOpen(true)} />
        <main className="flex-1 overflow-y-auto bg-slate-900/60 px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      <div
        className={clsx(
          "fixed inset-0 z-40 bg-black/60 transition-opacity lg:hidden",
          drawerOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setDrawerOpen(false)}
      />
      <div
        className={clsx(
          "fixed inset-y-0 left-0 z-50 w-72 transform bg-slate-950 text-white shadow-2xl transition-transform lg:hidden",
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Sidebar onNavigate={() => setDrawerOpen(false)} />
      </div>
    </div>
  );
}
