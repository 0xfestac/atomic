import type { ChainId, EntitySummary, EntityType, RiskFlag, RiskLevel } from "../types";
import { DEMO_CHAIN_IDS } from "../chains";
import { Rng, daysAgoIso, isEvmAddress, seededHex } from "./prng";

export interface KnownEntity {
  address: string;
  label: string;
  type: EntityType;
  note: string;
  tags: string[];
  riskBias: number; // -30 (safe) .. +40 (risky) adjustment on base risk
}

/**
 * Named anchors in the demo data plane. Real, well-known public addresses
 * keep the dataset recognizable; synthetic ones are clearly tagged.
 */
export const KNOWN_ENTITIES: KnownEntity[] = [
  {
    address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    label: "vitalik.eth",
    type: "wallet",
    note: "Public figure wallet. High-visibility inbound dust and airdrop claims.",
    tags: ["public-figure", "seed-investor"],
    riskBias: -22,
  },
  {
    address: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    label: "Uniswap V3 Router",
    type: "contract",
    note: "Canonical Uniswap V3 swap router. Widely allow-listed.",
    tags: ["dex-router", "verified"],
    riskBias: -25,
  },
  {
    address: "0x28C6c06298d514Db089934071355E5743bf21d60",
    label: "Binance Hot Wallet 14",
    type: "wallet",
    note: "Exchange custody wallet. Massive outflow/inflow cycles.",
    tags: ["exchange", "custodian"],
    riskBias: -12,
  },
  {
    address: "0xa70f1c00000000000000000000000000000a70f1",
    label: "ATOMIC Treasury (demo)",
    type: "wallet",
    note: "Operational treasury tracked by this ATOMIC workspace. Demo anchor.",
    tags: ["treasury", "workspace"],
    riskBias: -18,
  },
  {
    address: "0x00000000219ab540356cbb839cbe05303d7705fa",
    label: "Beacon Deposit Contract",
    type: "contract",
    note: "Ethereum staking entrypoint. One-way ETH inflow.",
    tags: ["staking", "protocol"],
    riskBias: -20,
  },
  {
    address: "0x5f260e612d8e2aa66e4174025197e9d68ee743c4",
    label: "Mixeree Pro (flagged)",
    type: "contract",
    note: "Mixing service. Flagged by multiple risk registries (demo attribution).",
    tags: ["mixer", "flagged", "sanctions-watch"],
    riskBias: 38,
  },
  {
    address: "0x9f8c1d3b7a2e4f5a6b8c0d1e2f3a4b5c6d7e8f9a",
    label: "StealthLaunch Router (flagged)",
    type: "contract",
    note: "Unverified router linked to multiple honeypot launches (demo attribution).",
    tags: ["unverified", "honeypot-linked", "flagged"],
    riskBias: 32,
  },
  {
    address: "0x1db34f1a4d9a2c8f0e7b6c5d4e3f2a1b0c9d8e7f",
    label: "Airdrop Farmer Cluster 7",
    type: "wallet",
    note: "Sybil-cluster representative wallet (demo attribution).",
    tags: ["sybil-cluster", "farmer"],
    riskBias: 14,
  },
];

const KNOWN_BY_ADDRESS = new Map(
  KNOWN_ENTITIES.map((e) => [e.address.toLowerCase(), e]),
);

export function knownEntity(address: string): KnownEntity | undefined {
  return KNOWN_BY_ADDRESS.get(address.toLowerCase());
}

/** Quick lookup for search + QA. */
export function findEntities(query: string): KnownEntity[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return KNOWN_ENTITIES.filter(
    (e) => e.label.toLowerCase().includes(q) || e.address.toLowerCase().includes(q),
  );
}

