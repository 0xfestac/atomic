"use client";

import Link from "next/link";
import { useWorkspace } from "@/lib/atomic/workspace";

export function EntityActions({ address }: { address: string }) {
  const { isWatched, toggleWatch, hydrated } = useWorkspace();
  const watched = hydrated && isWatched(address);
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => toggleWatch(address)}
        className={watched ? "btn-ghost !border-cyan-900/60 !text-cyan-300" : "btn-ghost"}
        aria-pressed={watched}
      >
        {watched ? "★ Watching" : "☆ Watch"}
      </button>
      <Link href={`/intents?to=${address}`} className="btn-primary">
        Prepare action
      </Link>
    </div>
  );
}
