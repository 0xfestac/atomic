/**
 * Route-level loading skeleton shared by the loading.tsx boundaries.
 * Dynamic pages only prefetch their loading boundary, so a matching
 * skeleton on every route is what makes navigation feel instant.
 */
export function PageSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-4 w-24 rounded bg-ink-800" />
      <div className="mt-3 h-8 w-72 rounded bg-ink-800" />
      <div className="mt-3 h-4 w-96 max-w-full rounded bg-ink-800" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl border border-ink-700 bg-ink-850" />
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="h-96 rounded-xl border border-ink-700 bg-ink-850 lg:col-span-2" />
        <div className="h-96 rounded-xl border border-ink-700 bg-ink-850" />
      </div>
    </div>
  );
}
