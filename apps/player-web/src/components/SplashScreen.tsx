import { useEffect, useState } from "react";
import { brand, makersLine } from "../config/brand";
import Wordmark from "./brand/Wordmark";

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
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-paper">
      <div className="relative flex flex-col items-center gap-4 animate-bounce-in">
        <img src={brand.logoMark} alt="" className="w-32 h-32 animate-float" />
        <Wordmark className="h-14" />
        <span className="text-sm font-semibold text-ink-2">by {makersLine()}</span>
      </div>
    </div>
  );
}
