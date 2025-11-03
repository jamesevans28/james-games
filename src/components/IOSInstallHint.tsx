import { useEffect, useState } from "react";

function isInstalled(): boolean {
  const isStandalone = window.matchMedia?.("(display-mode: standalone)").matches;
  const isIOSStandalone = (navigator as any).standalone === true; // iOS Safari
  return Boolean(isStandalone || isIOSStandalone);
}

function isIOSSafari(): boolean {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  // Safari on iOS doesn't include 'CriOS' (Chrome), 'FxiOS' (Firefox), 'EdgiOS' (Edge)
  const isSafari = isIOS && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isSafari;
}

export default function IOSInstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isInstalled()) return; // don't show inside installed app
    const dismissed = localStorage.getItem("pwa:iosHintDismissed") === "1";
    if (!dismissed && isIOSSafari()) setShow(true);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem("pwa:iosHintDismissed", "1");
    setShow(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-3 mx-auto w-[92%] max-w-md rounded-xl bg-neutral-900/90 backdrop-blur px-4 py-3 shadow-lg border border-neutral-700 text-sm z-50">
      <div className="flex items-center justify-between gap-3">
        <span className="text-neutral-100">
          Install this app: tap
          <span aria-label="Share" title="Share" className="mx-1">
            ⎋
          </span>
          then "Add to Home Screen"
        </span>
        <button className="px-3 py-1.5 rounded-md bg-neutral-700 text-white" onClick={dismiss}>
          Got it
        </button>
      </div>
    </div>
  );
}
