import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { CHAINS } from "@/lib/atomic/chains";
import { activity, nfts } from "@/lib/atomic/engine/activity";
import { entitySummary } from "@/lib/atomic/engine/entities";
import { isEvmAddress, formatUsd } from "@/lib/atomic/engine/prng";
import { analystReport } from "@/lib/atomic/analyst/report";
import { securityReport } from "@/lib/atomic/security/checks";
import { onchainFactsForChains, resolveEns } from "@/lib/atomic/onchain/adapter";
import { isEnsName } from "@/lib/atomic/onchain/name";
import { Badge, CheckStatusIcon, PageHeader, Panel, RiskBadge, RiskGauge, SectionHeader } from "@/components/ui";
import { ActivityTable, FlagsPanel, HoldingsTable, RelationshipGraphView } from "@/components/investigate/entity-view";
import { EntityActions } from "@/components/investigate/entity-actions";
import { OnchainPanel } from "@/components/investigate/onchain-panel";

interface PageProps {
  params: Promise<{ address: string }>;
  searchParams: Promise<{ tab?: string }>;
}

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "graph", label: "Relationships" },
  { id: "security", label: "Security" },
  { id: "report", label: "Analyst report" },
] as const;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { address } = await params;
  if (!isEvmAddress(address)) return { title: "Investigate" };
  const entity = entitySummary(address);
  return { title: entity.label ?? `Investigate ${address.slice(0, 10)}…` };
}

