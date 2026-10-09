import { useId, useState } from "react";
import { DEFAULT_NAMES, NAME_MAX, readPassAndPlay, writePassAndPlay } from "./passAndPlay";

const inputClass =
  "w-full min-h-11 bg-paper-2 border border-line rounded-xl px-3 py-2 text-base text-ink placeholder-ink-3 focus:outline-none focus:ring-2 focus:ring-brand/50";

/**
 * The small "2 players" switch under Play (T11.6). Saves to session storage as you
 * type; PlayGame reads it when Play is pressed. Names never leave this device.
 */
export default function PassAndPlayToggle() {
  const [setup, setSetup] = useState(readPassAndPlay);
  const id = useId();

  const update = (next: typeof setup) => {
    setSetup(next);
    writePassAndPlay(next);
  };
  const setName = (i: 0 | 1, value: string) => {
    const names: [string, string] = [...setup.names];
    names[i] = value.slice(0, NAME_MAX);
    update({ ...setup, names });
  };

  return (
    <div className="mt-3 rounded-2xl border border-line bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p id={`${id}-label`} className="text-base font-bold text-ink">
            2 players
          </p>
          <p id={`${id}-help`} className="text-xs text-ink-2">
            Take turns on this phone. Two-player scores aren&rsquo;t saved to the leaderboard.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={setup.on}
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-help`}
          onClick={() => update({ ...setup, on: !setup.on })}
          className={`relative inline-flex h-11 w-[4.5rem] shrink-0 items-center rounded-full border-2 border-edge transition-colors motion-reduce:transition-none ${
            setup.on ? "bg-grass" : "bg-paper-2"
          }`}
        >
          <span
            className={`inline-block h-8 w-8 rounded-full border-2 border-edge bg-card transition-transform motion-reduce:transition-none ${
              setup.on ? "translate-x-8" : "translate-x-1"
            }`}
            aria-hidden
          />
        </button>
      </div>
      {setup.on && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {([0, 1] as const).map((i) => (
            <label key={i} className="block">
              <span className="mb-1 block text-xs font-bold text-ink-2">
                {i === 0 ? "Goes first" : "Goes second"}
              </span>
              <input
                type="text"
                value={setup.names[i]}
                onChange={(e) => setName(i, e.target.value)}
                maxLength={NAME_MAX}
                placeholder={DEFAULT_NAMES[i]}
                autoComplete="off"
                autoCapitalize="words"
                spellCheck={false}
                className={inputClass}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
