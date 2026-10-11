"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("ATOMIC render error:", error.message);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-mist-dim">error</p>
      <h1 className="mt-3 text-2xl font-semibold text-white">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-sm text-mist">
        The view failed to render. No data was modified — ATOMIC reads are read-only.
      </p>
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={reset} className="btn-primary">
          Retry
        </button>
        <Link href="/" className="rounded-lg border border-ink-600 px-4 py-2 text-sm text-mist hover:border-ink-500">
          Back to Discover
        </Link>
      </div>
    </div>
  );
}
