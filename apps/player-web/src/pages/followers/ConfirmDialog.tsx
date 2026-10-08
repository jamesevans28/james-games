import { useEffect, useId, useRef } from "react";

/** A small "are you sure?" sheet for removing or blocking a friend. Escape or the backdrop cancels. */
export default function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-scrim/70" onClick={onCancel} aria-hidden />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-sm bg-card rounded-3xl p-6 shadow-card-hover border border-line"
      >
        <h2 id={titleId} className="text-lg font-bold text-ink">
          {title}
        </h2>
        <p className="mt-2 text-base text-ink-2">{body}</p>
        <div className="mt-5 flex gap-3">
          <button
            ref={cancelRef}
            type="button"
            className="flex-1 btn btn-outline min-h-11"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="flex-1 btn btn-primary min-h-11"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "One moment…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
