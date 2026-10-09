import { useId, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveRemix, type Remix } from "../../../lib/api";
import { isApiError } from "../../../lib/apiError";
import { queryKeys } from "../../../lib/queryClient";
import type { RemixValues } from "../../../platform/remix";

/** Same limits as the server (backend services/remixRules.ts). */
export const REMIX_NAME_MIN = 3;
export const REMIX_NAME_MAX = 24;

/** The server's friendly message for a refused name or remix, or a calm fallback. */
function messageFor(err: unknown): string {
  if (isApiError(err) && (err.status === 401 || err.status === 403)) {
    return "Sign up to save remixes.";
  }
  if (isApiError(err) && err.status >= 400 && err.status < 500) return err.message;
  return "We couldn't save it just now. Try again in a moment.";
}

/**
 * The "Save remix" step of the remix sheet (T11.2): a name (3 to 24 characters,
 * filtered on the server like screen names), then POST /remixes.
 */
export default function SaveRemixForm({
  gameId,
  knobs,
  onSaved,
  onBack,
}: {
  gameId: string;
  knobs: RemixValues;
  onSaved: (remix: Remix) => void;
  onBack: () => void;
}) {
  const inputId = useId();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const trimmed = name.trim();
  const save = useMutation({
    mutationFn: () => saveRemix({ gameId, name: trimmed, knobs }),
    onSuccess: (remix) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.myRemixes(gameId) });
      onSaved(remix);
    },
  });
  const tooShort = trimmed.length < REMIX_NAME_MIN;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (tooShort || save.isPending) return;
    save.mutate();
  };

  return (
    <form className="mt-4" onSubmit={submit} noValidate>
      <label htmlFor={inputId} className="text-lg font-bold text-ink">
        Remix name
      </label>
      <input
        id={inputId}
        type="text"
        value={name}
        maxLength={REMIX_NAME_MAX}
        onChange={(e) => {
          setName(e.target.value);
          if (save.isError) save.reset();
        }}
        className="mt-2 w-full min-h-11 bg-paper-2 border border-line rounded-full px-4 text-lg font-bold text-ink placeholder-ink-3 focus:border-brand/50 focus:ring-2 focus:ring-brand/30 focus:outline-none"
        placeholder="Super-fast crocs"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-describedby={`${inputId}-help ${inputId}-error`}
        autoFocus
      />
      <p id={`${inputId}-help`} className="mt-1 text-sm text-ink-2">
        {trimmed.length}/{REMIX_NAME_MAX}. Keep it fun: no full names or where you live.
      </p>
      <p
        id={`${inputId}-error`}
        role="alert"
        className="mt-1 min-h-5 text-sm font-semibold text-tomato"
      >
        {save.isError ? messageFor(save.error) : ""}
      </p>
      <div className="mt-3 flex gap-3">
        <button type="button" className="btn btn-outline min-h-11 flex-1" onClick={onBack}>
          Back
        </button>
        <button
          type="submit"
          className="btn btn-primary min-h-11 flex-1"
          disabled={tooShort || save.isPending}
        >
          {save.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
