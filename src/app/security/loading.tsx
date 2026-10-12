export default function SecurityLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-64 rounded bg-ink-800" />
      <div className="mt-3 h-4 w-96 rounded bg-ink-800" />
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="h-64 rounded-xl border border-ink-700 bg-ink-850" />
        <div className="h-64 rounded-xl border border-ink-700 bg-ink-850 lg:col-span-2" />
      </div>
    </div>
  );
}
