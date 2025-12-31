import { useEffect, useState } from "react";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mm = window.matchMedia && window.matchMedia("(display-mode: standalone)");
  const iosStandalone = (window.navigator as any).standalone === true;
  return (mm && mm.matches) || iosStandalone;
}

export default function SplashScreen() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only show on installed PWA open, and only once per page load
    const hasShown = sessionStorage.getItem("splash-shown");
    if (!hasShown && isStandalone()) {
      setShow(true);
      sessionStorage.setItem("splash-shown", "1");
      const t = setTimeout(() => setShow(false), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-gradient-to-br from-flingo-500 via-flingo-700 to-flingo-800">
      <div className="flex flex-col items-center gap-4 animate-float">
        <img
          src="/assets/shared/flingo-logo.svg"
          alt="Flingo.fun"
          className="w-32 h-32 drop-shadow-2xl"
        />
        <span className="text-2xl font-bold text-white">
          flingo<span className="text-candy-pink">.fun</span>
        </span>
      </div>
    </div>
  );
}
