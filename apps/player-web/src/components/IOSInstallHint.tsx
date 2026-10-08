import { useState } from "react";
import { useLocation } from "react-router";
import {
  countVisit,
  dismissOverlay,
  INSTALL_HINT_FROM_VISIT,
  isStillDismissed,
  readDismissedAt,
  useOverlaySlot,
} from "../lib/overlays";

function isInstalled(): boolean {
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return Boolean(standalone || iosStandalone);
}

/** Safari on iPhone/iPad (not Chrome, Firefox or Edge for iOS, which can't install). */
function isIOSSafari(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

/** "Add to Home Screen" instructions for iOS Safari, on the same rules as InstallPWA (T7.11). */
export default function IOSInstallHint() {
  const [eligible, setEligible] = useState(
    () =>
      isIOSSafari() &&
      !isInstalled() &&
      countVisit() >= INSTALL_HINT_FROM_VISIT &&
      !isStillDismissed(readDismissedAt("ios-install"), Date.now()),
  );
  const onGame = useLocation().pathname.startsWith("/games/");
  const show = useOverlaySlot("ios-install", eligible && !onGame);
  if (!show) return null;

  const dismiss = () => {
    dismissOverlay("ios-install");
    setEligible(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-3 z-40 mx-auto w-[92%] max-w-md rounded-2xl border border-line bg-card/95 px-5 py-4 text-sm shadow-card-hover backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink">
          Install it: tap
          <span role="img" aria-label="the Share button" className="mx-1 text-brand">
            ⎋
          </span>
          then &ldquo;Add to Home Screen&rdquo;.
        </span>
        <button
          className="min-h-11 rounded-full bg-brand/20 px-4 font-bold text-brand"
          onClick={dismiss}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
