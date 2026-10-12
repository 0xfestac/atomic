import type { ChainId } from "../types";
import { chainOrNull } from "../chains";
import { SwrCache } from "./swr";
import { afterResponse } from "./background";

/**
 * Keyless JSON-RPC transport. Endpoint lists live in the chain registry
 * (lib/atomic/chains.ts): calls fail over to the next endpoint on
 * network or JSON-RPC errors and remember the last working endpoint
 * (sticky). Operators pin dedicated endpoints via ATOMIC_RPC_<CHAIN>
 * env vars — recommended for production traffic — or set
 * ATOMIC_DISABLE_LIVE=1 to run purely on the deterministic demo plane.
 */

export class RpcError extends Error {
  constructor(
    message: string,
    readonly chain: ChainId,
    readonly method: string,
  ) {
    super(message);
    this.name = "RpcError";
  }
}

const sticky = new Map<ChainId, string>();

function endpointsFor(id: ChainId): string[] {
  const meta = chainOrNull(id);
  if (!meta || !meta.live) return [];
  const preferred = sticky.get(id);
  return preferred && meta.rpc.includes(preferred)
    ? [preferred, ...meta.rpc.filter((e) => e !== preferred)]
    : meta.rpc;
}

export function liveEnabled(): boolean {
  return process.env.ATOMIC_DISABLE_LIVE !== "1";
}

export interface RpcOptions {
  timeoutMs?: number;
  retries?: number;
}

let seq = 0;

async function attempt<T>(
  endpoint: string,
  chain: ChainId,
  method: string,
  params: unknown[],
  timeoutMs: number,
  retries: number,
): Promise<T> {
  let lastError: unknown;
  for (let tries = 0; tries <= retries; tries++) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: ++seq, method, params }),
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`http ${res.status}`);
      const body = (await res.json()) as { result?: T; error?: { code: number; message: string } };
      if (body.error) throw new Error(`rpc ${body.error.code}: ${body.error.message}`);
      if (body.result === undefined) throw new Error("empty result");
      return body.result;
    } catch (err) {
      lastError = err;
      if (tries < retries) await new Promise((r) => setTimeout(r, 120 * (tries + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** Single JSON-RPC call with endpoint failover. Throws RpcError when all endpoints fail. */
export async function rpcCall<T>(
  chain: ChainId,
  method: string,
  params: unknown[] = [],
  opts: RpcOptions = {},
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 8_000;
  const retries = opts.retries ?? 1;
  const meta = chainOrNull(chain);
  if (!meta) throw new RpcError(`unknown chain "${chain}"`, chain, method);
  if (!meta.live) throw new RpcError(`live reads are disabled for chain "${chain}"`, chain, method);
  const endpoints = endpointsFor(chain);
  if (endpoints.length === 0) {
    throw new RpcError(`no rpc endpoint configured for chain "${chain}"`, chain, method);
  }
  let lastError: unknown;
  for (const endpoint of endpoints) {
    try {
      const result = await attempt<T>(endpoint, chain, method, params, timeoutMs, retries);
      sticky.set(chain, endpoint);
      return result;
    } catch (err) {
      lastError = err;
    }
  }
  throw new RpcError(
    lastError instanceof Error ? lastError.message : "all endpoints failed",
    chain,
    method,
  );
}

const HEALTH_TTL_MS = 30_000;

/**
 * Health probes are stale-while-revalidate: fresh entries return
 * synchronously, and an expired entry is served immediately while a
 * background refresh repopulates the cache — a badge or API read never
 * blocks on a probe round-trip once the chain has been probed before
 * (probes are also warmed at boot via src/instrumentation.ts). The cache
 * is reset on chain-registry reloads so stale-endpoint entries never
 * survive a reconfiguration.
 */
const healthCache = new SwrCache<ChainHealth>(HEALTH_TTL_MS, 64, afterResponse);

/** Drop sticky endpoints and cached health probes — used on chain-registry reloads. */
export function resetRpcCaches(): void {
  sticky.clear();
  healthCache.clear();
}

export interface ChainHealth {
  chain: ChainId;
  reachable: boolean;
  blockNumber: number | null;
  checkedAt: string;
}

/**
 * Probe one chain (single eth_blockNumber with a short timeout). Never
 * throws — an unreachable chain is a valid, cacheable result.
 */
async function probeHealth(chainId: ChainId): Promise<ChainHealth> {
  try {
    const hex = await rpcCall<string>(chainId, "eth_blockNumber", [], { timeoutMs: 5_000, retries: 0 });
    const blockNumber = Number(BigInt(hex));
    return { chain: chainId, reachable: Number.isFinite(blockNumber), blockNumber, checkedAt: new Date().toISOString() };
  } catch {
    return { chain: chainId, reachable: false, blockNumber: null, checkedAt: new Date().toISOString() };
  }
}

/** Cached probe — safe to call per-request; expired entries serve instantly. */
export async function chainHealth(chainId: ChainId): Promise<ChainHealth> {
  return healthCache.get(chainId, () => probeHealth(chainId));
}
