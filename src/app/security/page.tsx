import Link from "next/link";
import { entitySummary } from "@/lib/atomic/engine/entities";
import { isEvmAddress } from "@/lib/atomic/engine/prng";
import { securityReport } from "@/lib/atomic/security/checks";
import { Badge, CheckStatusIcon, PageHeader, Panel, RiskBadge, SectionHeader, Stat } from "@/components/ui";
import { AddressScanForm } from "@/components/security/scan-form";

export const metadata = { title: "Security" };

const CATEGORIES: { id: string; label: string; sub: string }[] = [
  { id: "contract", label: "Contract integrity", sub: "source, proxies, upgradeability" },
  { id: "ownership", label: "Ownership & minting", sub: "admin keys, mint authority" },
  { id: "economy", label: "Token economy", sub: "concentration, distribution" },
  { id: "behavior", label: "Behavior", sub: "blacklists, taxes, deployer history" },
  { id: "liquidity", label: "Liquidity", sub: "locks, burn, exit risk" },
];

export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ address?: string }> }) {
  const { address } = await searchParams;
  const valid = address !== undefined && isEvmAddress(address);
  const report = valid ? securityReport(address!) : null;
  const entity = valid ? entitySummary(address!) : null;

  return (
    <div>
      <PageHeader
        eyebrow="Security · Verify"
        title="Deterministic security checks"
        sub="Fixed, explainable rules over contract surfaces and behavioral signals — every result links to its evidence. No model calls in the scoring path."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-1">
          <SectionHeader title="Scan a subject" sub="Token, contract, or wallet address" />
          <AddressScanForm initial={valid ? address : ""} />
          <div className="mt-5 space-y-2 border-t border-ink-700 pt-4">
            <div className="label-mono mb-1">Check categories</div>
            {CATEGORIES.map((c) => (
              <div key={c.id} className="rounded-lg border border-ink-700 bg-ink-800/50 px-3 py-2">
                <p className="text-xs text-mist-bright">{c.label}</p>
                <p className="text-[11px] text-mist-dim">{c.sub}</p>
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-6 lg:col-span-2">
          {!report || !entity ? (
            <Panel>
              <div className="flex h-full min-h-64 flex-col items-center justify-center text-center">
                <p className="text-sm text-mist-bright">Enter an address to run the audit</p>
                <p className="mt-1 max-w-sm text-xs text-mist-dim">
                  Checks cover source verification, ownership, mint authority, holder concentration, honeypot heuristics, liquidity locks, deployer reputation, and registry screening.
                </p>
              </div>
            </Panel>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Stat label="Grade" value={report.grade} sub={`${report.score}/100 composite`} tone={report.score >= 72 ? "green" : report.score >= 55 ? undefined : "red"} />
                <Stat label="Subject" value={<span className="font-mono text-sm">{entity.label ?? `${address!.slice(0, 10)}…`}</span>} sub={entity.type} />
                <Stat label="Entity risk" value={`${entity.riskScore}/100`} sub={<Link className="text-cyan-300 hover:underline" href={`/investigate/${entity.address}`}>open investigation →</Link>} />
              </div>

              <Panel>
                <SectionHeader title={`Audit results · ${report.checks.length} checks`} sub="Generated deterministically — identical input, identical report" action={<RiskBadge level={entity.riskLevel} />} />
                <div className="space-y-2">
                  {report.checks.map((c) => (
                    <div key={c.id} className="flex items-start gap-3 rounded-lg border border-ink-700 bg-ink-800/50 px-4 py-3">
                      <CheckStatusIcon status={c.status} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm text-mist-bright">{c.title}</span>
                          <span className="font-mono text-[10px] text-mist-dim">{c.id}</span>
                          <Badge>{c.category}</Badge>
                          {c.status !== "pass" && c.status !== "info" && <Badge tone={c.status === "fail" ? "red" : "amber"}>severity if failed: {c.severityIfFail}</Badge>}
                        </div>
                        <p className="mt-1 text-xs text-mist">{c.detail}</p>
                        <p className="mt-1 font-mono text-[11px] text-mist-dim">evidence: {c.evidence}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
