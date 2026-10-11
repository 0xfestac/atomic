export default function InvestigateLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-72 rounded bg-ink-800" />
      <div className="mt-3 h-4 w-56 rounded bg-ink-800" />
      <div className="mt-8 grid gap-6 lg:grid-cols-4">
        <div className="h-72 rounded-xl border border-ink-700 bg-ink-850" />
        <div className="h-72 rounded-xl border border-ink-700 bg-ink-850 lg:col-span-3" />
      </div>
    </div>
  );
}
