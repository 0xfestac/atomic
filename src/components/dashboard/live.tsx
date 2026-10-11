"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useWorkspace } from "@/lib/atomic/workspace";
import { evaluateRules } from "@/lib/atomic/alerts/rules";
import { RiskBadge, EmptyState } from "@/components/ui";
import { entitySummary } from "@/lib/atomic/engine/entities";
import { shortAddress } from "@/lib/atomic/engine/prng";
import { DEMO_CHAIN_LIST } from "@/lib/atomic/chains";
import type { Chain } from "@/lib/atomic/types";

export function AlertsFeed({ chains = DEMO_CHAIN_LIST }: { chains?: Chain[] }) {
  const { alertRules, dismissedEvents, dismissEvent, hydrated } = useWorkspace();
  const chainPool = useMemo(() => chains.map((c) => c.id), [chains]);
  const events = useMemo(
    () => (hydrated ? evaluateRules(alertRules, chainPool) : []),
    [alertRules, chainPool, hydrated],
  );
  const visible = events.filter((e) => !dismissedEvents.includes(e.id)).slice(0, 5);

  return (
    <div className="space-y-2">
      {visible.length === 0 ? (
        <EmptyState title="No triggered alerts" sub="Rules run against the deterministic dataset — add or enable rules in Alerts." />
      ) : (
        visible.map((e) => (
          <div key={e.id} className="flex items-start justify-between gap-3 rounded-lg border border-ink-700 bg-ink-800/60 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <RiskBadge level={e.severity} small />
                <span className="truncate text-sm text-mist-bright">{e.ruleName}</span>
              </div>
              <p className="mt-1 truncate text-xs text-mist">{e.message}</p>
              <p className="mt-0.5 font-mono text-[11px] text-mist-dim">{e.timestamp.slice(0, 16).replace("T", " ")} UTC</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link href={`/investigate/${e.subject}`} className="text-xs text-cyan-300 hover:underline">
                Open
              </Link>
              <button onClick={() => dismissEvent(e.id)} className="text-xs text-mist-dim hover:text-mist-bright" aria-label="Dismiss alert">
                ✕
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export function WatchlistStrip({ chains = DEMO_CHAIN_LIST }: { chains?: Chain[] }) {
  const { watchlist, hydrated } = useWorkspace();
  if (!hydrated) return <p className="text-xs text-mist-dim">Loading workspace…</p>;
  if (watchlist.length === 0) {
    return (
      <EmptyState
        title="Watchlist is empty"
        sub="Open any entity in Investigate and press “Watch” to pin it here."
      />
    );
  }
  const chainPool = chains.map((c) => c.id);
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {watchlist.map((address) => {
        const entity = entitySummary(address, chainPool);
        return (
          <Link
            key={address}
            href={`/investigate/${address}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-ink-700 bg-ink-800/60 px-4 py-3 transition-colors hover:border-ink-600"
          >
            <div className="min-w-0">
              <p className="truncate text-sm text-mist-bright">{entity.label ?? shortAddress(address)}</p>
              <p className="font-mono text-[11px] text-mist-dim">{shortAddress(address)}</p>
            </div>
            <RiskBadge level={entity.riskLevel} small />
          </Link>
        );
      })}
    </div>
  );
}
