import type { ChainId } from "../types";
import { chainOrNull } from "../chains";

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

interface HealthEntry {
  checkedAt: number;
  blockNumber: number | null;
  ok: boolean;
}

const HEALTH_TTL = 30_000;
const healthCache = new Map<ChainId, HealthEntry>();

export interface ChainHealth {
  chain: ChainId;
  reachable: boolean;
  blockNumber: number | null;
  checkedAt: string;
}

/** Cached probe — safe to call per-request. */
export async function chainHealth(chainId: ChainId): Promise<ChainHealth> {
  const cached = healthCache.get(chainId);
  const now = Date.now();
  if (cached && now - cached.checkedAt < HEALTH_TTL) {
    return {
      chain: chainId,
      reachable: cached.ok,
      blockNumber: cached.blockNumber,
      checkedAt: new Date(cached.checkedAt).toISOString(),
    };
  }
  let blockNumber: number | null = null;
  let ok = false;
  try {
    const hex = await rpcCall<string>(chainId, "eth_blockNumber", [], { timeoutMs: 5_000, retries: 0 });
    blockNumber = Number(BigInt(hex));
    ok = Number.isFinite(blockNumber);
  } catch {
    ok = false;
  }
  healthCache.set(chainId, { checkedAt: now, blockNumber, ok });
  return { chain: chainId, reachable: ok, blockNumber, checkedAt: new Date(now).toISOString() };
}
