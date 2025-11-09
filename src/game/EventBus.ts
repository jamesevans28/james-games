// Minimal event bus stub used by the PhaserGame wrapper. The real project
// provides a more complete implementation. This stub implements the methods
// used in the app so TypeScript and runtime code won't fail.

type Listener = (...args: any[]) => void;

const listeners: Record<string, Listener[]> = {};

export const EventBus = {
  on(event: string, cb: Listener) {
    listeners[event] = listeners[event] || [];
    listeners[event].push(cb);
  },
  emit(event: string, ...args: any[]) {
    (listeners[event] || []).forEach((cb) => cb(...args));
  },
  removeListener(event?: string) {
    if (!event) {
      // clear all
      Object.keys(listeners).forEach((k) => delete listeners[k]);
      return;
    }
    delete listeners[event];
  },
};

export default EventBus;
