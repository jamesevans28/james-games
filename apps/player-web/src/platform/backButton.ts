/**
 * Android back button (T10.5). Screens register handlers while they're open; the
 * newest one wins. With none, back goes back in history, and only leaves the app
 * from the home page. On the web this is all inert (the adapter never fires).
 */
import { useEffect, useRef } from "react";
import { adapters } from "./adapters";

type Handler = () => void;
const stack: { current: Handler }[] = [];

/** Handles a back press, or returns false so the default (history back / exit) runs. */
export function dispatchBack(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.current();
  return true;
}

/** While `active`, the back button calls `handler` instead of navigating. */
export function useBackHandler(active: boolean, handler: Handler): void {
  const ref = useRef<{ current: Handler }>({ current: handler });
  useEffect(() => {
    ref.current.current = handler;
  });
  useEffect(() => {
    if (!active) return;
    const entry = ref.current;
    stack.push(entry);
    return () => {
      const i = stack.lastIndexOf(entry);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [active]);
}

/** Mount once (App): routes native back presses. */
export function useNativeBackButton(isHome: () => boolean): void {
  useEffect(
    () =>
      adapters.app.onBackButton(() => {
        if (dispatchBack()) return;
        if (isHome()) adapters.app.exitApp();
        else window.history.back();
      }),
    [isHome],
  );
}
