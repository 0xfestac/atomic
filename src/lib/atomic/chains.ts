import type { Chain, ChainId } from "./types";

/**
 * Chain registry. Networks are configuration, not code: the built-in
 * list below ships with the platform, and operators add, patch, or
 * disable chains at startup via environment variables — no redeploy of
 * code required:
 *
 *   ATOMIC_CHAINS           JSON array of chain defs (add or patch by id)
 *   ATOMIC_CHAINS_DISABLED  comma-separated ids to remove
 *   ATOMIC_RPC_<ID>         comma-separated endpoints replacing defaults
 *                           (dashes in ids map to underscores: chain
 *                           "zksync-era" → ATOMIC_RPC_ZKSYNC_ERA)
 *   ATOMIC_DISABLE_LIVE     1 → never dial any chain (demo plane only)
 *
 * The registry is resolved at module load and can be re-applied at
 * runtime via reconfigureChains() — the exported CHAIN_LIST / CHAINS /
 * CHAIN_WARNINGS references are updated in place, so every consumer sees
 * a reload without remounting. The server sees the fully configured
 * list; client bundles only see the built-ins (env is server-side), so
 * server pages pass the configured list down to client components as
 * props. ATOMIC_CHAINS_FILE (see lib/atomic/chains-config.ts) applies a
 * JSON config file on top of the env and re-applies it automatically
 * when the file changes on disk — no restart required.
 */

export const BUILTIN_CHAINS: Chain[] = [
  {
    id: "ethereum",
    name: "Ethereum",
    short: "ETH",
    color: "#8b9cf6",
    evmChainId: 1,
    explorer: "https://etherscan.io",
    nativeSymbol: "ETH",
    rpc: ["https://ethereum-rpc.publicnode.com", "https://eth.drpc.org", "https://cloudflare-eth.com"],
    live: true,
    avgGasGwei: 12.4,
    finalitySec: 780,
    source: "builtin",
    rpcOverridden: false,
  },
  {
    id: "base",
    name: "Base",
    short: "BASE",
    color: "#3b82f6",
    evmChainId: 8453,
    explorer: "https://basescan.org",
    nativeSymbol: "ETH",
    rpc: ["https://base-rpc.publicnode.com", "https://mainnet.base.org"],
    live: true,
    avgGasGwei: 0.02,
    finalitySec: 132,
    source: "builtin",
    rpcOverridden: false,
  },
  {
    id: "arbitrum",
    name: "Arbitrum One",
    short: "ARB",
    color: "#22d3ee",
    evmChainId: 42161,
    explorer: "https://arbiscan.io",
    nativeSymbol: "ETH",
    rpc: ["https://arbitrum-one-rpc.publicnode.com", "https://arb1.arbitrum.io/rpc"],
    live: true,
    avgGasGwei: 0.1,
    finalitySec: 84,
    source: "builtin",
    rpcOverridden: false,
  },
  {
    id: "optimism",
    name: "OP Mainnet",
    short: "OP",
    color: "#f87171",
    evmChainId: 10,
    explorer: "https://optimistic.etherscan.io",
    nativeSymbol: "ETH",
    rpc: ["https://optimism-rpc.publicnode.com", "https://mainnet.optimism.io"],
    live: true,
    avgGasGwei: 0.01,
    finalitySec: 84,
    source: "builtin",
    rpcOverridden: false,
  },
  {
    id: "polygon",
    name: "Polygon PoS",
    short: "POL",
    color: "#a78bfa",
    evmChainId: 137,
    explorer: "https://polygonscan.com",
    nativeSymbol: "POL",
    rpc: ["https://polygon-bor-rpc.publicnode.com", "https://polygon-rpc.com"],
    live: true,
    avgGasGwei: 34,
    finalitySec: 32,
    source: "builtin",
    rpcOverridden: false,
  },
  {
    id: "bnb",
    name: "BNB Chain",
    short: "BNB",
    color: "#fbbf24",
    evmChainId: 56,
    explorer: "https://bscscan.com",
    nativeSymbol: "BNB",
    rpc: ["https://bsc-rpc.publicnode.com", "https://bsc-dataseed.binance.org"],
    live: true,
    avgGasGwei: 3,
    finalitySec: 6,
    source: "builtin",
    rpcOverridden: false,
  },
  {
    id: "avalanche",
    name: "Avalanche C-Chain",
    short: "AVAX",
    color: "#e8734a",
    evmChainId: 43114,
    explorer: "https://snowtrace.io",
    nativeSymbol: "AVAX",
    rpc: ["https://avalanche-c-chain-rpc.publicnode.com", "https://api.avax.network/ext/bc/C/rpc"],
    live: true,
    avgGasGwei: 28,
    finalitySec: 2,
    source: "builtin",
    rpcOverridden: false,
  },
];

