import type { ChainId } from "../types";
import { toChecksumAddress, ensNamehash } from "./keccak";
import { isEnsName } from "./name";
import { liveEnabled, rpcCall } from "./rpc";
import { SwrCache } from "./swr";
import { afterResponse } from "./background";

/**
 * Read-only on-chain lookups over plain JSON-RPC. Every function returns
 * null/undefined on failure instead of throwing — callers degrade to the
 * deterministic demo plane and label data provenance honestly.
 */

export function hexToBigInt(hex: string): bigint {
  return BigInt(hex === "0x" ? "0x0" : hex);
}

export function decodeEvmString(data: string): string | null {
  const body = data.slice(2);
  if (body.length < 128) return null;
  const offset = Number(BigInt("0x" + body.slice(0, 64)));
  const length = Number(BigInt("0x" + body.slice(64, 128)));
  if (offset !== 0x20 || length < 0 || body.length < 128 + length * 2) return null;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) bytes[i] = Number.parseInt(body.slice(128 + i * 2, 130 + i * 2), 16);
  return new TextDecoder().decode(bytes).replace(/\0+$/, "");
}

const EIP1967_IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const EIP1967_ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/** Canonical 4-byte selectors probed for in deployed bytecode. */
export const BYTECODE_SELECTORS: { key: string; label: string; selector: string }[] = [
  { key: "mint", label: "mint", selector: "40c10f19" }, // mint(address,uint256)
  { key: "mintUint", label: "mint(uint256)", selector: "1249c58b" },
  { key: "blacklist", label: "blacklist", selector: "5c975abb" }, // blacklist(address)
  { key: "pause", label: "pause", selector: "8456cb59" },
  { key: "setOwner", label: "transferOwnership", selector: "f2fde38b" },
];

export interface AddressClass {
  chain: ChainId;
  address: string;
  isContract: boolean;
  codeSizeBytes: number;
  checksum: string;
  /** EIP-7702 delegation designator (0xef0100 + delegate) on an EOA */
  delegation: { delegate: string } | null;
}

const EIP7702_DELEGATION_PREFIX = "0xef0100";

export async function classifyAddress(chain: ChainId, address: string): Promise<AddressClass | null> {
  try {
    const code = await rpcCall<string>(chain, "eth_getCode", [address, "latest"]);
    const normalized = code && code !== "0x" ? code.toLowerCase() : "";
    // EIP-7702: an EOA can carry a 23-byte delegation designator instead of real code.
    if (normalized.startsWith(EIP7702_DELEGATION_PREFIX) && normalized.length === 48) {
      return {
        chain,
        address: address.toLowerCase(),
        isContract: false,
        codeSizeBytes: 0,
        checksum: toChecksumAddress(address),
        delegation: { delegate: "0x" + normalized.slice(8) },
      };
    }
    return {
      chain,
      address: address.toLowerCase(),
      isContract: normalized.length > 2,
      codeSizeBytes: Math.floor(Math.max(0, normalized.length - 2) / 2),
      checksum: toChecksumAddress(address),
      delegation: null,
    };
  } catch {
    return null;
  }
}

export async function nativeBalance(chain: ChainId, address: string): Promise<bigint | null> {
  try {
    return hexToBigInt(await rpcCall<string>(chain, "eth_getBalance", [address, "latest"]));
  } catch {
    return null;
  }
}

export async function transactionCount(chain: ChainId, address: string): Promise<number | null> {
  try {
    return Number(hexToBigInt(await rpcCall<string>(chain, "eth_getTransactionCount", [address, "latest"])));
  } catch {
    return null;
  }
}

const SEL = {
  owner: "0x8da5cb5b",
  resolver: "0x0178b8bf",
  addr: "0x3b3b57de",
} as const;

export interface ProxyInfo {
  implementation: string;
  admin: string | null;
}

/** EIP-1967 storage-slot read; null when the slots are unset (not a proxy). */
export async function proxyInfo(chain: ChainId, address: string): Promise<ProxyInfo | null> {
  try {
    const implRaw = await rpcCall<string>(chain, "eth_getStorageAt", [address, EIP1967_IMPL_SLOT, "latest"]);
    const implWord = "0x" + implRaw.slice(2).padStart(64, "0");
    const impl = "0x" + implWord.slice(26);
    if (impl === ZERO_ADDRESS) return null;
    let admin: string | null = null;
    try {
      const adminRaw = await rpcCall<string>(chain, "eth_getStorageAt", [address, EIP1967_ADMIN_SLOT, "latest"]);
      admin = "0x" + adminRaw.slice(26);
      if (admin === ZERO_ADDRESS) admin = null;
    } catch {
      // admin slot is optional
    }
    return { implementation: impl, admin };
  } catch {
    return null;
  }
}

export interface OwnerInfo {
  owner: string;
  renounced: boolean;
}

