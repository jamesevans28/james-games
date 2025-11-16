import { useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "../../hooks/useSession";
import SideDrawer from "../SideDrawer";
import { ProfileAvatar } from "../profile";

export default function Header() {
  const { user } = useSession();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isAuthenticated = !!user;

  return (
    <header className="w-full border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            onClick={() => setDrawerOpen(false)}
            className="text-lg font-extrabold tracking-tight hover:opacity-80 focus:outline-none"
          >
            <img
              src="/assets/shared/logo_square.png"
              alt="Games4James"
              className="w-12 h-12 rounded"
            />
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="w-10 h-10 rounded-full overflow-hidden focus:outline-none flex items-center justify-center"
          aria-label="Account"
        >
          {isAuthenticated ? (
            <ProfileAvatar user={user} size={40} borderWidth={0} strokeWidth={0} rounded={true} />
          ) : (
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
          )}
        </button>
      </div>

      <SideDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        isAuthenticated={isAuthenticated}
      />
    </header>
  );
}
