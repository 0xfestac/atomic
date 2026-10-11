import Link from "next/link";
import { formatUsd, shortAddress } from "@/lib/atomic/engine/prng";
import { TOKENS, tokenBySymbol } from "@/lib/atomic/engine/tokens";
import { tokenomicsProfile } from "@/lib/atomic/vesting/schedules";
import { Badge, PageHeader, Panel, SectionHeader, Stat } from "@/components/ui";

export const metadata = { title: "Tokenomics" };

function VestingChart({ schedule, tgeDate }: { schedule: { month: number; date: string; circulatingPct: number }[]; tgeDate: string }) {
  const W = 720;
  const H = 260;
  const pad = { l: 42, r: 16, t: 16, b: 28 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const maxM = Math.max(...schedule.map((p) => p.month), 1);
  const x = (m: number) => pad.l + (m / maxM) * iw;
  const y = (pct: number) => pad.t + ih - (pct / 100) * ih;

  const line = schedule.map((p) => `${x(p.month).toFixed(1)},${y(p.circulatingPct).toFixed(1)}`).join(" ");
  const area = `${pad.l},${y(0)} ${line} ${x(maxM).toFixed(1)},${y(0)}`;
  const nowM = Math.max(0, Math.min(maxM, Math.round((Date.now() - new Date(tgeDate).getTime()) / (30 * 86400_000))));
  const nowPct = schedule.find((p) => p.month >= nowM)?.circulatingPct ?? 0;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Vesting schedule">
      {[0, 25, 50, 75, 100].map((g) => (
        <g key={g}>
          <line x1={pad.l} y1={y(g)} x2={W - pad.r} y2={y(g)} stroke="#1a2133" strokeWidth="1" />
          <text x={pad.l - 8} y={y(g) + 3} textAnchor="end" fontSize="9" fill="#5b6378" className="font-mono">{g}%</text>
        </g>
      ))}
      <polygon points={area} fill="#22d3ee" opacity="0.08" />
      <polyline points={line} fill="none" stroke="#22d3ee" strokeWidth="2" />
      <line x1={x(nowM)} y1={pad.t} x2={x(nowM)} y2={pad.t + ih} stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="4 4" />
      <text x={x(nowM) + 6} y={pad.t + 12} fontSize="10" fill="#8b5cf6" className="font-mono">today · {nowPct}% circulating</text>
      <text x={x(0) + 4} y={H - 8} fontSize="9" fill="#5b6378" className="font-mono">TGE {tgeDate.slice(0, 10)}</text>
      <text x={x(maxM)} y={H - 8} textAnchor="end" fontSize="9" fill="#5b6378" className="font-mono">month {maxM}</text>
    </svg>
  );
}