/** owner() result; null when the call reverts (no Ownable surface) or RPC fails. */
export async function ownerInfo(chain: ChainId, address: string): Promise<OwnerInfo | null> {
  try {
    const raw = await rpcCall<string>(chain, "eth_call", [{ to: address, data: SEL.owner }, "latest"], { retries: 0 });
    if (!raw || raw.length < 66) return null;
    const owner = "0x" + raw.slice(26).toLowerCase();
    return { owner, renounced: owner === ZERO_ADDRESS };
  } catch {
    return null;
  }
}

export interface BytecodeScan {
  codeSizeBytes: number;
  selectors: { label: string; selector: string }[];
}

/** Scan deployed bytecode for known privileged-surface selectors. */
export async function scanBytecode(chain: ChainId, address: string): Promise<BytecodeScan | null> {
  try {
    const code = (await rpcCall<string>(chain, "eth_getCode", [address, "latest"])).toLowerCase();
    if (!code || code === "0x") return null;
    const selectors = BYTECODE_SELECTORS.filter((s) => code.includes(s.selector)).map((s) => ({
      label: s.label,
      selector: s.selector,
    }));
    return { codeSizeBytes: Math.floor((code.length - 2) / 2), selectors };
  } catch {
    return null;
  }
}

// ENS registry on Ethereum mainnet — https://docs.ens.domains/deployments
const ENS_REGISTRY = "0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e";

/**
 * Forward ENS resolution (.eth names) via the canonical registry on
 * Ethereum mainnet. Returns the checksummed address or null.
 */
export async function resolveEns(name: string): Promise<string | null> {
  const normalized = name.trim().toLowerCase();
  if (!isEnsName(normalized) || !liveEnabled()) return null;
  try {
    const node = ensNamehash(normalized);
    const resolverRaw = await rpcCall<string>(
      "ethereum",
      "eth_call",
      [{ to: ENS_REGISTRY, data: SEL.resolver + node }, "latest"],
      { timeoutMs: 6_000 },
    );
    const resolver = "0x" + resolverRaw.slice(26);
    if (resolver === ZERO_ADDRESS) return null;
    const addrRaw = await rpcCall<string>(
      "ethereum",
      "eth_call",
      [{ to: resolver, data: SEL.addr + node }, "latest"],
      { timeoutMs: 6_000 },
    );
    const addr = "0x" + addrRaw.slice(26);
    return addr === ZERO_ADDRESS ? null : toChecksumAddress(addr);
  } catch {
    return null;
  }
}

export interface OnchainFacts {
  chain: ChainId;
  address: string;
  classification: AddressClass | null;
  nativeBalanceWei: bigint | null;
  txCount: number | null;
  proxy: ProxyInfo | null;
  owner: OwnerInfo | null;
  bytecode: BytecodeScan | null;
  /** true when at least one live read succeeded */
  ok: boolean;
}

const FACTS_TTL = 60_000;
const factsCache = new SwrCache<OnchainFacts | null>(FACTS_TTL, 500, afterResponse);

/** Drop cached live facts — used on chain-registry reloads. */
export function resetOnchainCaches(): void {
  factsCache.clear();
}

function factsKey(chain: ChainId, address: string): string {
  return `${chain}:${address.toLowerCase()}`;
}

/** One full live probe of an address on one chain. Never throws. */
async function loadOnchainFacts(chain: ChainId, address: string): Promise<OnchainFacts | null> {
  const cls = await classifyAddress(chain, address);
  if (!cls) return null;

  const [balance, txCount, proxy, owner, bytecode] = await Promise.all([
    nativeBalance(chain, address),
    transactionCount(chain, address),
    cls.isContract ? proxyInfo(chain, address) : Promise.resolve(null),
    cls.isContract ? ownerInfo(chain, address) : Promise.resolve(null),
    cls.isContract ? scanBytecode(chain, address) : Promise.resolve(null),
  ]);

  return {
    chain,
    address: address.toLowerCase(),
    classification: cls,
    nativeBalanceWei: balance,
    txCount,
    proxy,
    owner,
    bytecode,
    ok: true,
  };
}

/**
 * Aggregate live facts for an address on one chain. Never throws; served
 * stale-while-revalidate from a 60s cache; returns null when live mode is
 * disabled.
 */
export function onchainFacts(chain: ChainId, address: string): Promise<OnchainFacts | null> {
  if (!liveEnabled()) return Promise.resolve(null);
  return factsCache.get(factsKey(chain, address), () => loadOnchainFacts(chain, address));
}

/** Facts for the first `max` chains of an entity, in parallel. */
export async function onchainFactsForChains(
  chains: ChainId[],
  address: string,
  max = 3,
): Promise<(OnchainFacts | null)[]> {
  return Promise.all(chains.slice(0, max).map((c) => onchainFacts(c, address)));
}