/** Demo-plane fallback chain set — fixed built-ins, identical on server and client. */
export const DEMO_CHAIN_LIST: Chain[] = BUILTIN_CHAINS;

/** Ids of the demo-plane fallback pool (the built-ins). */
export const DEMO_CHAIN_IDS: ChainId[] = DEMO_CHAIN_LIST.map((c) => c.id);

const ID_RE = /^[a-z0-9][a-z0-9-]{1,31}$/;
const MAX_EVM_CHAIN_ID = 2 ** 53;
const MAX_ENDPOINTS = 10;

const PALETTE = ["#22d3ee", "#a78bfa", "#fbbf24", "#34d399", "#f87171", "#60a5fa", "#f472b6", "#4ade80"];

function defaultColor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** Env var that overrides a chain's endpoint list: "zksync-era" → ATOMIC_RPC_ZKSYNC_ERA */
export function rpcEnvVar(id: string): string {
  return `ATOMIC_RPC_${id.toUpperCase().replace(/-/g, "_")}`;
}

export interface ResolveChainsOptions {
  /** starting registry (defaults to the built-ins); never mutated */
  builtins?: Chain[];
  /** operator config: array of full defs (new chains) or partial patches (existing ids) */
  custom?: unknown;
  /** raw JSON string variant of `custom` (ATOMIC_CHAINS); parse errors become warnings */
  customJson?: string;
  /** ids to remove after patching */
  disabled?: string[];
  /** endpoint lists keyed by chain id, replacing each chain's defaults */
  rpcOverrides?: Record<string, string[]>;
}

export interface ChainRegistry {
  chains: Chain[];
  warnings: string[];
}

interface RawChainDef {
  id?: unknown;
  name?: unknown;
  short?: unknown;
  color?: unknown;
  evmChainId?: unknown;
  explorer?: unknown;
  nativeSymbol?: unknown;
  rpc?: unknown;
  live?: unknown;
  avgGasGwei?: unknown;
  finalitySec?: unknown;
}

function asText(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length > 0 && t.length <= max ? t : undefined;
}

function asHttpsUrl(v: unknown): string | undefined {
  const t = asText(v, 300);
  if (!t) return undefined;
  try {
    const u = new URL(t);
    return u.protocol === "https:" ? t.replace(/\/+$/, "") : undefined;
  } catch {
    return undefined;
  }
}

function asEndpointList(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const list: string[] = [];
  for (const e of v) {
    const t = asText(e, 300);
    if (!t) continue;
    try {
      const u = new URL(t);
      // http is allowed deliberately: operators may wire local devnets.
      if (u.protocol !== "https:" && u.protocol !== "http:") continue;
    } catch {
      continue;
    }
    if (!list.includes(t)) list.push(t);
    if (list.length >= MAX_ENDPOINTS) break;
  }
  return list.length > 0 ? list : undefined;
}

function asPositiveNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined;
}

function asPositiveInt(v: unknown): number | undefined {
  const n = asPositiveNumber(v);
  return n !== undefined && Number.isInteger(n) ? n : undefined;
}

/**
 * Pure registry resolution: start from the built-ins, apply operator
 * patches/additions, drop disabled ids, apply endpoint overrides, and
 * enforce EIP-155 uniqueness. Invalid entries never abort startup —
 * they are skipped with a warning so a config typo cannot take the
 * whole platform down.
 */