export default async function TokenomicsPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const demoTokens = TOKENS.filter((t) => t.demo);
  const selectedSymbol = demoTokens.some((t) => t.symbol === token?.toUpperCase()) ? token!.toUpperCase() : "NEXA";
  const profile = tokenomicsProfile(selectedSymbol);
  const meta = tokenBySymbol(selectedSymbol)!;

  if (!profile) {
    return <p className="text-sm text-mist">No tokenomics profile available.</p>;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Tokenomics"
        title="Supply, allocation & vesting"
        sub="Deterministic tokenomics model for tracked project tokens. Synthetic project tokens are clearly marked as demo data — ATOMIC introduces no token of its own."
        action={
          <div className="flex gap-2">
            {demoTokens.map((t) => (
              <Link
                key={t.symbol}
                href={`/tokenomics?token=${t.symbol}`}
                className={t.symbol === selectedSymbol ? "btn-primary" : "btn-ghost"}
              >
                {t.symbol}
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total supply" value={`${(profile.totalSupply / 1e6).toFixed(0)}M`} sub={`${meta.symbol} · fixed cap`} tone="cyan" />
        <Stat label="Circulating" value={`${profile.circulatingPct}%`} sub="of total supply" />
        <Stat label="Top-10 holders" value={`${profile.concentration.top10Pct}%`} sub={`concentration: ${profile.concentration.giniHint}`} tone={profile.concentration.top10Pct > 45 ? "red" : undefined} />
        <Stat label="12-month unlocks" value={`+${profile.unlockOverhangPct}%`} sub="supply overhang ahead" tone={profile.unlockOverhangPct > 15 ? "red" : "green"} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Panel className="lg:col-span-3">
          <SectionHeader title="Vesting schedule" sub="Unlocked share of total supply over time (cliffs included)" />
          <VestingChart schedule={profile.schedule} tgeDate={profile.tgeDate} />
        </Panel>

        <Panel className="lg:col-span-2">
          <SectionHeader title="Allocation" sub="Bucket-level unlock terms" />
          <table className="grid-table">
            <thead>
              <tr>
                <th className="th">Bucket</th>
                <th className="th">Share</th>
                <th className="th">Cliff</th>
                <th className="th">Linear</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {profile.allocation.map((a) => (
                <tr key={a.bucket}>
                  <td className="td text-xs">{a.bucket}</td>
                  <td className="td font-mono text-xs">{a.sharePct}%</td>
                  <td className="td font-mono text-xs">{a.cliffMonths}mo{a.tgeUnlockPct > 0 ? ` · ${a.tgeUnlockPct}% TGE` : ""}</td>
                  <td className="td font-mono text-xs">{a.linearMonths === 0 ? "liquid" : `${a.linearMonths}mo`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel>
          <SectionHeader title="Holder distribution" sub="Top 10 accounts (deterministic model)" />
          <table className="grid-table">
            <thead>
              <tr>
                <th className="th">#</th>
                <th className="th">Holder</th>
                <th className="th">Kind</th>
                <th className="th">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {profile.holders.map((h) => (
                <tr key={h.address}>
                  <td className="td font-mono text-xs text-mist-dim">{h.rank}</td>
                  <td className="td">
                    <Link href={`/investigate/${h.address}`} className="font-mono text-xs text-cyan-300 hover:underline">
                      {h.label ?? shortAddress(h.address)}
                    </Link>
                  </td>
                  <td className="td font-mono text-[11px] text-mist-dim">{h.kind}</td>
                  <td className="td font-mono text-xs">{h.sharePct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel>
          <SectionHeader title="Due-diligence readout" sub="Auto-derived from the model above" />
          <div className="space-y-3 text-sm leading-relaxed text-mist">
            <p>
              <span className="text-mist-bright">Supply overhang:</span> {profile.unlockOverhangPct}% of total supply unlocks over the next 12 months.
              {profile.unlockOverhangPct > 15 ? " This is material relative to float — model exit liquidity before large positioning." : " Overhang is modest relative to current float."}
            </p>
            <p>
              <span className="text-mist-bright">Concentration:</span> top-10 accounts hold {profile.concentration.top10Pct}% — {profile.concentration.giniHint === "healthy" ? "within normal bounds for the category." : "monitor for coordinated exits; largest accounts are contracts (vesting/staking) which reduces immediate sell pressure."}
            </p>
            <p>
              <span className="text-mist-bright">Cliff risk:</span> the seed tranche ({profile.allocation[1].sharePct}%) exits its {profile.allocation[1].cliffMonths}-month cliff at month {profile.allocation[1].cliffMonths} and unlocks linearly over {profile.allocation[1].linearMonths} months.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="cyan">market cap {formatUsd(meta.marketCapUsd)}</Badge>
            <Badge>liquidity {formatUsd(meta.liquidityUsd)}</Badge>
            <Badge tone={meta.demo ? "amber" : "green"}>{meta.demo ? "synthetic demo token" : "live asset"}</Badge>
            <Link href={`/security?address=${meta.address}`} className="text-xs text-cyan-300 hover:underline">
              Run security audit →
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}
