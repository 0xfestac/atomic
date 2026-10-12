import type { TokenomicsProfile, VestingPoint, VestingTranche } from "../types";
import { Rng, DATA_NOW, daysAgoIso } from "../engine/prng";
import { tokenBySymbol } from "../engine/tokens";
import { pseudoAddress } from "../engine/entities";

/**
 * Tokenomics & vesting modeling for the demo project tokens (NEXA, HELIX).
 * Deterministic: the same token always yields the same allocation,
 * schedule, and holder table.
 */

const BUCKETS = [
  { bucket: "Team & advisors", sharePct: 22, tgeUnlockPct: 0, cliffMonths: 12, linearMonths: 24 },
  { bucket: "Investors (seed)", sharePct: 14, tgeUnlockPct: 0, cliffMonths: 6, linearMonths: 18 },
  { bucket: "Investors (strategic)", sharePct: 10, tgeUnlockPct: 10, cliffMonths: 3, linearMonths: 15 },
  { bucket: "Community & incentives", sharePct: 32, tgeUnlockPct: 20, cliffMonths: 0, linearMonths: 30 },
  { bucket: "Treasury / DAO", sharePct: 14, tgeUnlockPct: 5, cliffMonths: 0, linearMonths: 36 },
  { bucket: "Liquidity provisioning", sharePct: 8, tgeUnlockPct: 100, cliffMonths: 0, linearMonths: 0 },
];

const KINDS = ["contract:vesting", "contract:staking", "wallet", "contract:treasury", "exchange", "contract:lp"];

export function tokenomicsProfile(symbol: string): TokenomicsProfile | null {
  const meta = tokenBySymbol(symbol);
  if (!meta || !meta.demo) return null;

  const rng = new Rng(`tokenomics:${symbol}`);
  const tgeMonthsAgo = rng.int(5, 9);
  const tgeDate = daysAgoIso(tgeMonthsAgo * 30);
  const totalSupply = meta.demo ? Math.round(rng.logScale(80e6, 1e9) / 1e6) * 1e6 : 0;

  const schedule = buildSchedule(BUCKETS, tgeMonthsAgo);

  const holders = Array.from({ length: 10 }, (_, i) => {
    const share = (rng.logScale(1.4, 9) * Math.pow(0.82, i)).toFixed(2);
    return {
      rank: i + 1,
      label: i === 0 ? "Vesting contract" : i === 3 ? "Team multisig" : i === 5 ? "LP vault" : null,
      address: pseudoAddress(`holder:${symbol}:${i}`),
      sharePct: Number(share),
      kind: i === 0 ? "contract:vesting" : i === 3 ? "wallet:multisig" : rng.pick(KINDS),
    };
  });

  const top10Pct = Number(holders.reduce((acc, h) => acc + h.sharePct, 0).toFixed(1));
  const nowPct = schedule.length > 0 ? schedule[Math.min(schedule.length - 1, Math.floor((DATA_NOW - new Date(tgeDate).getTime()) / (30 * 86400_000)))].circulatingPct : 0;
  const next12Pct = schedule.length > 0 ? schedule[Math.min(schedule.length - 1, Math.floor((DATA_NOW - new Date(tgeDate).getTime()) / (30 * 86400_000)) + 12)].circulatingPct : 0;

  return {
    symbol: meta.symbol,
    name: meta.name,
    totalSupply,
    circulatingPct: nowPct,
    allocation: BUCKETS,
    schedule,
    tgeDate,
    holders,
    concentration: { top10Pct, giniHint: top10Pct > 45 ? "high" : top10Pct > 30 ? "moderate" : "healthy" },
    unlockOverhangPct: Number((next12Pct - nowPct).toFixed(1)),
  };
}

function buildSchedule(tranches: VestingTranche[], tgeMonthsAgo: number): VestingPoint[] {
  const points: VestingPoint[] = [];
  const totalMonths = tgeMonthsAgo + 36;
  for (let m = 0; m <= totalMonths; m++) {
    let unlocked = 0;
    for (const t of tranches) {
      const tge = t.sharePct * (t.tgeUnlockPct / 100);
      const remaining = t.sharePct - tge;
      if (t.linearMonths === 0) {
        unlocked += t.sharePct;
        continue;
      }
      const elapsed = m - t.cliffMonths;
      if (elapsed <= 0) {
        unlocked += tge;
      } else {
        const linear = Math.min(1, elapsed / t.linearMonths);
        unlocked += tge + remaining * linear;
      }
    }
    const date = new Date(DATA_NOW - tgeMonthsAgo * 30 * 86400_000 + m * 30 * 86400_000);
    points.push({
      month: m,
      date: date.toISOString(),
      circulatingPct: Number(Math.min(100, unlocked).toFixed(1)),
    });
  }
  return points;
}
