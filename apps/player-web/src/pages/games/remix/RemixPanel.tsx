import { useEffect, useId, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchMyRemixes, type Remix } from "../../../lib/api";
import { queryKeys } from "../../../lib/queryClient";
import { clampKnob, defaultValues, formatKnob, isDefault } from "../../../platform/remix";
import type { RemixValues } from "../../../platform/remix";
import type { RemixKnob } from "../../../platform/sdk";
import SaveRemixForm from "./SaveRemixDialog";

type Props = {
  gameId: string;
  gameTitle: string;
  knobs: readonly RemixKnob[];
  /** Where the sliders start: the active remix, or the normal game. */
  initial: RemixValues;
  /** Saving needs a registered account (username + PIN or a linked sign-in). */
  canSave: boolean;
  /** Open straight on the name step (from "Save remix" on the landing card). */
  startOnSave?: boolean;
  onPlay: (values: RemixValues) => void;
  onSaved: (remix: Remix) => void;
  onPickSaved: (remix: Remix) => void;
  onClose: () => void;
};

/**
 * The remix sheet (T11.2): one slider per manifest knob, then "Play this remix" or
 * "Save remix" (name it, and it gets its own board and a link to share).
 */
export default function RemixPanel({
  gameId,
  gameTitle,
  knobs,
  initial,
  canSave,
  startOnSave = false,
  onPlay,
  onSaved,
  onPickSaved,
  onClose,
}: Props) {
  const titleId = useId();
  const [values, setValues] = useState<RemixValues>(initial);
  const [saving, setSaving] = useState(startOnSave);
  const unchanged = isDefault(knobs, values);
  const mine = useQuery({
    queryKey: queryKeys.myRemixes(gameId),
    queryFn: () => fetchMyRemixes(gameId),
    enabled: canSave,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const setKnob = (knob: RemixKnob, raw: number) =>
    setValues((v) => ({ ...v, [knob.key]: clampKnob(knob, raw) }));

  return (
    <div
      className="fixed inset-0 z-[11000] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="absolute inset-0 bg-scrim/70" onClick={onClose} aria-hidden />
      <section className="card relative mx-3 mb-3 max-h-[90dvh] w-full max-w-md overflow-y-auto p-5 sm:mb-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="font-display text-2xl font-extrabold text-ink">
              {saving ? "Name your remix" : `Remix ${gameTitle}`}
            </h2>
            <p className="mt-1 text-base text-ink-2">
              {saving
                ? "Pick a name. Friends can play it with your link."
                : "Slide to change the game, then play it!"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 -mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-paper-2"
            aria-label="Close remix"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {saving ? (
          <SaveRemixForm
            gameId={gameId}
            knobs={values}
            onSaved={onSaved}
            onBack={() => setSaving(false)}
          />
        ) : (
          <>
            <ul className="mt-4 space-y-4">
              {knobs.map((knob) => {
                const value = values[knob.key] ?? knob.default;
                const inputId = `${titleId}-${knob.key}`;
                return (
                  <li key={knob.key}>
                    <div className="flex items-baseline justify-between gap-3">
                      <label htmlFor={inputId} className="text-lg font-bold text-ink">
                        {knob.label}
                      </label>
                      <span className="font-mono text-lg font-extrabold text-brand">
                        {formatKnob(knob, value)}
                      </span>
                    </div>
                    <input
                      id={inputId}
                      type="range"
                      min={knob.min}
                      max={knob.max}
                      step={knob.step}
                      value={value}
                      aria-valuetext={formatKnob(knob, value)}
                      onChange={(e) => setKnob(knob, Number(e.target.value))}
                      className="h-11 w-full cursor-pointer accent-brand"
                    />
                    <div className="flex justify-between text-sm text-ink-3" aria-hidden>
                      <span>{formatKnob(knob, knob.min)}</span>
                      <span>{formatKnob(knob, knob.max)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-5 flex flex-col gap-3">
              <button
                type="button"
                className="btn btn-primary w-full py-4 text-xl"
                onClick={() => onPlay(values)}
              >
                {unchanged ? "Play the normal game" : "Play this remix"}
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="btn btn-outline min-h-11 flex-1"
                  disabled={unchanged}
                  onClick={() => setValues(defaultValues(knobs))}
                >
                  Reset
                </button>
                {canSave ? (
                  <button
                    type="button"
                    className="btn btn-outline min-h-11 flex-1"
                    disabled={unchanged}
                    onClick={() => setSaving(true)}
                  >
                    Save remix
                  </button>
                ) : (
                  <Link to="/login" className="btn btn-outline min-h-11 flex-1 text-center">
                    Sign up to save
                  </Link>
                )}
              </div>
            </div>

            {mine.data && mine.data.length > 0 && (
              <div className="mt-5 border-t-2 border-line pt-4">
                <h3 className="text-base font-bold text-ink-2">Your remixes</h3>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {mine.data.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        className="min-h-11 rounded-full border-2 border-line bg-paper-2 px-4 text-base font-bold text-ink hover:border-brand"
                        onClick={() => onPickSaved(r)}
                      >
                        {r.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