export default async function EntityPage({ params, searchParams }: PageProps) {
  const { address: raw } = await params;
  const { tab } = await searchParams;

  // ENS names resolve server-side, then canonicalize to the address URL.
  if (!isEvmAddress(raw)) {
    if (!isEnsName(raw)) notFound();
    const resolved = await resolveEns(raw);
    if (!resolved) notFound();
    redirect(`/investigate/${resolved.toLowerCase()}`);
  }
  const address = raw.toLowerCase();

  const entity = entitySummary(address);
  const activeTab = TABS.some((t) => t.id === tab) ? tab! : "overview";
  const txs = activity(entity, 40);
  const report = analystReport(entity);
  const live = await onchainFactsForChains(entity.chains, address);
  const security = securityReport(address, entity, live);
  const nftPositions = nfts(entity);
  const ageDays = Math.max(1, Math.round((Date.UTC(2026, 9, 1) - new Date(entity.firstSeen).getTime()) / 86400_000));
  const inflow = txs.filter((t) => t.type === "receive").reduce((a, t) => a + t.valueUsd, 0);
  const outflow = txs.filter((t) => t.type === "send").reduce((a, t) => a + t.valueUsd, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Investigate · Entity"
        title={entity.label ?? `${address.slice(0, 10)}…${address.slice(-6)}`}
        sub={`${entity.type === "contract" ? "Smart contract" : "Wallet"} · active on ${entity.chains.map((c) => CHAINS[c].name).join(", ")}`}
        action={<EntityActions address={entity.address} />}
      />

      <div className="grid gap-6 lg:grid-cols-4">
        <Panel className="lg:col-span-1">
          <div className="flex flex-col items-center py-2">
            <RiskGauge score={entity.riskScore} level={entity.riskLevel} size={150} />
            <RiskBadge level={entity.riskLevel} />
            <p className="mt-3 text-center text-[11px] text-mist-dim">
              Deterministic score from registry, behavioral, and graph signals.
            </p>
          </div>
          <div className="mt-4 space-y-2 border-t border-ink-700 pt-4 font-mono text-xs">
            <div className="flex justify-between"><span className="text-mist-dim">First seen</span><span>{entity.firstSeen.slice(0, 10)}</span></div>
            <div className="flex justify-between"><span className="text-mist-dim">Age</span><span>{ageDays}d</span></div>
            <div className="flex justify-between"><span className="text-mist-dim">Tx count</span><span>{entity.txCount.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-mist-dim">Balance</span><span>{formatUsd(entity.balanceUsd)}</span></div>
            <div className="flex justify-between"><span className="text-mist-dim">Volume (90d)</span><span>{formatUsd(entity.volumeUsd)}</span></div>
          </div>
        </Panel>

        <div className="space-y-6 lg:col-span-3">
          <Panel>
            <SectionHeader title="Risk flags" sub="Deterministic behavioral & registry signals" />
            <FlagsPanel entity={entity} />
          </Panel>

          <OnchainPanel facts={live} />

          <div className="grid gap-4 sm:grid-cols-3">
            <Panel><div className="label-mono">Inflow 90d</div><div className="mt-1.5 font-mono text-lg text-emerald-400">{formatUsd(inflow)}</div></Panel>
            <Panel><div className="label-mono">Outflow 90d</div><div className="mt-1.5 font-mono text-lg text-red-400">{formatUsd(outflow)}</div></Panel>
            <Panel><div className="label-mono">Security grade</div><div className="mt-1.5 font-mono text-lg">{security.grade} <span className="text-xs text-mist-dim">({security.score}/100)</span></div></Panel>
          </div>
        </div>
      </div>

      <div className="mt-8 flex gap-1 border-b border-ink-700">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/investigate/${entity.address}?tab=${t.id}`}
            className={`rounded-t-lg px-4 py-2.5 text-sm transition-colors ${
              activeTab === t.id ? "border-x border-t border-ink-700 bg-ink-850 text-white" : "text-mist hover:text-mist-bright"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="mt-6">
        {activeTab === "overview" && (
          <div className="space-y-6">
            <Panel>
              <SectionHeader title="Token holdings" sub="Positions attributed to this subject across chains" />
              <HoldingsTable entity={entity} />
            </Panel>
            <Panel>
              <SectionHeader title="Recent activity" sub="Most recent 15 decoded transactions" />
              <ActivityTable entity={entity} />
            </Panel>
            {nftPositions.length > 0 && (
              <Panel>
                <SectionHeader title="NFT positions" sub="Collections held by this subject" />
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {nftPositions.map((n) => (
                    <div key={`${n.collection}-${n.tokenId}`} className="overflow-hidden rounded-lg border border-ink-700">
                      <div
                        className="flex h-24 items-center justify-center font-mono text-xs text-white/70"
                        style={{ background: `linear-gradient(135deg, hsl(${n.gradientSeed} 60% 22%), hsl(${(n.gradientSeed + 80) % 360} 55% 12%))` }}
                      >
                        {n.collection}
                      </div>
                      <div className="flex items-center justify-between px-3 py-2 text-xs">
                        <span className="font-mono text-mist-bright">{n.tokenId}</span>
                        <span className="text-mist-dim">floor {formatUsd(n.floorUsd)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            )}
          </div>
        )}

        {activeTab === "graph" && (
          <Panel>
            <SectionHeader title="Relationship graph" sub="Direct counterparties traced over the lookback window" />
            <RelationshipGraphView entity={entity} />
          </Panel>
        )}

        {activeTab === "security" && (
          <div className="space-y-6">
            <Panel>
              <SectionHeader
                title={`Security audit · grade ${security.grade}`}
                sub={`Score ${security.score}/100 · ${security.liveChains?.length ? `live evidence via ${security.liveChains.map((c) => CHAINS[c as keyof typeof CHAINS]?.name ?? c).join(", ")} public RPC · remaining checks heuristic` : "heuristic checks · deterministic"} · subject ${entity.address.slice(0, 12)}…`}
              />
              <div className="space-y-2">
                {security.checks.map((c) => (
                  <div key={c.id} className="flex items-start gap-3 rounded-lg border border-ink-700 bg-ink-800/50 px-4 py-3">
                    <CheckStatusIcon status={c.status} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-mist-bright">{c.title}</span>
                        <span className="font-mono text-[10px] text-mist-dim">{c.id}</span>
                        <Badge>{c.category}</Badge>
                        {c.source === "onchain" && <Badge tone="cyan">onchain</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-mist">{c.detail}</p>
                      <p className="mt-1 font-mono text-[11px] text-mist-dim">evidence: {c.evidence}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        )}

        {activeTab === "report" && (
          <div className="space-y-6">
            <Panel>
              <SectionHeader
                title="Analyst report"
                sub={`Rule-based engine · confidence ${report.confidence}% · deterministic output`}
                action={<Link href="/integrations" className="text-xs text-cyan-300 hover:underline">Attach LLM provider →</Link>}
              />
              <h3 className="text-lg font-medium text-white">{report.headline}</h3>
              <div className="mt-4 space-y-3">
                {report.narrative.map((p, i) => (
                  <p key={i} className="text-sm leading-relaxed text-mist">{p}</p>
                ))}
              </div>
              <div className="mt-6 space-y-2">
                {report.findings.map((f) => (
                  <div key={f.id} className="rounded-lg border border-ink-700 bg-ink-800/50 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <RiskBadge level={f.severity} small />
                      <span className="text-sm font-medium text-mist-bright">{f.title}</span>
                      <span className="ml-auto font-mono text-[10px] text-mist-dim">{f.id}</span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-mist">{f.detail}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {f.evidence.map((e) => (
                        <span key={e} className="rounded border border-ink-600 px-2 py-0.5 font-mono text-[10px] text-mist-dim">{e}</span>
                      ))}
                    </div>
                  </div>
                ))}
                {report.findings.length === 0 && <p className="text-sm text-mist">No findings raised.</p>}
              </div>
              <div className="mt-6 border-t border-ink-700 pt-4">
                <div className="label-mono mb-2">Sources</div>
                <div className="flex flex-wrap gap-1.5">
                  {report.sources.map((s) => (
                    <Badge key={s}>{s}</Badge>
                  ))}
                </div>
              </div>
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}
