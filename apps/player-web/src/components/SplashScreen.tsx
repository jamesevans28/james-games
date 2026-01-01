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
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-surface-dark">
      {/* Animated background glow */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-neon-lime/20 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-neon-pink/20 rounded-full blur-[100px] animate-pulse delay-500" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-neon-blue/15 rounded-full blur-[80px] animate-pulse delay-1000" />
      </div>

      <div className="relative flex flex-col items-center gap-4 animate-bounce-in">
        <img
          src="/assets/shared/flingo-logo.svg"
          alt="Flingo.fun"
          className="w-32 h-32 drop-shadow-2xl animate-glow-pulse"
        />
        <span className="text-2xl font-extrabold tracking-tight">
          <span className="text-neon-lime text-glow-lime">flingo</span>
          <span className="text-neon-pink">.fun</span>
        </span>
      </div>
    </div>
  );
}
