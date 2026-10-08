import Phaser from "phaser";
import { Hud } from "../hud/Hud";
import { getHost } from "../mount";
import type { GameHost, GameResult } from "../sdk";
import { createRunEnder, type RunEnder } from "./runEnder";

/**
 * The base every SDK game scene extends (T4.5).
 *
 * - Implement `startRun(data)` instead of `create()`. It runs on first start and
 *   again on every restart, after per-run state (HUD, input, timers) is reset.
 * - Call `endRun(score)` when the run is over. Input stops, the end sting plays,
 *   and the result reaches the platform after `endRunDelayMs` (the platform shows
 *   the score dialog and handles "Play again").
 * - Register anything that needs tearing down with `onCleanup(fn)`; timers, tweens
 *   and scene listeners are cleared automatically on shutdown.
 * - Override `onPause()` / `onResume()` if the game needs to react.
 */
export abstract class BasePlatformScene extends Phaser.Scene {
  protected hud!: Hud;
  /** How long the end animation gets before the score dialog. */
  protected endRunDelayMs = 900;

  private ender: RunEnder | null = null;
  private cleanups: Array<() => void> = [];
  private readonly handlePause = () => this.onPause();
  private readonly handleResume = () => this.onResume();
  private readonly handleShutdown = () => this.cleanup();

  protected get host(): GameHost {
    return getHost(this);
  }

  protected abstract startRun(data?: object): void;

  protected onPause(): void {}
  protected onResume(): void {}

  /** True once endRun() has been called for this run. */
  protected get runEnded(): boolean {
    return this.ender?.ended ?? false;
  }

  create(data?: object): void {
    this.ender ??= createRunEnder(this.endRunDelayMs, (ms, fn) => {
      const timer = this.time.delayedCall(ms, fn);
      return () => timer.remove(false);
    });
    this.ender.reset();
    this.input.enabled = true;
    this.hud = new Hud(this, this.host);

    this.events.on(Phaser.Scenes.Events.PAUSE, this.handlePause);
    this.events.on(Phaser.Scenes.Events.RESUME, this.handleResume);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown);

    this.startRun(data);
  }

  /** Ends the run once; later calls are ignored. */
  protected endRun(score: number, stats?: GameResult["stats"]): void {
    if (!this.ender) return;
    const ended = this.ender.end(() => this.host.gameOver({ score, stats }));
    if (!ended) return;
    this.input.enabled = false;
    this.host.audio.play("end");
    this.host.haptics.fail();
  }

  protected onCleanup(fn: () => void): void {
    this.cleanups.push(fn);
  }

  private cleanup(): void {
    this.events.off(Phaser.Scenes.Events.PAUSE, this.handlePause);
    this.events.off(Phaser.Scenes.Events.RESUME, this.handleResume);
    this.time.removeAllEvents();
    this.tweens.killAll();
    const fns = this.cleanups;
    this.cleanups = [];
    fns.forEach((fn) => {
      try {
        fn();
      } catch {
        // a failed cleanup must not stop the others
      }
    });
  }
}
