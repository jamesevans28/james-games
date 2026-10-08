import { useSyncExternalStore } from "react";
import { isMuted, onMutedChange, setMuted } from "../platform/audio";

const subscribe = (fn: () => void) => onMutedChange(fn);

/** Speaker toggle for the global game sound setting (`g4j:muted`). */
export default function MuteButton({ className = "" }: { className?: string }) {
  const muted = useSyncExternalStore(subscribe, isMuted, () => false);
  return (
    <button
      type="button"
      onClick={() => setMuted(!muted)}
      aria-pressed={muted}
      aria-label={muted ? "Turn sound on" : "Turn sound off"}
      className={className}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 10v4h4l5 4V6L8 10H4z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          fill="currentColor"
        />
        {muted ? (
          <path
            d="M17 9l5 6M22 9l-5 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        ) : (
          <path
            d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
      </svg>
    </button>
  );
}
