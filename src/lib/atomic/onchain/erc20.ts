import type { ChainId, ConfiguredToken, LiveTokenPosition, LiveTransfer } from "../types";
import { CHAINS } from "../chains";
import { decodeEvmString, hexToBigInt } from "./adapter";
import { toChecksumAddress } from "./keccak";
import { isEvmAddress } from "../engine/prng";
import { liveEnabled, rpcCall } from "./rpc";

/**
 * Live ERC-20 enrichment over keyless public RPC — no indexer required:
 *
 *   - `liveTokenBalances` reads balanceOf() for each token pinned to the
 *     chain (operator config, else the curated major-token list below)
 *     and returns the non-zero positions.
 *   - `liveTransfers` scans recent blocks via eth_getLogs for Transfer
 *     events touching the subject (two filtered scans: sender side and
 *     recipient side), decodes them, and annotates block timestamps.
 *
 * Every function degrades to null (or []) instead of throwing, so a
 * chain whose RPC limits eth_getLogs simply yields no live rows and the
 * UI stays on the labeled deterministic demo plane.
 */

const BALANCE_OF = "0x70a08231"; // balanceOf(address)
const DECIMALS = "0x313ce567"; // decimals()
const SYMBOL = "0x95d89b41"; // symbol()

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/**
 * Curated major tokens for the built-in chains — real, canonical
 * contracts. Symbols/decimals are display hints; positions always carry
 * what the chain itself returned (unknown addresses are read live).
 */
