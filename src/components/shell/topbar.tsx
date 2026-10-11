"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isEvmAddress } from "@/lib/atomic/engine/prng";
import { findEntities } from "@/lib/atomic/engine/entities";

export function Topbar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const suggestions = query.trim().length >= 2 && !isEvmAddress(query) ? findEntities(query).slice(0, 4) : [];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    if (isEvmAddress(q)) {
      router.push(`/investigate/${q.toLowerCase()}`);
      setQuery("");
    }
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-ink-700 bg-ink-950/90 px-8 backdrop-blur">
      <form onSubmit={submit} className="relative w-full max-w-xl">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-mist-dim">⌕</span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input pl-8"
          placeholder="Search address or entity — ⌘K"
          aria-label="Search address or entity"
        />
        {suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-ink-600 bg-ink-850 shadow-xl">
            {suggestions.map((s) => (
              <button
                key={s.address}
                type="button"
                className="flex w-full items-center justify-between gap-4 px-4 py-2.5 text-left text-sm hover:bg-ink-800"
                onClick={() => {
                  router.push(`/investigate/${s.address.toLowerCase()}`);
                  setQuery("");
                }}
              >
                <span className="text-mist-bright">{s.label}</span>
                <span className="font-mono text-xs text-mist-dim">{s.type}</span>
              </button>
            ))}
          </div>
        )}
      </form>
      <div className="ml-auto flex items-center gap-3">
        <span className="hidden rounded-full border border-ink-600 px-3 py-1 font-mono text-[11px] text-mist-dim md:inline">
          workspace: research-desk
        </span>
        <span className="rounded-full border border-amber-900/60 bg-amber-950/40 px-3 py-1 font-mono text-[11px] text-amber-300">
          demo data
        </span>
      </div>
    </header>
  );
}
