import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

export default function SWUpdatePrompt() {
  const [show, setShow] = useState(false);
  const [banner, setBanner] = useState<"offline" | "update" | null>(null);

  const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW({
    onRegisteredSW() {
      // no-op
    },
    onRegisterError(error: unknown) {
      // eslint-disable-next-line no-console
      console.error("SW registration error:", error);
    },
  });

  useEffect(() => {
    const offlineDismissed = sessionStorage.getItem("pwa:offlineDismissed") === "1";
    if (offlineReady && !offlineDismissed) {
      setBanner("offline");
      setShow(true);
    }
  }, [offlineReady]);

  useEffect(() => {
    const updateDismissed = sessionStorage.getItem("pwa:updateDismissed") === "1";
    if (needRefresh && !updateDismissed) {
      setBanner("update");
      setShow(true);
    }
  }, [needRefresh]);

  if (!show) return null;

  const closeOffline = () => {
    sessionStorage.setItem("pwa:offlineDismissed", "1");
    setShow(false);
    setBanner(null);
  };

  const closeUpdate = () => {
    sessionStorage.setItem("pwa:updateDismissed", "1");
    setShow(false);
    setBanner(null);
  };

  return (
    <div className="fixed inset-x-0 bottom-3 mx-auto w-[92%] max-w-md rounded-xl bg-neutral-900/90 backdrop-blur px-4 py-3 shadow-lg border border-neutral-700 text-sm z-50">
      {banner === "offline" ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-neutral-100">App is ready to work offline</span>
          <button
            className="px-3 py-1.5 rounded-md bg-neutral-700 text-white"
            onClick={closeOffline}
          >
            Close
          </button>
        </div>
      ) : (
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
              onClick={() => updateServiceWorker(true)}
            >
              Reload
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
