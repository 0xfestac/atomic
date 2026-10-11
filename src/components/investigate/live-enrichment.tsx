import { chainName } from "@/lib/atomic/chains";
import type { LiveTokenPosition, LiveTransfer } from "@/lib/atomic/types";
import { shortAddress, formatAmount } from "@/lib/atomic/engine/prng";
import { Badge, Panel, SectionHeader } from "@/components/ui";

/**
 * Live ERC-20 enrichment panels. Every row comes straight from a public
 * JSON-RPC read at request time (balanceOf / eth_getLogs) — nothing here
 * is sampled from the deterministic demo plane. Panels render nothing
 * when the chain data is unavailable, so the page degrades to the
 * labeled demo tables below.
 */

export function LivePositionsPanel({ positions }: { positions: (LiveTokenPosition[] | null)[] }) {
  const rows = positions.filter((p): p is LiveTokenPosition[] => Array.isArray(p) && p.length > 0).flat();
  if (rows.length === 0) return null;
  return (
    <Panel>
      <SectionHeader
        title="Live token positions"
        sub="ERC-20 balanceOf reads over public RPC — real chain state"
        action={<Badge tone="green">live</Badge>}
      />
      <div className="overflow-x-auto">
        <table className="grid-table">
          <thead>
            <tr>
              <th className="th">Asset</th>
              <th className="th">Chain</th>
              <th className="th">Contract</th>
              <th className="th">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800">
            {rows.map((p) => (
              <tr key={`${p.chain}-${p.token}`}>
                <td className="td">
                  <span className="font-medium text-white">{p.symbol}</span>
                  {p.name && <span className="ml-2 text-xs text-mist-dim">{p.name}</span>}
                </td>
                <td className="td text-xs">{chainName(p.chain)}</td>
                <td className="td font-mono text-xs text-mist-dim">{shortAddress(p.token, 6)}</td>
                <td className="td font-mono">{formatAmount(p.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export function LiveTransfersPanel({ transfers }: { transfers: (LiveTransfer[] | null)[] }) {
  const rows = transfers
    .filter((t): t is LiveTransfer[] => Array.isArray(t) && t.length > 0)
    .flat()
    .sort((a, b) => b.blockNumber - a.blockNumber)
    .slice(0, 10);
  if (rows.length === 0) return null;
  return (
    <Panel>
      <SectionHeader
        title="Live transfer log"
        sub="ERC-20 Transfer events decoded from eth_getLogs over public RPC (recent block window)"
        action={<Badge tone="green">live</Badge>}
      />
      <div className="overflow-x-auto">
        <table className="grid-table">
          <thead>
            <tr>
              <th className="th">Time (UTC)</th>
              <th className="th">Direction</th>
              <th className="th">Asset</th>
              <th className="th">Amount</th>
              <th className="th">Counterparty</th>
              <th className="th">Chain</th>
              <th className="th">Tx</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800">
            {rows.map((t) => (
              <tr key={`${t.hash}-${t.direction}-${t.counterparty}`}>
                <td className="td font-mono text-xs">{t.timestamp ? t.timestamp.slice(0, 16).replace("T", " ") : `block #${t.blockNumber}`}</td>
                <td className="td">
                  <span className={t.direction === "in" ? "text-xs text-emerald-400" : "text-xs text-amber-300"}>
                    {t.direction === "in" ? "↓ in" : "↑ out"}
                  </span>
                </td>
                <td className="td font-medium">{t.symbol ?? <span className="font-mono text-xs text-mist-dim">{shortAddress(t.token)}</span>}</td>
                <td className="td font-mono">{formatAmount(t.amount)}</td>
                <td className="td">
                  <span className="font-mono text-xs text-mist-bright">{shortAddress(t.counterparty)}</span>
                </td>
                <td className="td text-xs">{chainName(t.chain)}</td>
                <td className="td font-mono text-xs text-mist-dim">{t.hash.slice(0, 10)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-mist-dim">
        Native-coin transfers and contract internals need a full indexer — the deterministic activity table below covers the complete modeled surface.
      </p>
    </Panel>
  );
}
