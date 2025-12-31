import { useEffect, useState, useRef, useCallback } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

export default function SWUpdatePrompt() {
  const [show, setShow] = useState(false);
  const [skipUpdateOnce, setSkipUpdateOnce] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const lastUpdateCheck = useRef<number>(0);
  const updatingRef = useRef(false);
  const promptedKey = "pwa:updatePrompted";

  const setSuppressionWindow = useCallback((ms: number) => {
    try {
      localStorage.setItem("pwa:updateSuppressUntil", String(Date.now() + ms));
    } catch {
      // ignore storage errors
    }
  }, []);

  const shouldSuppress = useCallback(() => {
    if (sessionStorage.getItem("pwa:updateDismissed") === "1") return true;
    if (skipUpdateOnce) return true;
    try {
      // If we've already shown the banner for the currently-waiting SW, don't show it again
      // on every fresh app launch.
      if (localStorage.getItem(promptedKey) === "1") return true;
    } catch {
      /* ignore */
    }
    try {
      const until = Number(localStorage.getItem("pwa:updateSuppressUntil") || "0");
      if (until > Date.now()) return true;
    } catch {
      /* ignore */
    }
    return false;
  }, [skipUpdateOnce, promptedKey]);

  const maybeShowPrompt = useCallback(() => {
    if (shouldSuppress()) return;
    const now = Date.now();
    if (now - lastUpdateCheck.current < 30000) return;
    lastUpdateCheck.current = now;
    try {
      localStorage.setItem(promptedKey, "1");
    } catch {
      /* ignore */
    }
    setShow(true);
  }, [shouldSuppress, promptedKey]);

  const { needRefresh, updateServiceWorker } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      // Don't show just because `waiting` exists at startup; that leads to
      // “new version available” every time the app opens if the user previously
      // chose not to update.
      // We only show when the register hook signals an actual refresh is needed.
      void registration;
    },
    onRegisterError(error: unknown) {
      // eslint-disable-next-line no-console
      console.error("SW registration error:", error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      maybeShowPrompt();
    }
  }, [needRefresh, maybeShowPrompt]);

  // If we just clicked Reload for an update, suppress the update banner once after reload
  useEffect(() => {
    if (sessionStorage.getItem("pwa:updateReloading") === "1") {
      sessionStorage.removeItem("pwa:updateReloading");
      setSkipUpdateOnce(true);
    }
    const onControllerChange = () => {
      setShow(false);
      setSuppressionWindow(15000);
      try {
        // A new SW took control; allow prompting again for future updates.
        localStorage.removeItem(promptedKey);
      } catch {
        /* ignore */
      }
      if (updatingRef.current) {
        window.location.reload();
      }
    };
    navigator.serviceWorker?.addEventListener?.("controllerchange", onControllerChange);
    return () => {
      navigator.serviceWorker?.removeEventListener?.("controllerchange", onControllerChange);
    };
  }, [setSuppressionWindow]);

  const closeUpdate = () => {
    sessionStorage.setItem("pwa:updateDismissed", "1");
    setSuppressionWindow(15000);
    setShow(false);
  };

  const reloadToUpdate = () => {
    if (isUpdating) return;
    sessionStorage.setItem("pwa:updateReloading", "1");
    setSuppressionWindow(15000);
    setShow(false);
    setIsUpdating(true);
    updatingRef.current = true;
    const fallbackReload = window.setTimeout(() => {
      if (updatingRef.current) {
        window.location.reload();
      }
    }, 8000);

    try {
      const maybePromise = updateServiceWorker?.(true);
      if (maybePromise && typeof maybePromise.then === "function") {
        void maybePromise
          .then(() => {
            if (updatingRef.current) {
              window.clearTimeout(fallbackReload);
              window.location.reload();
            }
          })
          .catch((err: unknown) => {
            console.error("SW update failed", err);
            window.clearTimeout(fallbackReload);
            updatingRef.current = false;
            setIsUpdating(false);
            sessionStorage.removeItem("pwa:updateReloading");
            setShow(false);
          });
      }
    } catch (err) {
      console.error("SW update invocation error", err);
      window.clearTimeout(fallbackReload);
      updatingRef.current = false;
      setIsUpdating(false);
      sessionStorage.removeItem("pwa:updateReloading");
    }
  };

  if (!show && !isUpdating) return null;

  return (
    <>
      {show && (
        <div className="fixed inset-x-0 bottom-3 mx-auto w-[92%] max-w-md rounded-xl bg-neutral-900/90 backdrop-blur px-4 py-3 shadow-fun border border-neutral-700 text-sm z-50">
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
      )}
      {isUpdating && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 text-white">
          <div className="animate-pulse text-sm tracking-[0.35em]">UPDATING</div>
          <p className="mt-4 text-center text-base font-semibold max-w-xs">
            Refreshing to the latest version… Stay put for just a moment.
          </p>
        </div>
      )}
    </>
  );
}
