import Link from "next/link";
import { CHAIN_LIST } from "@/lib/atomic/chains";
import { KNOWN_ENTITIES } from "@/lib/atomic/engine/entities";
import { priceSeries, trendingTokens } from "@/lib/atomic/engine/tokens";
import { Rng, formatUsd } from "@/lib/atomic/engine/prng";
import { Badge, Panel, PageHeader, RiskBadge, SectionHeader, Sparkline, Stat } from "@/components/ui";
import { AlertsFeed, WatchlistStrip } from "@/components/dashboard/live";

// The Discover dashboard renders the chain registry (operator-configured
// at startup), so it must never be statically prerendered from build-time
// env.
export const dynamic = "force-dynamic";

export default function DiscoverPage() {
  const rng = new Rng("dashboard:v1");
  const vol24h = 3_940_000_000 + rng.int(0, 400_000_000);
  const addressesIndexed = 481_220_000 + rng.int(0, 5_000_000);
  const trending = trendingTokens(6);
  const flagged = KNOWN_ENTITIES.filter((e) => e.riskBias >= 30);
  const anchors = KNOWN_ENTITIES.filter((e) => e.riskBias < 30).slice(0, 4);

  return (
    <div>
      <PageHeader
        eyebrow="Discover"
        title="Multi-chain overview"
        sub="Live posture of the chains, assets, and subjects this workspace tracks. Start an investigation from any anchor below."
        action={
          <Link href="/investigate" className="btn-primary">
            New investigation
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Chains indexed" value={CHAIN_LIST.length} sub="EVM · unified schema" tone="cyan" />
        <Stat label="Tracked volume 24h" value={formatUsd(vol24h)} sub="demo dataset" />
        <Stat label="Addresses indexed" value={`${(addressesIndexed / 1e6).toFixed(1)}M`} sub="cumulative" />
        <Stat label="Flagged subjects" value={flagged.length} sub="mixer / honeypot registries" tone="red" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <SectionHeader
            title="Chain status"
            sub="Indexer lag, gas and finality per network (demo snapshots)"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {CHAIN_LIST.map((c) => {
              const lag = new Rng(`lag:${c.id}`).int(1, 9);
              return (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-ink-700 bg-ink-800/60 px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-mist-bright">
                      <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                      {c.name}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-mist-dim">
                      gas {c.avgGasGwei} gwei · finality {c.finalitySec}s
                    </div>
                  </div>
                  <Badge tone={lag <= 4 ? "green" : "amber"}>lag {lag} blk</Badge>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel>
          <SectionHeader title="Alerts feed" sub="Evaluated from workspace rules" />
          <AlertsFeed />
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <SectionHeader
            title="Trending assets"
            sub="Top movers across indexed chains"
            action={
              <Link href="/tokenomics" className="text-xs text-cyan-300 hover:underline">
                Tokenomics →
              </Link>
            }
          />
          <div className="overflow-x-auto">
            <table className="grid-table">
              <thead>
                <tr>
                  <th className="th">Asset</th>
                  <th className="th">Chain</th>
                  <th className="th">Price</th>
                  <th className="th">24h</th>
                  <th className="th">Mkt cap</th>
                  <th className="th">30d</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800">
                {trending.map((t) => (
                  <tr key={t.symbol}>
                    <td className="td">
                      <span className="font-medium text-white">{t.symbol}</span>
                      <span className="ml-2 text-xs text-mist-dim">{t.name}</span>
                    </td>
                    <td className="td text-xs">{t.chain}</td>
                    <td className="td font-mono">${t.priceUsd < 0.01 ? t.priceUsd.toExponential(2) : t.priceUsd.toLocaleString()}</td>
                    <td className={`td font-mono ${t.change24h >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {t.change24h >= 0 ? "+" : ""}
                      {t.change24h}%
                    </td>
                    <td className="td font-mono">{formatUsd(t.marketCapUsd)}</td>
                    <td className="td">
                      <Sparkline data={priceSeries(t.symbol)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel>
            <SectionHeader title="Investigation anchors" sub="Named subjects in the demo plane" />
            <div className="space-y-2">
              {anchors.map((a) => (
                <Link
                  key={a.address}
                  href={`/investigate/${a.address.toLowerCase()}`}
                  className="flex items-center justify-between rounded-lg border border-ink-700 bg-ink-800/60 px-4 py-2.5 hover:border-ink-600"
                >
                  <div>
                    <p className="text-sm text-mist-bright">{a.label}</p>
                    <p className="font-mono text-[11px] text-mist-dim">{a.address.slice(0, 14)}…</p>
                  </div>
                  <span className="font-mono text-[11px] text-mist-dim">{a.type}</span>
                </Link>
              ))}
            </div>
          </Panel>

          <Panel>
            <SectionHeader
              title="Registry watch"
              sub="Flagged subjects under monitoring"
            />
            <div className="space-y-2">
              {flagged.map((f) => (
                <Link
                  key={f.address}
                  href={`/investigate/${f.address.toLowerCase()}`}
                  className="flex items-center justify-between rounded-lg border border-red-900/40 bg-red-950/20 px-4 py-2.5 hover:border-red-900"
                >
                  <div>
                    <p className="text-sm text-red-200">{f.label}</p>
                    <p className="font-mono text-[11px] text-red-300/60">{f.tags.join(" · ")}</p>
                  </div>
                  <RiskBadge level="critical" small />
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-6">
        <Panel>
          <SectionHeader title="Workspace watchlist" sub="Pinned subjects — persisted in this browser" />
          <WatchlistStrip />
        </Panel>
      </div>
    </div>
  );
}
