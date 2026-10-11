import type { ChainId, EntitySummary, RelationshipEdge, RelationshipGraph, TokenHolding, TxRecord } from "../types";
import { DEMO_CHAIN_LIST, chainOrNull } from "../chains";
import { KNOWN_ENTITIES, entitySummary, knownEntity, pseudoAddress } from "./entities";
import { Rng, daysAgoIso } from "./prng";
import { TOKENS, tokenBySymbol } from "./tokens";

const BASE_TOKENS = TOKENS.filter((t) => !t.demo).map((t) => t.symbol);
const DEMO_TOKENS = ["NEXA", "HELIX"];

const TX_TYPES = ["send", "receive", "swap", "approve", "contract"] as const;

export function holdings(entity: EntitySummary): TokenHolding[] {
  const rng = new Rng(`holdings:${entity.address}`);
  const count = entity.balanceUsd > 50_000 ? rng.int(4, 8) : rng.int(1, 5);
  const symbols = new Set<string>(rng.sample(BASE_TOKENS, count));
  if (rng.chance(0.4)) symbols.add(rng.pick(DEMO_TOKENS));
  if (knownEntity(entity.address)?.tags.includes("treasury")) {
    symbols.add("NEXA");
    symbols.add("USDC");
  }

  const rows: TokenHolding[] = [];
  for (const symbol of symbols) {
    const meta = tokenBySymbol(symbol);
    if (!meta) continue;
    const weight = rng.float();
    const valueUsd = Math.max(12, Math.round(entity.balanceUsd * (weight / Math.max(1, count)) * rng.logScale(0.6, 2.4)));
    rows.push({
      token: meta.name,
      symbol,
      chain: rng.chance(0.65) ? meta.chain : (rng.pick(entity.chains) as ChainId),
      amount: valueUsd / meta.priceUsd,
      priceUsd: meta.priceUsd,
      valueUsd,
      change24h: meta.change24h,
    });
  }
  return rows.sort((a, b) => b.valueUsd - a.valueUsd);
}

