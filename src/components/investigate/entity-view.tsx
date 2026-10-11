import Link from "next/link";
import type { EntitySummary } from "@/lib/atomic/types";
import { activity, holdings, relationshipGraph } from "@/lib/atomic/engine/activity";
import { formatUsd, shortAddress } from "@/lib/atomic/engine/prng";
import { RiskBadge } from "@/components/ui";

const RISK_COLORS: Record<string, string> = {
  low: "#34d399",
  medium: "#fbbf24",
  high: "#fb923c",
  critical: "#f87171",
};

export function RelationshipGraphView({ entity }: { entity: EntitySummary }) {
  const graph = relationshipGraph(entity);
  const W = 720;
  const H = 420;
  const cx = 170;
  const cy = H / 2;

  const positions = graph.edges.map((edge, i) => {
    const ring = i % 2 === 0 ? 190 : 118;
    const angle = (i / graph.edges.length) * Math.PI * 2 - Math.PI / 2;
    return {
      edge,
      x: cx + 170 + Math.cos(angle) * ring * 1.35,
      y: cy + Math.sin(angle) * ring,
    };
  });

  const maxVolume = Math.max(...graph.edges.map((e) => e.volumeUsd), 1);

  return (
    <div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[640px]" role="img" aria-label="Relationship graph">
          {positions.map(({ edge, x, y }) => (
            <g key={edge.node}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke={RISK_COLORS[edge.riskLevel]} strokeOpacity={0.25 + (edge.volumeUsd / maxVolume) * 0.55} strokeWidth={1 + (edge.volumeUsd / maxVolume) * 2.4} />
            </g>
          ))}
          {positions.map(({ edge, x, y }) => {
            const r = 7 + (edge.volumeUsd / maxVolume) * 12;
            return (
              <g key={`n-${edge.node}`}>
                <circle cx={x} cy={y} r={r} fill="#0d1119" stroke={RISK_COLORS[edge.riskLevel]} strokeWidth={1.6} />
                <text x={x} y={y - r - 6} textAnchor="middle" fontSize="10" fill="#c3c9d9" className="font-mono">
                  {edge.label ?? shortAddress(edge.node)}
                </text>
                <text x={x} y={y + 3.5} textAnchor="middle" fontSize="8" fill="#5b6378" className="font-mono">
                  {formatUsd(edge.volumeUsd)}
                </text>
              </g>
            );
          })}
          <circle cx={cx} cy={cy} r={26} fill="#0a0d15" stroke="#22d3ee" strokeWidth={2} />
          <text x={cx} y={cy + 4} textAnchor="middle" fontSize="9" fill="#22d3ee" className="font-mono">
            SUBJECT
          </text>
          <text x={cx} y={cy + 44} textAnchor="middle" fontSize="10" fill="#8b94ab" className="font-mono">
            {entity.label ?? shortAddress(entity.address)}
          </text>
        </svg>
      </div>

      <div className="mt-4 grid gap-2">
        {graph.clusters.map((cluster) => (
          <div key={cluster.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-700 bg-ink-800/50 px-4 py-2.5">
            <span className="label-mono">{cluster.label}</span>
            <div className="flex flex-wrap gap-1.5">
              {cluster.members.map((m) => {
                const edge = graph.edges.find((e) => e.node === m);
                return (
                  <Link
                    key={m}
                    href={`/investigate/${m}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-ink-600 px-2.5 py-0.5 font-mono text-[11px] text-mist hover:border-ink-600 hover:bg-ink-800 hover:text-mist-bright"
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: RISK_COLORS[edge?.riskLevel ?? "low"] }} />
                    {edge?.label ?? shortAddress(m)}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-mist-dim">
        Node size ∝ transferred volume · ring color = counterparty risk · click any node to pivot the investigation.
      </p>
    </div>
  );
}

export function ActivityTable({ entity }: { entity: EntitySummary }) {
  const rows = activity(entity, 15);
  return (
    <div className="overflow-x-auto">
      <table className="grid-table">
        <thead>
          <tr>
            <th className="th">Time (UTC)</th>
            <th className="th">Type</th>
            <th className="th">Asset</th>
            <th className="th">Value</th>
            <th className="th">Counterparty</th>
            <th className="th">Chain</th>
            <th className="th">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-800">
          {rows.map((tx) => (
            <tr key={tx.hash}>
              <td className="td font-mono text-xs">{tx.timestamp.slice(0, 16).replace("T", " ")}</td>
              <td className="td text-xs capitalize">{tx.type}</td>
              <td className="td">
                <span className="font-medium">{tx.symbol}</span>
                <span className="ml-1.5 font-mono text-xs text-mist-dim">{tx.amount < 0.01 ? tx.amount.toExponential(2) : tx.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </td>
              <td className="td font-mono">{formatUsd(tx.valueUsd)}</td>
              <td className="td">
                <Link href={`/investigate/${tx.counterparty}`} className="font-mono text-xs text-cyan-300 hover:underline">
                  {tx.counterpartyLabel ?? shortAddress(tx.counterparty)}
                </Link>
              </td>
              <td className="td text-xs">{tx.chain}</td>
              <td className="td">
                {tx.status === "success" ? (
                  <span className="text-xs text-emerald-400">success</span>
                ) : (
                  <span className="text-xs text-red-400">failed</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HoldingsTable({ entity }: { entity: EntitySummary }) {
  const rows = holdings(entity);
  return (
    <div className="overflow-x-auto">
      <table className="grid-table">
        <thead>
          <tr>
            <th className="th">Asset</th>
            <th className="th">Chain</th>
            <th className="th">Amount</th>
            <th className="th">Price</th>
            <th className="th">Value</th>
            <th className="th">24h</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-800">
          {rows.map((h) => (
            <tr key={`${h.symbol}-${h.chain}`}>
              <td className="td">
                <span className="font-medium text-white">{h.symbol}</span>
                <span className="ml-2 text-xs text-mist-dim">{h.token}</span>
              </td>
              <td className="td text-xs">{h.chain}</td>
              <td className="td font-mono">{h.amount.toLocaleString(undefined, { maximumFractionDigits: 3 })}</td>
              <td className="td font-mono">${h.priceUsd.toLocaleString()}</td>
              <td className="td font-mono">{formatUsd(h.valueUsd)}</td>
              <td className={`td font-mono ${h.change24h >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {h.change24h >= 0 ? "+" : ""}
                {h.change24h}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FlagsPanel({ entity }: { entity: EntitySummary }) {
  if (entity.riskFlags.length === 0) {
    return <p className="text-sm text-mist">No risk flags raised for the current lookback window.</p>;
  }
  return (
    <div className="space-y-2">
      {entity.riskFlags.map((f) => (
        <div key={f.id} className="flex items-start gap-3 rounded-lg border border-ink-700 bg-ink-800/50 px-4 py-3">
          <RiskBadge level={f.level} small />
          <div>
            <p className="text-sm text-mist-bright">{f.label}</p>
            <p className="mt-0.5 text-xs text-mist">{f.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