const CURATED: Record<string, ConfiguredToken[]> = {
  ethereum: [
    { address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", symbol: "USDC", name: "USD Coin", decimals: 6 },
    { address: "0xdac17f958d2ee523a2206206994597c13d831ec7", symbol: "USDT", name: "Tether USD", decimals: 6 },
    { address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", symbol: "WETH", name: "Wrapped Ether", decimals: 18 },
    { address: "0xae7ab96520de3a18e5e111b5eaab095312d7fe84", symbol: "stETH", name: "Lido Staked Ether", decimals: 18 },
    { address: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", symbol: "WBTC", name: "Wrapped Bitcoin", decimals: 8 },
    { address: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", symbol: "UNI", name: "Uniswap", decimals: 18 },
    { address: "0x514910771af9ca656af840dff83e8264ecf986ca", symbol: "LINK", name: "Chainlink", decimals: 18 },
  ],
  base: [
    { address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", symbol: "USDC", name: "USD Coin", decimals: 6 },
    { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", name: "Wrapped Ether", decimals: 18 },
    { address: "0x940181a94a35a4569e4529a3cdfb74e38fd98631", symbol: "AERO", name: "Aerodrome", decimals: 18 },
  ],
  arbitrum: [
    { address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831", symbol: "USDC", name: "USD Coin", decimals: 6 },
    { address: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", symbol: "USD₮0", name: "Tether USD₮0", decimals: 6 },
    { address: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", symbol: "WETH", name: "Wrapped Ether", decimals: 18 },
    { address: "0x912ce59144191c1204e64559fe8253a0e49e6548", symbol: "ARB", name: "Arbitrum", decimals: 18 },
  ],
  optimism: [
    { address: "0x0b2c639c533813f4aa9d7837caf62653d097ff85", symbol: "USDC", name: "USD Coin", decimals: 6 },
    { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", name: "Wrapped Ether", decimals: 18 },
    { address: "0x4200000000000000000000000000000000000042", symbol: "OP", name: "Optimism", decimals: 18 },
  ],
  polygon: [
    { address: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", symbol: "USDC", name: "USD Coin", decimals: 6 },
    { address: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f", symbol: "USDT0", name: "Tether USD₮0", decimals: 6 },
    { address: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619", symbol: "WETH", name: "Wrapped Ether", decimals: 18 },
  ],
  bnb: [
    { address: "0x55d398326f99059ff775485246999027b3197955", symbol: "USDT", name: "Tether USD", decimals: 18 },
    { address: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", symbol: "WBNB", name: "Wrapped BNB", decimals: 18 },
    { address: "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82", symbol: "Cake", name: "PancakeSwap", decimals: 18 },
  ],
  avalanche: [
    { address: "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e", symbol: "USDC", name: "USD Coin", decimals: 6 },
    { address: "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7", symbol: "WAVAX", name: "Wrapped AVAX", decimals: 18 },
  ],
};

/** Tokens probed on a chain: operator config wins, else the curated built-ins. */
export function chainTokens(chain: ChainId): ConfiguredToken[] {
  const configured = CHAINS[chain]?.tokens;
  if (configured !== undefined) return configured;
  return CURATED[chain] ?? [];
}

function padTopic(address: string): string {
  return "0x" + address.replace(/^0x/, "").toLowerCase().padStart(64, "0");
}

function topicToAddress(topic: string): string | null {
  if (typeof topic !== "string" || topic.length !== 66) return null;
  const addr = "0x" + topic.slice(26);
  return isEvmAddress(addr) ? addr.toLowerCase() : null;
}

/** Decode a symbol() return: dynamic string or bytes32 (e.g. MKR). */
export function decodeSymbolData(data: string): string | null {
  const body = data.slice(2);
  if (body.length === 64) {
    // bytes32: left-aligned ASCII, zero-padded
    const raw = body.replace(/(00)+$/, "");
    if (raw.length === 0 || raw.length % 2 !== 0) return null;
    const bytes = new Uint8Array(raw.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(raw.slice(i * 2, i * 2 + 2), 16);
    const text = new TextDecoder().decode(bytes).trim();
    return text.length > 0 ? text : null;
  }
  const decoded = decodeEvmString(data);
  return decoded && decoded.length > 0 ? decoded : null;
}

const META_TTL = 600_000;
const metaCache = new Map<string, { at: number; symbol: string | null; decimals: number | null }>();

async function tokenMeta(chain: ChainId, token: string, base: ConfiguredToken): Promise<{ symbol: string | null; decimals: number | null }> {
  if (base.symbol !== undefined && base.decimals !== undefined) {
    return { symbol: base.symbol, decimals: base.decimals };
  }
  const key = `${chain}:${token.toLowerCase()}`;
  const cached = metaCache.get(key);
  const now = Date.now();
  if (cached && now - cached.at < META_TTL) return { symbol: cached.symbol, decimals: cached.decimals };

  let symbol = base.symbol ?? null;
  let decimals = base.decimals ?? null;
  const calls: Promise<void>[] = [];
  if (symbol === null) {
    calls.push(
      rpcCall<string>(chain, "eth_call", [{ to: token, data: SYMBOL }, "latest"], { retries: 0, timeoutMs: 6_000 })
        .then((raw) => {
          symbol = decodeSymbolData(raw);
        })
        .catch(() => {}),
    );
  }
  if (decimals === null) {
    calls.push(
      rpcCall<string>(chain, "eth_call", [{ to: token, data: DECIMALS }, "latest"], { retries: 0, timeoutMs: 6_000 })
        .then((raw) => {
          const d = Number(hexToBigInt(raw));
          if (d >= 0 && d <= 36) decimals = d;
        })
        .catch(() => {}),
    );
  }
  await Promise.all(calls);
  if (metaCache.size > 2_000) metaCache.clear();
  metaCache.set(key, { at: now, symbol, decimals });
  return { symbol, decimals };
}

const POSITIONS_TTL = 60_000;
const positionsCache = new Map<string, { at: number; positions: LiveTokenPosition[] | null }>();

/**
 * Non-zero ERC-20 balances for an address on one chain, largest first.
 * null when live mode is off, the address/chain is unusable, or every
 * read failed — callers fall back to the demo plane.
 */
export async function liveTokenBalances(chain: ChainId, address: string): Promise<LiveTokenPosition[] | null> {
  if (!liveEnabled()) return null;
  const normalized = address.toLowerCase();
  if (!isEvmAddress(normalized)) return null;
  const tokens = chainTokens(chain);
  if (tokens.length === 0) return null;

  const key = `${chain}:${normalized}`;
  const cached = positionsCache.get(key);
  const now = Date.now();
  if (cached && now - cached.at < POSITIONS_TTL) return cached.positions;

  const reads = await Promise.all(
    tokens.map(async (token) => {
      try {
        // balanceOf(holder): the queried subject is the argument, the
        // token contract arrives in `to`.
        const data = BALANCE_OF + padTopic(normalized).slice(2);
        const raw = await rpcCall<string>(chain, "eth_call", [{ to: token.address, data }, "latest"]);
        return { token, rawBalance: hexToBigInt(raw) };
      } catch {
        return { token, rawBalance: null };
      }
    }),
  );

  const meta = await Promise.all(reads.map((r) => tokenMeta(chain, r.token.address, r.token)));

  const positions: LiveTokenPosition[] = [];
  let okReads = 0;
  reads.forEach((r, i) => {
    if (r.rawBalance === null) return;
    okReads++;
    if (r.rawBalance === 0n) return;
    const decimals = meta[i].decimals;
    if (decimals === null) return;
    const divisor = 10n ** BigInt(decimals);
    positions.push({
      chain,
      token: r.token.address.toLowerCase(),
      symbol: meta[i].symbol ?? toChecksumAddress(r.token.address).slice(0, 10) + "…",
      name: r.token.name ?? null,
      decimals,
      amountRaw: r.rawBalance.toString(),
      amount: Number(r.rawBalance / divisor) + Number(r.rawBalance % divisor) / Number(divisor),
    });
  });

  const result: LiveTokenPosition[] | null = okReads > 0 ? positions.sort((a, b) => b.amount - a.amount).slice(0, 12) : null;
  if (positionsCache.size > 500) positionsCache.clear();
  positionsCache.set(key, { at: now, positions: result });
  return result;
}

export async function liveTokenBalancesForChains(chains: ChainId[], address: string, max = 3): Promise<(LiveTokenPosition[] | null)[]> {
  return Promise.all(chains.slice(0, max).map((c) => liveTokenBalances(c, address)));
}

interface RawLog {
  address?: string;
  topics?: string[];
  data?: string;
  blockNumber?: string;
  transactionHash?: string;
  logIndex?: string;
}

/** Upper clamp for the operator-tunable getLogs lookback (≈16h mainnet by default). */
export const SCAN_BLOCKS_CAP = 50_000;
const DEFAULT_SCAN_BLOCKS = 5_000;

/**
 * Operator-tunable getLogs lookback in blocks (ATOMIC_TRANSFER_BLOCKS,
 * clamped 64–SCAN_BLOCKS_CAP) — coverage is operator choice, not a
 * hardcode. Read per scan so tests and reloads pick the value up.
 */
export function scanWindowBlocks(): number {
  const raw = process.env.ATOMIC_TRANSFER_BLOCKS;
  if (raw === undefined || raw.trim() === "") return DEFAULT_SCAN_BLOCKS;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n)) return DEFAULT_SCAN_BLOCKS;
  return Math.min(SCAN_BLOCKS_CAP, Math.max(64, n));
}

/**
 * Public RPCs cap getLogs ranges very differently (some free tiers
 * accept ≤10 blocks), so the scan shrinks its window until the chain
 * accepts it — an empty result is still a success.
 */
function scanWindows(): number[] {
  const base = scanWindowBlocks();
  return [base, 1024, 256, 64]
    .filter((w, i, arr) => w <= base && arr.indexOf(w) === i)
    .sort((a, b) => b - a);
}
const MAX_LOGS_PER_SCAN = 40;
const MAX_TRANSFERS = 15;
/** Strategy 2 caps the per-token scan at this many pinned tokens per chain. */
const PINNED_SCAN_TOKENS = 8;

const blockTsCache = new Map<string, number>();

async function blockTimestamp(chain: ChainId, blockHex: string): Promise<number | null> {
  const cached = blockTsCache.get(blockHex);
  if (cached !== undefined) return cached;
  try {
    const block = await rpcCall<{ timestamp?: string }>(chain, "eth_getBlockByNumber", [blockHex, false], { timeoutMs: 6_000 });
    if (!block?.timestamp) return null;
    const ts = Number(hexToBigInt(block.timestamp)) * 1_000;
    if (blockTsCache.size > 500) blockTsCache.clear();
    blockTsCache.set(blockHex, ts);
    return ts;
  } catch {
    return null;
  }
}

/**
 * Recent ERC-20 transfers touching `address` on one chain, newest first.
 * Returns [] when the window holds no transfers, null when the scan is
 * impossible (live off, getLogs unsupported/rejected). Cached for 60s —
 * a scan costs several RPC round-trips.
 */
const TRANSFERS_TTL = 60_000;
const transfersCache = new Map<string, { at: number; transfers: LiveTransfer[] | null }>();

export async function liveTransfers(chain: ChainId, address: string): Promise<LiveTransfer[] | null> {
  if (!liveEnabled()) return null;
  const normalized = address.toLowerCase();
  if (!isEvmAddress(normalized)) return null;
  const padded = padTopic(normalized);

  const cacheKey = `${chain}:${normalized}`;
  const cached = transfersCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.at < TRANSFERS_TTL) return cached.transfers;

  const result = await scanTransfers(chain, normalized, padded);
  if (transfersCache.size > 300) transfersCache.clear();
  transfersCache.set(cacheKey, { at: now, transfers: result });
  return result;
}

async function scanTransfers(chain: ChainId, normalized: string, padded: string): Promise<LiveTransfer[] | null> {
  let latestHex: string;
  try {
    latestHex = await rpcCall<string>(chain, "eth_blockNumber", [], { timeoutMs: 6_000 });
  } catch {
    return null;
  }
  const latest = Number(hexToBigInt(latestHex));
  if (!Number.isFinite(latest) || latest < 1) return null;
  const toBlock = "0x" + latest.toString(16);

  const scan = (filter: Record<string, unknown>, window: number): Promise<RawLog[] | null> => {
    const fromBlock = "0x" + Math.max(1, latest - window + 1).toString(16);
    return rpcCall<RawLog[]>(chain, "eth_getLogs", [{ fromBlock, toBlock, ...filter }], { retries: 0, timeoutMs: 12_000 }).catch(() => null);
  };

  // Strategy 1: two topics-only scans per window (subject as sender via
  // topic1, as recipient via topic2). Shrinks the window while the RPC
  // rejects large ranges.
  let rows: { log: RawLog; direction: "in" | "out" }[] | null = null;
  const mergeScans = (results: (RawLog[] | null)[]): { log: RawLog; direction: "in" | "out" }[] => {
    const merged = new Map<string, { log: RawLog; direction: "in" | "out" }>();
    for (const [scanIdx, logs] of results.entries()) {
      if (!Array.isArray(logs)) continue;
      const direction: "in" | "out" = scanIdx % 2 === 0 ? "out" : "in";
      // Logs come back oldest-first; keep the newest slice of large sets.
      for (const log of logs.slice(-MAX_LOGS_PER_SCAN)) {
        if (!log?.topics || log.topics.length < 3 || !log.transactionHash || log.data === undefined) continue;
        const id = `${String(log.transactionHash).toLowerCase()}:${log.logIndex ?? "0"}`;
        // When a transfer appears in both scans (self-transfer), keep "out".
        const existing = merged.get(id);
        if (!existing || (existing.direction === "in" && direction === "out")) merged.set(id, { log, direction });
      }
    }
    return [...merged.values()];
  };

  for (const window of scanWindows()) {
    const results = await Promise.all([
      scan({ topics: [TRANSFER_TOPIC, [padded]] }, window),
      scan({ topics: [TRANSFER_TOPIC, null, [padded]] }, window),
    ]);
    if (results[0] !== null || results[1] !== null) {
      rows = mergeScans(results);
      break;
    }
  }

  // Strategy 2: some public RPCs (e.g. publicnode) only serve getLogs
  // with an explicit token `address` in the filter. Re-scan per pinned
  // token — coverage is then the configured token list, which the UI
  // presents as such.
  if (rows === null) {
    const pinned = chainTokens(chain).slice(0, PINNED_SCAN_TOKENS);
    if (pinned.length === 0) return null;
    for (const window of scanWindows()) {
      const results = await Promise.all(
        pinned.flatMap((t) => [
          scan({ address: t.address, topics: [TRANSFER_TOPIC, [padded]] }, window),
          scan({ address: t.address, topics: [TRANSFER_TOPIC, null, [padded]] }, window),
        ]),
      );
      if (results.some((r) => r !== null)) {
        rows = mergeScans(results);
        break;
      }
    }
  }
  if (rows === null) return null;

  const tokens = chainTokens(chain);
  const tokenBase = new Map(tokens.map((t) => [t.address.toLowerCase(), t]));

  if (rows.length === 0) return [];

  const blockHexes = [...new Set(rows.map((r) => r.log.blockNumber).filter((b): b is string => typeof b === "string"))].slice(0, 6);
  const tsList = await Promise.all(blockHexes.map((b) => blockTimestamp(chain, b)));
  const tsByBlock = new Map<string, string | null>(
    blockHexes.map((b, i) => [b, tsList[i] !== null ? new Date(tsList[i]!).toISOString() : null]),
  );

  const transfers: LiveTransfer[] = [];
  for (const { log, direction } of rows) {
    const token = typeof log.address === "string" && isEvmAddress(log.address) ? log.address.toLowerCase() : null;
    if (!token) continue;
    if (!log.topics || log.topics.length < 3) continue;
    const from = topicToAddress(log.topics[1]);
    const to = topicToAddress(log.topics[2]);
    if (!from || !to) continue;
    // ERC-20 Transfer carries a uint256 amount in data; skip ERC-721-style
    // (empty) payloads and tolerate unpadded hex from lenient RPCs.
    const dataHex = typeof log.data === "string" ? log.data.slice(2) : "";
    if (!/^[0-9a-fA-F]*$/.test(dataHex) || dataHex.length === 0 || dataHex.length > 64) continue;
    let amountRaw: bigint;
    try {
      amountRaw = hexToBigInt("0x" + dataHex.padStart(64, "0"));
    } catch {
      continue;
    }
    const base = tokenBase.get(token) ?? { address: token };
    const meta = await tokenMeta(chain, token, base);
    const decimals = base.decimals ?? meta.decimals;
    if (decimals === null) continue; // cannot express a unit amount — leave the row out
    const blockNumber = typeof log.blockNumber === "string" ? Number(hexToBigInt(log.blockNumber)) : NaN;
    const divisor = 10n ** BigInt(decimals);
    transfers.push({
      hash: log.transactionHash!.toLowerCase(),
      chain,
      blockNumber,
      timestamp: tsByBlock.get(log.blockNumber ?? "") ?? null,
      token,
      symbol: base.symbol ?? meta.symbol,
      direction,
      counterparty: direction === "out" ? to : from,
      amountRaw: amountRaw.toString(),
      amount: Number(amountRaw / divisor) + Number(amountRaw % divisor) / Number(divisor),
    });
  }

  // rows is bounded (≤ scans × MAX_LOGS_PER_SCAN), so sorting all of it
  // and slicing keeps the genuinely newest transfers.
  return transfers.sort((a, b) => b.blockNumber - a.blockNumber || b.hash.localeCompare(a.hash)).slice(0, MAX_TRANSFERS);
}

export async function liveTransfersForChains(chains: ChainId[], address: string, max = 3): Promise<(LiveTransfer[] | null)[]> {
  return Promise.all(chains.slice(0, max).map((c) => liveTransfers(c, address)));
}

/** Drop cached positions/token metadata/block timestamps — used by tests and registry reloads. */
export function resetErc20Caches(): void {
  positionsCache.clear();
  metaCache.clear();
  blockTsCache.clear();
  transfersCache.clear();
}