export function resolveChains(options: ResolveChainsOptions = {}): ChainRegistry {
  const warnings: string[] = [];
  const byId = new Map<string, Chain>(
    (options.builtins ?? BUILTIN_CHAINS).map((c) => [c.id, { ...c, rpc: [...c.rpc] }]),
  );

  const inputs: { label: string; defs: unknown }[] = [];
  if (options.customJson !== undefined) {
    try {
      inputs.push({ label: "ATOMIC_CHAINS", defs: JSON.parse(options.customJson) });
    } catch {
      warnings.push("ATOMIC_CHAINS: not valid JSON — ignored");
    }
  }
  if (options.custom !== undefined) inputs.push({ label: "chains", defs: options.custom });

  for (const { label, defs } of inputs) {
    if (!Array.isArray(defs)) {
      warnings.push(`${label}: expected a JSON array of chain objects — ignored`);
      continue;
    }
    for (let i = 0; i < defs.length; i++) {
      const raw = defs[i] as RawChainDef;
      if (typeof raw !== "object" || raw === null) {
        warnings.push(`${label}[${i}]: not an object — skipped`);
        continue;
      }
      const id = asText(raw.id, 32)?.toLowerCase();
      if (!id || !ID_RE.test(id)) {
        warnings.push(`${label}[${i}]: invalid or missing id — skipped`);
        continue;
      }
      const existing = byId.get(id);
      const merged: Chain = existing
        ? { ...existing, rpc: [...existing.rpc] }
        : {
            id,
            name: "",
            short: id.toUpperCase().slice(0, 6),
            color: defaultColor(id),
            evmChainId: 0,
            explorer: null,
            nativeSymbol: "",
            rpc: [],
            live: true,
            avgGasGwei: 1,
            finalitySec: 60,
            source: "config",
            rpcOverridden: false,
          };

      const missing: string[] = [];
      const name = asText(raw.name, 48);
      if (name !== undefined) merged.name = name;
      else if (!existing) missing.push("name");

      const evm = asPositiveInt(raw.evmChainId);
      if (evm !== undefined && evm <= MAX_EVM_CHAIN_ID) merged.evmChainId = evm;
      else if (!existing) missing.push("evmChainId");
      else if (raw.evmChainId !== undefined && evm === undefined) {
        warnings.push(`${label}[${i}] (${id}): invalid evmChainId — kept ${merged.evmChainId}`);
      }

      const sym = asText(raw.nativeSymbol, 12);
      if (sym !== undefined) merged.nativeSymbol = sym;
      else if (!existing) missing.push("nativeSymbol");

      const rpc = asEndpointList(raw.rpc);
      if (rpc !== undefined) merged.rpc = rpc;
      else if (!existing) missing.push("rpc");

      if (missing.length > 0) {
        warnings.push(`${label}[${i}] (${id}): missing ${missing.join(", ")} — skipped`);
        continue;
      }

      const short = asText(raw.short, 6);
      if (short !== undefined) merged.short = short;
      const color = asText(raw.color, 7);
      if (color !== undefined && /^#[0-9a-fA-F]{6}$/.test(color)) merged.color = color.toLowerCase();
      if (raw.explorer === null) merged.explorer = null;
      else {
        const explorer = asHttpsUrl(raw.explorer);
        if (explorer !== undefined) merged.explorer = explorer;
        else if (raw.explorer !== undefined) {
          warnings.push(`${label}[${i}] (${id}): explorer must be an https URL — kept ${merged.explorer ?? "none"}`);
        }
      }
      if (typeof raw.live === "boolean") merged.live = raw.live;
      const gas = asPositiveNumber(raw.avgGasGwei);
      if (gas !== undefined) merged.avgGasGwei = gas;
      const finality = asPositiveInt(raw.finalitySec);
      if (finality !== undefined) merged.finalitySec = finality;

      byId.set(id, merged);
    }
  }

  for (const rawId of options.disabled ?? []) {
    const id = rawId.trim().toLowerCase();
    if (!id) continue;
    if (!byId.delete(id)) warnings.push(`ATOMIC_CHAINS_DISABLED: "${id}" is not a configured chain`);
  }

  for (const [id, endpoints] of Object.entries(options.rpcOverrides ?? {})) {
    const c = byId.get(id);
    if (!c) {
      warnings.push(`rpc override for unknown chain "${id}" — ignored`);
      continue;
    }
    const rpc = asEndpointList(endpoints);
    if (!rpc) {
      warnings.push(`rpc override for "${id}" contained no usable endpoints — kept defaults`);
      continue;
    }
    c.rpc = rpc;
    c.rpcOverridden = true;
  }

  // EIP-155 ids must be unique across the registry: a collision could
  // bind signatures to the wrong network.
  const evmOwner = new Map<number, string>();
  const chains: Chain[] = [];
  for (const c of byId.values()) {
    if (!c.name || !c.nativeSymbol || !c.rpc.length || !Number.isInteger(c.evmChainId) || c.evmChainId < 1) {
      warnings.push(`chain "${c.id}": incomplete configuration — dropped`);
      continue;
    }
    const owner = evmOwner.get(c.evmChainId);
    if (owner !== undefined && owner !== c.id) {
      warnings.push(`chain "${c.id}": evmChainId ${c.evmChainId} already used by "${owner}" — dropped`);
      continue;
    }
    evmOwner.set(c.evmChainId, c.id);
    chains.push(c);
  }

  return { chains, warnings };
}

function envValue(name: string): string | undefined {
  try {
    return process.env[name];
  } catch {
    return undefined;
  }
}

function envRpcOverrides(): Record<string, string[]> {
  const overrides: Record<string, string[]> = {};
  let keys: string[] = [];
  try {
    keys = Object.keys(process.env);
  } catch {
    return overrides;
  }
  for (const key of keys) {
    const m = /^ATOMIC_RPC_(.+)$/.exec(key);
    const value = envValue(key)?.trim();
    if (!m || !value) continue;
    const id = m[1].toLowerCase().replace(/_/g, "-");
    overrides[id] = value.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return overrides;
}

/** Registry options derived from the current environment (ATOMIC_CHAINS, ATOMIC_CHAINS_DISABLED, ATOMIC_RPC_*). */
export function registryOptionsFromEnv(): ResolveChainsOptions {
  return {
    customJson: envValue("ATOMIC_CHAINS"),
    disabled: (envValue("ATOMIC_CHAINS_DISABLED") ?? "").split(","),
    rpcOverrides: envRpcOverrides(),
  };
}

function logWarnings(warnings: string[]): void {
  if (warnings.length === 0 || typeof window !== "undefined") return;
  for (const w of warnings) console.warn(`[atomic] chain registry: ${w}`);
}

// Live registry state. The exported references stay stable; reloads swap
// their contents in place so every holder of the reference sees the
// update (client bundles only ever install the built-ins).
export const CHAIN_LIST: Chain[] = [];
const CHAINS_BY_ID: Record<ChainId, Chain> = {};
export const CHAINS: Record<ChainId, Chain> = CHAINS_BY_ID;
export const CHAIN_WARNINGS: string[] = [];

function installRegistry(registry: ChainRegistry): void {
  CHAIN_LIST.length = 0;
  CHAIN_LIST.push(...registry.chains);
  for (const key of Object.keys(CHAINS_BY_ID)) delete CHAINS_BY_ID[key];
  for (const c of registry.chains) CHAINS_BY_ID[c.id] = c;
  CHAIN_WARNINGS.length = 0;
  CHAIN_WARNINGS.push(...registry.warnings);
}

/**
 * Re-resolve and install the registry in place — the running deployment
 * picks up new/patched/disabled chains on the next request without a
 * restart. Used at module init and by the ATOMIC_CHAINS_FILE hot reload
 * (lib/atomic/chains-config.ts).
 */
export function reconfigureChains(options: ResolveChainsOptions = {}): ChainRegistry {
  const registry = resolveChains(options);
  installRegistry(registry);
  logWarnings(registry.warnings);
  return registry;
}

reconfigureChains(registryOptionsFromEnv());

export function chainOrNull(id: string): Chain | undefined {
  return CHAINS[id];
}

/** Display name that degrades to the raw id instead of crashing on unknown ids. */
export function chainName(id: string): string {
  return CHAINS[id]?.name ?? id;
}

export function isChainId(value: string): value is ChainId {
  return Object.prototype.hasOwnProperty.call(CHAINS, value);
}

export function chainByEvmId(evmChainId: number): Chain | undefined {
  return CHAIN_LIST.find((c) => c.evmChainId === evmChainId);
}

export function explorerAddress(id: string, address: string): string | null {
  const base = CHAINS[id]?.explorer;
  return base ? `${base}/address/${address}` : null;
}

export function explorerTx(id: string, hash: string): string | null {
  const base = CHAINS[id]?.explorer;
  return base ? `${base}/tx/${hash}` : null;
}
