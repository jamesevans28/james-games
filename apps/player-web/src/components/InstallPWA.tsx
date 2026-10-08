import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import {
  countVisit,
  dismissOverlay,
  INSTALL_HINT_FROM_VISIT,
  isStillDismissed,
  readDismissedAt,
  useOverlaySlot,
} from "../lib/overlays";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isInstalled(): boolean {
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return Boolean(standalone || iosStandalone);
}

/**
 * The "Install app" button (Chrome/Android), from the 2nd visit on, never during a
 * game, and quiet for 14 days after "Not now" (T7.11).
 */
export default function InstallPWA() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [eligible] = useState(
    () =>
      !isInstalled() &&
      countVisit() >= INSTALL_HINT_FROM_VISIT &&
      !isStillDismissed(readDismissedAt("install"), Date.now()),
  );
  const onGame = useLocation().pathname.startsWith("/games/");

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const show = useOverlaySlot("install", eligible && !onGame && deferred !== null);
  if (!show || !deferred) return null;

  const install = async () => {
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "dismissed") dismissOverlay("install");
    } catch {
      // The browser refused; try again another visit.
    }
    setDeferred(null);
  };
  const notNow = () => {
    dismissOverlay("install");
    setDeferred(null);
  };

  return (
    <div className="fixed inset-x-0 bottom-3 z-40 mx-auto flex w-[92%] max-w-md items-center justify-between gap-3 rounded-2xl border border-line bg-card/95 px-4 py-3 text-sm shadow-card-hover backdrop-blur">
      <span className="font-medium text-ink">Put Games4James on your home screen?</span>
      <div className="flex gap-2">
        <button
          onClick={notNow}
          className="min-h-11 rounded-full bg-paper-2 px-4 text-sm font-bold text-ink"
        >
          Not now
        </button>
        <button
          onClick={() => void install()}
          className="min-h-11 rounded-full bg-brand px-4 text-sm font-bold text-on-brand"
        >
          Install
        </button>
      </div>
    </div>
  );
}
