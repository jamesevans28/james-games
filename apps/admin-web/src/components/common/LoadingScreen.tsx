export function LoadingScreen({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-slate-950 text-slate-200">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-800 border-t-brand-500" />
      <p className="text-sm font-medium tracking-wide text-slate-400">{label}…</p>
    </div>
  );
}
