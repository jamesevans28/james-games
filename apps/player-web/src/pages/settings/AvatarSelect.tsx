import { useCallback, useEffect, useRef, useState } from "react";
import { ProfileAvatar } from "../../components/profile";
import { useSession } from "../../hooks/useSession";
import { useAuth } from "../../context/FirebaseAuthProvider";
import { updatePreferences } from "../../lib/api";

const TOTAL = 89;

// Avatar numbers to exclude from selection
const EXCLUDED_AVATARS = [26];

export default function AvatarSelectPage() {
  const { user } = useSession();
  const { refreshProfile } = useAuth();
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    // Only set once we have a user and only on initial load.
    if (!user || selected !== null) return;
    const av = (user as any)?.avatar as number | undefined;
    // If user's current avatar is excluded, default to 1, otherwise use their avatar or 1
    const defaultAvatar =
      typeof av === "number" && av >= 1 && av <= TOTAL && !EXCLUDED_AVATARS.includes(av) ? av : 1;
    setSelected(defaultAvatar);
  }, [user, selected]);

  const handleSelect = useCallback(
    async (n: number) => {
      if (saving) return;
      setSelected(n);
      setSaving(true);
      try {
        await updatePreferences({ avatar: n });
        // refresh local session so AuthProvider picks up the new avatar
        await refreshProfile();
        // Show a brief confirmation toast
        setToast("Avatar saved");
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(null), 2000);
      } catch (e) {
        console.error("failed to update avatar", e);
      } finally {
        setSaving(false);
      }
    },
    [refreshProfile, saving]
  );

  // Cleanup any pending toast timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  return (
    <div className="p-4 mt-5 max-w-screen-md mx-auto">
      <h2 className="text-xl font-semibold mb-4 text-flingo-900">Choose your avatar</h2>
      <p className="mb-4 text-sm text-flingo-700">
        Tap an avatar to select it. Your selection will be saved to your profile.
      </p>

      {toast && (
        <div
          aria-live="polite"
          className="fixed top-4 right-4 bg-neon-lime text-surface-dark px-3 py-2 rounded-xl shadow-neon-lime text-sm font-bold"
        >
          {toast}
        </div>
      )}

      <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
        {Array.from({ length: TOTAL })
          .map((_, i) => i + 1)
          .filter((id) => !EXCLUDED_AVATARS.includes(id))
          .map((id) => {
            const isSelected = selected === id;
            return (
              <button
                key={id}
                onClick={() => handleSelect(id)}
                className={`p-0 relative rounded-md focus:outline-none ${
                  isSelected ? "ring-4 ring-neon-lime" : ""
                }`}
                aria-pressed={isSelected}
                disabled={saving}
                style={{ width: 72, height: 72 }}
              >
                <ProfileAvatar
                  user={{ avatar: id }}
                  size={72}
                  borderWidth={3}
                  borderColor={isSelected ? "#c8ff32" : "#3a3d47"}
                />
                {isSelected && (
                  <span className="absolute -top-1 -right-1 bg-neon-lime text-surface-dark rounded-full px-1 text-xs shadow-neon-lime font-bold">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
      </div>
    </div>
  );
}
