import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthProvider";
import SideDrawer from "../SideDrawer";

export default function Header() {
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <header className="w-full border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/assets/shared/logo_square.png"
            alt="Games4James"
            className="w-10 h-10 rounded"
          />
          <Link
            to="/"
            onClick={() => setDrawerOpen(false)}
            className="text-lg font-extrabold tracking-tight hover:opacity-80 focus:outline-none"
          >
            Games 4 James
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="p-2 rounded-md border border-gray-300 hover:bg-gray-100"
          aria-label="Menu"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
            <circle cx="5" cy="12" r="1" />
          </svg>
        </button>
      </div>

      <SideDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} isAuthenticated={!!user} />
    </header>
  );
}
