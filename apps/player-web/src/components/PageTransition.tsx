import { useEffect, useState, useRef, ReactElement } from "react";
import { useLocation } from "react-router-dom";

type Props = {
  children: ReactElement;
};

export default function PageTransition({ children }: Props) {
  const location = useLocation();
  const [transitionStage, setTransitionStage] = useState<"idle" | "transitioning">("idle");
  const [animationStarted, setAnimationStarted] = useState(false);
  const [isNavigatingBack, setIsNavigatingBack] = useState(false);
  const prevPathRef = useRef(location.pathname);
  const [oldChildren, setOldChildren] = useState<ReactElement | null>(null);
  const [newChildren, setNewChildren] = useState(children);
  const prevChildrenRef = useRef(children);

  useEffect(() => {
    const fromPath = prevPathRef.current;
    const toPath = location.pathname;

    // Only animate game page transitions
    const fromGame = fromPath.startsWith("/games/");
    const toGame = toPath.startsWith("/games/");

    // Skip animation if not game-related navigation
    if (!fromGame && !toGame) {
      setNewChildren(children);
      setOldChildren(null);
      setTransitionStage("idle");
      setAnimationStarted(false);
      prevPathRef.current = toPath;
      prevChildrenRef.current = children;
      return;
    }

    // Path changed - trigger animation
    if (toPath !== fromPath) {
      // Determine direction: back if leaving game page, forward if entering game page
      const navigatingBack = fromGame && !toGame;
      setIsNavigatingBack(navigatingBack);

      // Store the old page
      setOldChildren(prevChildrenRef.current);
      // Set the new page
      setNewChildren(children);
      // Start transition
      setTransitionStage("transitioning");
      setAnimationStarted(false);

      // Trigger animation after a brief delay for CSS to register initial state
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimationStarted(true);
        });
      });

      const timer = setTimeout(() => {
        setOldChildren(null);
        setTransitionStage("idle");
        setAnimationStarted(false);
      }, 400); // Slightly longer than animation duration

      prevPathRef.current = toPath;
      prevChildrenRef.current = children;
      return () => clearTimeout(timer);
    }
  }, [location.pathname, children]);

  // When idle, just show the current page
  if (transitionStage === "idle") {
    return <div className="page-container">{newChildren}</div>;
  }

  // During transition, show both pages
  const direction = isNavigatingBack ? "page-slide-back" : "page-slide";
  const activeClass = animationStarted ? "active" : "";

  return (
    <div className="page-container page-transition-wrapper">
      {/* Old page sliding out */}
      {oldChildren && (
        <div
          className={`page-transition-layer ${direction}-exit ${
            activeClass ? `${direction}-exit-active` : ""
          }`}
        >
          {oldChildren}
        </div>
      )}
      {/* New page sliding in */}
      <div
        className={`page-transition-layer ${direction}-enter ${
          activeClass ? `${direction}-enter-active` : ""
        }`}
      >
        {newChildren}
      </div>
    </div>
  );
}
