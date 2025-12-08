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
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-gradient-to-br from-fuchsia-700 via-purple-700 to-fuchsia-700">
      <img
        src="/assets/shared/logo_square.png"
        alt="Games4James"
        className="w-40 h-40 rounded-2xl shadow-2xl"
      />
    </div>
  );
}
