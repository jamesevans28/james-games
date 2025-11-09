// Minimal stub for the game entry used by the app during development / type-check.
// The real implementation lives in the games folders; this stub prevents
// build errors when the dev runtime expects a module at ./game/main.

export default function StartGame(_containerId: string): any {
  // Create a minimal mock object with a destroy method so callers can call
  // `destroy(true)` safely during cleanup. In production this will be replaced
  // by the real Phaser.Game instance.
  return {
    destroy: (_force?: boolean) => {
      // no-op
    },
  } as any;
}
