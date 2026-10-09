/** A small gold badge after a supporter's name on leaderboards (T12.2). */
export default function SupporterStar() {
  return (
    <span
      role="img"
      aria-label="Supporter"
      title="Supporter"
      className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-edge bg-sun align-middle text-xs text-ink"
    >
      ★
    </span>
  );
}
