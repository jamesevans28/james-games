import { useEffect, useState, useRef } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

export default function SWUpdatePrompt() {
  const [show, setShow] = useState(false);
  const [skipUpdateOnce, setSkipUpdateOnce] = useState(false);
  const lastUpdateCheck = useRef<number>(0);

  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onRegisteredSW() {
      // no-op
    },
    onRegisterError(error: unknown) {
      // eslint-disable-next-line no-console
      console.error("SW registration error:", error);
    },
  });

  // If we just clicked Reload for an update, suppress the update banner once after reload
  useEffect(() => {
    if (sessionStorage.getItem("pwa:updateReloading") === "1") {
      sessionStorage.removeItem("pwa:updateReloading");
      setSkipUpdateOnce(true);
    }
    // Also listen for controllerchange; when the new SW takes control, hide the banner
    const onControllerChange = () => {
      setShow(false);
      // brief suppression window to avoid immediate re-show if checks re-run
      const until = Date.now() + 15000; // 15s
      try {
        localStorage.setItem("pwa:updateSuppressUntil", String(until));
      } catch {}
    };
    navigator.serviceWorker?.addEventListener?.("controllerchange", onControllerChange);
    return () => {
      navigator.serviceWorker?.removeEventListener?.("controllerchange", onControllerChange);
    };
  }, []);

  useEffect(() => {
    const updateDismissed = sessionStorage.getItem("pwa:updateDismissed") === "1";
    let suppressed = false;
    try {
      const until = Number(localStorage.getItem("pwa:updateSuppressUntil") || "0");
      suppressed = until > Date.now();
    } catch {
      suppressed = false;
    }

    // Debounce update checks - only show if at least 30 seconds since last check
    // This prevents false positives when SW is still initializing
    const now = Date.now();
    const timeSinceLastCheck = now - lastUpdateCheck.current;

    if (
      needRefresh &&
      !updateDismissed &&
      !skipUpdateOnce &&
      !suppressed &&
      timeSinceLastCheck > 30000
    ) {
      lastUpdateCheck.current = now;
      setShow(true);
    }
  }, [needRefresh, skipUpdateOnce]);

  if (!show) return null;

  const closeUpdate = () => {
    sessionStorage.setItem("pwa:updateDismissed", "1");
    setShow(false);
  };

  const reloadToUpdate = () => {
    // Mark that we triggered a reload due to update; suppress banner once on reload
    sessionStorage.setItem("pwa:updateReloading", "1");
    // Add a short suppression window across full reload in case sessionStorage is lost
    try {
      const until = Date.now() + 15000; // 15s
      localStorage.setItem("pwa:updateSuppressUntil", String(until));
    } catch {}
    updateServiceWorker(true);
    // Force reload to ensure update takes effect
    window.location.reload();
  };

  return (
    <div className="fixed inset-x-0 bottom-3 mx-auto w-[92%] max-w-md rounded-xl bg-neutral-900/90 backdrop-blur px-4 py-3 shadow-lg border border-neutral-700 text-sm z-50">
      <div className="flex items-center justify-between gap-3">
        <span className="text-neutral-100">New version available</span>
        <div className="flex gap-2">
          <button
            className="px-3 py-1.5 rounded-md bg-neutral-700 text-white"
            onClick={closeUpdate}
          >
            Later
          </button>
          <button
            className="px-3 py-1.5 rounded-md bg-emerald-600 text-white"
            onClick={reloadToUpdate}
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}
