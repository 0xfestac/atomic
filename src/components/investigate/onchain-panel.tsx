import { CHAINS } from "@/lib/atomic/chains";
import { formatWei } from "@/lib/atomic/onchain/adapter";
import type { OnchainFacts } from "@/lib/atomic/onchain/adapter";
import { Badge, Panel, SectionHeader } from "@/components/ui";

/**
 * Live on-chain snapshot for an entity, read over public RPC at request
 * time. When RPC is unreachable the panel says so — the rest of the page
 * stays on the deterministic demo plane.
 */
export function OnchainPanel({ facts }: { facts: (OnchainFacts | null)[] }) {
  const live = facts.filter((f): f is OnchainFacts => !!f?.ok);

  return (
    <Panel>
      <SectionHeader
        title="Live on-chain state"
        sub={live.length > 0 ? "Read at request time via public JSON-RPC" : "Public RPC unreachable — showing demo-plane data only"}
        action={live.length > 0 ? <Badge tone="green">live</Badge> : <Badge tone="amber">offline</Badge>}
      />
      {live.length === 0 ? (
        <p className="text-xs text-mist-dim">
          No live reads completed. Balances and activity below are from the deterministic demo plane.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {live.map((f) => {
            const meta = CHAINS[f.chain];
            const contract = f.classification?.isContract;
            return (
              <div key={f.chain} className="rounded-lg border border-ink-700 bg-ink-800/50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-mist-bright">{meta.name}</span>
                  <span className="font-mono text-[10px] text-mist-dim">
                    {contract ? "contract" : f.classification?.delegation ? "EOA · 7702" : "EOA"}
                  </span>
                </div>
                <div className="mt-2 font-mono text-lg text-white">
                  {f.nativeBalanceWei !== null
                    ? `${formatWei(f.nativeBalanceWei, 18)} ${meta.nativeSymbol}`
                    : "—"}
                </div>
                <dl className="mt-2 space-y-1 font-mono text-[11px] text-mist-dim">
                  <div className="flex justify-between">
                    <dt>outgoing txs</dt>
                    <dd>{f.txCount?.toLocaleString() ?? "—"}</dd>
                  </div>
                  {contract && f.classification && (
                    <div className="flex justify-between">
                      <dt>code size</dt>
                      <dd>{f.bytecode?.codeSizeBytes ?? f.classification.codeSizeBytes} B</dd>
                    </div>
                  )}
                  {f.classification?.delegation && (
                    <div className="flex justify-between gap-2">
                      <dt>7702 delegate</dt>
                      <dd className="truncate">{f.classification.delegation.delegate.slice(0, 10)}…</dd>
                    </div>
                  )}
                  {f.proxy && (
                    <div className="flex justify-between gap-2">
                      <dt>EIP-1967 impl</dt>
                      <dd className="truncate">{f.proxy.implementation.slice(0, 10)}…</dd>
                    </div>
                  )}
                  {f.owner && (
                    <div className="flex justify-between">
                      <dt>owner()</dt>
                      <dd>{f.owner.renounced ? "renounced" : "active"}</dd>
                    </div>
                  )}
                </dl>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
