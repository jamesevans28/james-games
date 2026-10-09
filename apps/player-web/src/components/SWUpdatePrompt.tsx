import { useEffect, useState, useRef, useCallback } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useOverlaySlot } from "../lib/overlays";
import { adapters } from "../platform/adapters";

export default function SWUpdatePrompt() {
  const [show, setShow] = useState(false);
  const [skipUpdateOnce, setSkipUpdateOnce] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const lastUpdateCheck = useRef<number>(0);
  const updatingRef = useRef(false);
  const promptedKey = "pwa:updatePrompted";

  const setSuppressionWindow = useCallback((ms: number) => {
    adapters.storage.set("pwa:updateSuppressUntil", String(Date.now() + ms));
  }, []);

  const shouldSuppress = useCallback(() => {
    if (adapters.session.get("pwa:updateDismissed") === "1") return true;
    if (skipUpdateOnce) return true;
    // If we've already shown the banner for the currently-waiting SW, don't show it again
    // on every fresh app launch.
    if (adapters.storage.get(promptedKey) === "1") return true;
    const until = Number(adapters.storage.get("pwa:updateSuppressUntil") || "0");
    if (until > Date.now()) return true;
    return false;
  }, [skipUpdateOnce, promptedKey]);

  const maybeShowPrompt = useCallback(() => {
    if (shouldSuppress()) return;
    const now = Date.now();
    if (now - lastUpdateCheck.current < 30000) return;
    lastUpdateCheck.current = now;
    adapters.storage.set(promptedKey, "1");
    setShow(true);
  }, [shouldSuppress, promptedKey]);

  // needRefresh is a [value, setter] pair; testing the pair itself was always true,
  // which showed "New version available" on every first visit (fixed in T7.11).
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      // Don't show just because `waiting` exists at startup; that leads to
      // “new version available” every time the app opens if the user previously
      // chose not to update.
      // We only show when the register hook signals an actual refresh is needed.
      void registration;
    },
    onRegisterError(error: unknown) {
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
    if (adapters.session.get("pwa:updateReloading") === "1") {
      adapters.session.remove("pwa:updateReloading");
      setSkipUpdateOnce(true);
    }
    const onControllerChange = () => {
      setShow(false);
      setSuppressionWindow(15000);
      // A new SW took control; allow prompting again for future updates.
      adapters.storage.remove(promptedKey);
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
    adapters.session.set("pwa:updateDismissed", "1");
    setSuppressionWindow(15000);
    setShow(false);
  };

  const reloadToUpdate = () => {
    if (isUpdating) return;
    adapters.session.set("pwa:updateReloading", "1");
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
      void updateServiceWorker(true)
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
          adapters.session.remove("pwa:updateReloading");
          setShow(false);
        });
    } catch (err) {
      console.error("SW update invocation error", err);
      window.clearTimeout(fallbackReload);
      updatingRef.current = false;
      setIsUpdating(false);
      adapters.session.remove("pwa:updateReloading");
    }
  };

  // The update prompt outranks every other overlay (T7.11).
  const slot = useOverlaySlot("update", show);
  if (!slot && !isUpdating) return null;

  return (
    <>
      {slot && (
        <div className="fixed inset-x-0 bottom-3 mx-auto w-[92%] max-w-md rounded-xl bg-card/95 backdrop-blur px-4 py-3 shadow-card-hover border border-line text-sm z-50">
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink">New version available</span>
            <div className="flex gap-2">
              <button
                className="min-h-11 rounded-full bg-paper-2 px-4 text-ink"
                onClick={closeUpdate}
              >
                Later
              </button>
              <button
                className="min-h-11 rounded-full bg-brand px-4 font-bold text-on-brand"
                onClick={reloadToUpdate}
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      )}
      {isUpdating && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-scrim/70 text-white">
          <div className="animate-pulse text-sm tracking-[0.35em]">UPDATING</div>
          <p className="mt-4 text-center text-base font-semibold max-w-xs">
            Refreshing to the latest version… Stay put for just a moment.
          </p>
        </div>
      )}
    </>
  );
}