export function activity(entity: EntitySummary, limit = 40): TxRecord[] {
  const rng = new Rng(`activity:${entity.address}`);
  const count = Math.min(limit, Math.max(8, Math.min(entity.txCount, 60)));
  const counterparties = relationshipTargets(entity.address, 10);

  const txs: TxRecord[] = [];
  for (let i = 0; i < count; i++) {
    const type = rng.pick(TX_TYPES);
    const meta = tokenBySymbol(rng.pick(type === "approve" ? [...BASE_TOKENS, ...DEMO_TOKENS] : BASE_TOKENS)) ?? tokenBySymbol("WETH")!;
    const valueUsd = Math.round(rng.logScale(40, entity.volumeUsd / 4));
    const cp = counterparties[rng.int(0, counterparties.length - 1)];
    const daysBack = Math.pow(rng.float(), 1.6) * 90;
    txs.push({
      hash: `0x${shortHash(`tx:${entity.address}:${i}`)}`,
      chain: cp.chain,
      type,
      token: meta.name,
      symbol: meta.symbol,
      amount: valueUsd / meta.priceUsd,
      valueUsd,
      counterparty: cp.address,
      counterpartyLabel: cp.label,
      timestamp: daysAgoIso(daysBack + rng.float()),
      status: rng.chance(0.96) ? "success" : "failed",
      gasUsd: Number((rng.logScale(0.4, 18) * ((chainOrNull(cp.chain)?.avgGasGwei ?? 1) > 10 ? 3 : 0.2)).toFixed(2)),
    });
  }
  return txs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function shortHash(seed: string): string {
  const rng = new Rng(seed);
  let out = "";
  for (let i = 0; i < 62; i++) out += "0123456789abcdef"[rng.int(0, 15)];
  return out;
}

interface RelationshipTarget {
  address: string;
  label: string | null;
  chain: ChainId;
}

const ANCHOR_CP = KNOWN_ENTITIES.filter((e) => !e.tags.includes("workspace"));

/** The stable pool of entities this address transacts with. */
export function relationshipTargets(address: string, count: number): (RelationshipTarget & { weight: number; volumeUsd: number; firstInteraction: string; riskLevel: ReturnType<typeof entitySummary>["riskLevel"] })[] {
  const rng = new Rng(`relations:${address}`);
  const known = knownEntity(address);
  const total = Math.min(count, rng.int(6, 12));
  const targets: RelationshipTarget[] = [];

  // 1-2 named anchors keep the graph meaningful.
  const anchors: RelationshipTarget[] = rng
    .sample(ANCHOR_CP, Math.min(known ? 3 : 2, ANCHOR_CP.length))
    .map((e) => ({ address: e.address, label: e.label, chain: entitySummary(e.address).chains[0] }));
  targets.push(...anchors);
  while (targets.length < total) {
    const addr = pseudoAddress(`peer:${address}:${targets.length}`);
    if (!targets.some((t) => t.address === addr)) targets.push({ address: addr, label: null, chain: rng.pick(DEMO_CHAIN_LIST.map((c) => c.id)) as ChainId });
  }

  return targets.map((t) => {
    const volume = Math.round(rng.logScale(500, 4_200_000));
    const first = rng.int(2, 400);
    return {
      ...t,
      weight: rng.int(3, 260),
      volumeUsd: volume,
      firstInteraction: daysAgoIso(first),
      riskLevel: entitySummary(t.address).riskLevel,
    };
  }).sort((a, b) => b.volumeUsd - a.volumeUsd);
}

export function relationshipGraph(entity: EntitySummary): RelationshipGraph {
  const targets = relationshipTargets(entity.address, 12);
  const rng = new Rng(`clusters:${entity.address}`);

  const edges: RelationshipEdge[] = targets.map((t) => ({
    node: t.address,
    label: t.label,
    type: knownEntity(t.address)?.type ?? (t.address < entity.address ? "wallet" : "contract"),
    weight: t.weight,
    volumeUsd: t.volumeUsd,
    txCount: t.weight,
    firstInteraction: t.firstInteraction,
    riskLevel: t.riskLevel,
  }));

  // Group peers that share a funding pattern into clusters.
  const flagged = edges.filter((e) => e.riskLevel === "high" || e.riskLevel === "critical");
  const exchange = edges.filter((e) => knownEntity(e.node)?.tags.includes("exchange"));
  const rest = edges.filter((e) => !flagged.includes(e) && !exchange.includes(e));

  const clusters: RelationshipGraph["clusters"] = [];
  if (exchange.length > 0) clusters.push({ id: "custody", label: "Custody / exchange", members: exchange.map((e) => e.node) });
  if (flagged.length > 0) clusters.push({ id: "flagged", label: "Flagged exposure", members: flagged.map((e) => e.node) });
  if (rest.length > 1) {
    const mid = Math.ceil(rest.length / 2);
    clusters.push({ id: "cluster-a", label: `Funding cluster A (${rng.int(2, 9)} hops traced)`, members: rest.slice(0, mid).map((e) => e.node) });
    clusters.push({ id: "cluster-b", label: "Counterparty mesh", members: rest.slice(mid).map((e) => e.node) });
  }

  return { root: entity.address, edges, clusters };
}

export interface NftPosition {
  collection: string;
  tokenId: string;
  chain: ChainId;
  floorUsd: number;
  gradientSeed: number;
}

const COLLECTIONS = [
  "Azuki", "Pudgy Penguins", "Bored Ape Yacht Club", "Doodles",
  "Milady", "Onchain Summer", "Based Ghouls", "Kaiju Kingz",
];

export function nfts(entity: EntitySummary): NftPosition[] {
  const rng = new Rng(`nft:${entity.address}`);
  const count = rng.chance(0.55) ? rng.int(0, 2) : rng.int(3, 7);
  const rows: NftPosition[] = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      collection: rng.pick(COLLECTIONS),
      tokenId: `#${rng.int(1, 9999)}`,
      chain: rng.pick(entity.chains) as ChainId,
      floorUsd: Math.round(rng.logScale(90, 68_000)),
      gradientSeed: rng.int(0, 359),
    });
  }
  return rows;
}
