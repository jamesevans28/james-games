import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallPWA() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // detect installed mode (Chrome/Android)
    const isStandalone = window.matchMedia?.("(display-mode: standalone)").matches;
    // detect installed on iOS Safari
    const isIOSStandalone = (window as any).navigator?.standalone === true;
    if (isStandalone || isIOSStandalone) setInstalled(true);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      if (!installed) setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    const onInstalled = () => {
      setInstalled(true);
      setVisible(false);
      setDeferred(null);
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || !visible || !deferred) return null;

  const install = async () => {
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        setVisible(false);
        setDeferred(null);
      }
    } catch {
      // ignore
    }
  };

  return (
    <button
      onClick={install}
      className="fixed right-3 bottom-16 z-40 rounded-full bg-emerald-600 text-white px-4 py-2 shadow-lg border border-emerald-500"
      aria-label="Install app"
    >
      Install App
    </button>
  );
}
