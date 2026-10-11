"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useWorkspace } from "@/lib/atomic/workspace";
import { entitySummary } from "@/lib/atomic/engine/entities";
import { holdings, nfts } from "@/lib/atomic/engine/activity";
import { chainOrNull, DEMO_CHAIN_LIST } from "@/lib/atomic/chains";
import { formatAmount, formatUsd } from "@/lib/atomic/engine/prng";
import { EmptyState, Panel, RiskBadge, SectionHeader, Sparkline, Stat } from "@/components/ui";
import { priceSeries } from "@/lib/atomic/engine/tokens";
import type { Chain } from "@/lib/atomic/types";

const TREASURY = "0xa70f1c00000000000000000000000000000a70f1";

export function PortfolioConsole({ chains = DEMO_CHAIN_LIST }: { chains?: Chain[] }) {
  const { watchlist, hydrated } = useWorkspace();
  const chainPool = useMemo(() => chains.map((c) => c.id), [chains]);
  const subjects = useMemo(() => {
    const list = hydrated ? [...new Set([TREASURY, ...watchlist])] : [TREASURY];
    return list.map((a) => ({ address: a, entity: entitySummary(a, chainPool) }));
  }, [watchlist, hydrated, chainPool]);

  const positions = useMemo(
    () =>
      subjects.flatMap((s) =>
        holdings(s.entity).map((h) => ({ ...h, subject: s.entity.label ?? s.address.slice(0, 10) + "…", subjectAddress: s.address })),
      ),
    [subjects],
  );

  const totalUsd = positions.reduce((acc, p) => acc + p.valueUsd, 0);
  const chainExposure = useMemo(() => {
    const byChain = new Map<string, number>();
    for (const p of positions) byChain.set(p.chain, (byChain.get(p.chain) ?? 0) + p.valueUsd);
    return [...byChain.entries()].sort((a, b) => b[1] - a[1]);
  }, [positions]);
  const topPositions = [...positions].sort((a, b) => b.valueUsd - a.valueUsd).slice(0, 10);
  const gallery = subjects.flatMap((s) => nfts(s.entity).slice(0, 3));

  if (!hydrated) {
    return <p className="text-xs text-mist-dim">Loading workspace…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Tracked value" value={formatUsd(totalUsd)} sub={`${subjects.length} subject${subjects.length > 1 ? "s" : ""}`} tone="cyan" />
        <Stat label="Positions" value={positions.length} sub="across all chains" />
        <Stat label="Chains in use" value={chainExposure.length} sub="exposure spread" />
        <Stat label="NFT positions" value={gallery.length} sub="sampled from subjects" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel className="lg:col-span-3">
          <SectionHeader title="Top positions" sub="Aggregated across tracked subjects" />
          <table className="grid-table">
            <thead>
              <tr>
                <th className="th">Asset</th>
                <th className="th">Subject</th>
                <th className="th">Amount</th>
                <th className="th">Value</th>
                <th className="th">24h</th>
                <th className="th">30d</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {topPositions.map((p) => (
                <tr key={`${p.subjectAddress}-${p.symbol}-${p.chain}`}>
                  <td className="td font-medium text-white">{p.symbol}</td>
                  <td className="td">
                    <Link href={`/investigate/${p.subjectAddress}`} className="font-mono text-xs text-cyan-300 hover:underline">
                      {p.subject}
                    </Link>
                  </td>
                  <td className="td font-mono text-xs">{formatAmount(p.amount)}</td>
                  <td className="td font-mono">{formatUsd(p.valueUsd)}</td>
                  <td className={`td font-mono text-xs ${p.change24h >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {p.change24h >= 0 ? "+" : ""}
                    {p.change24h}%
                  </td>
                  <td className="td">
                    <Sparkline data={priceSeries(p.symbol)} width={90} height={24} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel className="lg:col-span-2">
          <SectionHeader title="Chain exposure" sub="Share of tracked value per network" />
          <div className="space-y-3">
            {chainExposure.map(([chainId, usd]) => {
              const pct = (usd / Math.max(1, totalUsd)) * 100;
              const meta = chainOrNull(chainId);
              return (
                <div key={chainId}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-mist-bright">{meta?.name ?? chainId}</span>
                    <span className="font-mono text-mist-dim">{formatUsd(usd)} · {pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-ink-800">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(2, pct)}%`, background: meta?.color ?? "#22d3ee" }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6">
            <SectionHeader title="Subjects" sub="Watchlist + treasury" />
            <div className="space-y-2">
              {subjects.map((s) => (
                <Link key={s.address} href={`/investigate/${s.address}`} className="flex items-center justify-between rounded-lg border border-ink-700 bg-ink-800/60 px-3.5 py-2.5 hover:border-ink-600">
                  <span className="truncate font-mono text-xs text-mist-bright">{s.entity.label ?? s.address.slice(0, 12) + "…"}</span>
                  <RiskBadge level={s.entity.riskLevel} small />
                </Link>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <Panel>
        <SectionHeader title="NFT monitoring" sub="Sampled positions held by tracked subjects" />
        {gallery.length === 0 ? (
          <EmptyState title="No NFT positions in tracked subjects" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {gallery.map((n, i) => (
              <div key={`${n.collection}-${n.tokenId}-${i}`} className="overflow-hidden rounded-lg border border-ink-700">
                <div
                  className="flex h-20 items-center justify-center font-mono text-[11px] text-white/70"
                  style={{ background: `linear-gradient(135deg, hsl(${n.gradientSeed} 60% 22%), hsl(${(n.gradientSeed + 80) % 360} 55% 12%))` }}
                >
                  {n.collection}
                </div>
                <div className="flex items-center justify-between px-2.5 py-2 text-[11px]">
                  <span className="font-mono text-mist-bright">{n.tokenId}</span>
                  <span className="text-mist-dim">{formatUsd(n.floorUsd)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