const FLAG_POOL: { id: string; label: string; level: RiskLevel; detail: (seed: string) => string }[] = [
  { id: "mixer-touch", label: "Mixer exposure", level: "high", detail: () => "2 direct interactions with a flagged mixing contract within the lookback window." },
  { id: "fresh-wallet", label: "Fresh wallet", level: "medium", detail: (s) => `Funded ${new Rng(`fund:${s}`).int(1, 12)} days ago; limited history before activation.` },
  { id: "sybil-pattern", label: "Sybil pattern", level: "medium", detail: () => "Activity fingerprint matches a coordinated farming cluster (shared funding source)." },
  { id: "dust-attack", label: "Dusted", level: "low", detail: () => "Received micro-transfers with poisoned calldata addressed to known labels." },
  { id: "high-velocity", label: "High velocity", level: "low", detail: () => "Value churn far exceeds balance; pass-through behavior typical of brokers." },
  { id: "flagged-counterparty", label: "Flagged counterparty", level: "high", detail: () => "Repeated exposure to contracts flagged for honeypot behavior." },
  { id: "unverified-deployer", label: "Unverified deploys", level: "medium", detail: () => "Deployed contracts without verified source across 2 chains." },
];

const MAX_FLAGS = 3;

export function riskLevelOf(score: number): RiskLevel {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

export function normalizeAddress(value: string): string | null {
  const trimmed = value.trim();
  if (!isEvmAddress(trimmed)) return null;
  return trimmed.toLowerCase();
}

/**
 * Deterministic entity profile for any EVM address. `chainPool` is the
 * set of chains the profile may sample: server surfaces pass the active
 * registry so operator-configured chains participate in the demo plane;
 * the default is the built-in fallback (identical in the browser bundle
 * and tests). An empty pool falls back to the built-ins.
 */
export function entitySummary(rawAddress: string, chainPool: readonly ChainId[] = DEMO_CHAIN_IDS): EntitySummary {
  const address = normalizeAddress(rawAddress) ?? rawAddress.toLowerCase();
  const known = knownEntity(address);
  const rng = new Rng(`entity:${address}`);
  const pool = chainPool.length > 0 ? chainPool : DEMO_CHAIN_IDS;

  const type: EntityType = known?.type ?? (rng.chance(0.35) ? "contract" : "wallet");
  const chainCount = known ? rng.int(2, 4) : rng.int(1, 4);
  // Profiles sample the supplied pool, so the same registry on server
  // and client (passed down as props) renders identical chains.
  const chains = rng.sample(pool, chainCount) as ChainId[];
  const firstSeenDays = known ? rng.int(900, 2600) : rng.int(3, 1400);
  const lastActiveDays = known ? rng.int(0, 4) : rng.int(0, 45);

  const baseRisk = type === "contract" ? 30 : 22;
  const jitter = rng.int(-10, 26);
  const rawScore = Math.max(2, Math.min(97, baseRisk + jitter + (known?.riskBias ?? 0)));
  const riskScore = known && known.riskBias >= 30 ? Math.min(92, rawScore + 30) : rawScore;

  const flagCount = known && known.riskBias >= 30 ? 3 : riskScore > 55 ? rng.int(1, MAX_FLAGS) : riskScore > 30 ? rng.int(0, 2) : rng.chance(0.25) ? 1 : 0;
  const flags: RiskFlag[] = (flagCount > 0 ? rng.sample(FLAG_POOL, flagCount) : []).map((f) => ({
    id: f.id,
    label: f.label,
    level: f.level,
    detail: f.detail(address),
  }));
  if (known?.tags.includes("mixer")) {
    flags.unshift({
      id: "registry-mixer",
      label: "Risk registry: mixer",
      level: "critical",
      detail: known.note,
    });
  }
  if (known?.tags.includes("honeypot-linked")) {
    flags.unshift({
      id: "registry-honeypot",
      label: "Risk registry: honeypot-linked",
      level: "critical",
      detail: known.note,
    });
  }

  return {
    address,
    label: known?.label ?? null,
    type,
    chains,
    firstSeen: daysAgoIso(firstSeenDays),
    lastActive: daysAgoIso(lastActiveDays),
    txCount: known ? rng.int(4_800, 180_000) : rng.int(4, 2_400),
    volumeUsd: Math.round(rng.logScale(2_000, 42_000_000)),
    riskScore,
    riskLevel: riskLevelOf(riskScore),
    riskFlags: flags,
    balanceUsd: Math.round(rng.logScale(120, 9_800_000) * (known ? 8 : 1)),
  };
}

export function pseudoAddress(seed: string): string {
  return `0x${seededHex(seed, 40)}`;
}
