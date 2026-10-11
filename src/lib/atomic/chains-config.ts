import type { Stats } from "node:fs";
import fsp from "node:fs/promises";
import { reconfigureChains, registryOptionsFromEnv } from "./chains";
import { resetRpcCaches } from "./onchain/rpc";
import { resetOnchainCaches } from "./onchain/adapter";

/**
 * Runtime chain-config reloading (server only).
 *
 * Env vars are frozen once a process starts, so operators who want to
 * change the registry without a restart point ATOMIC_CHAINS_FILE at a
 * JSON file with the same schema as ATOMIC_CHAINS. ensureChains() is
 * called at the top of every registry-consuming page and API route; it
 * stats the file (throttled), and when the content changed re-applies
 * the registry — env layers first, file entries last (the file wins) —
 * and resets the RPC/health/fact caches so stale endpoints are never
 * reused. Removing the file reverts to env-only configuration. A broken
 * file is skipped with a warning; a config mistake can never take the
 * platform down.
 */

const CHECK_INTERVAL_MS = 1_000;

let lastKey = "";
let lastAppliedRaw: string | null = null;
let lastCheckAt = 0;
let warnedMissing = false;

function applyFileConfig(raw: string | undefined): void {
  let parsed: unknown;
  if (raw !== undefined) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn("[atomic] chain config: ATOMIC_CHAINS_FILE is not valid JSON — env configuration stays active");
      parsed = undefined;
    }
  }
  reconfigureChains({ ...registryOptionsFromEnv(), custom: parsed });
  resetRpcCaches();
  resetOnchainCaches();
}

export interface EnsureChainsOptions {
  /** bypass the stat throttle (used at first call and in tests) */
  force?: boolean;
}

/**
 * Apply ATOMIC_CHAINS_FILE when its content changed. Cheap enough to
 * call at the top of every request path; no-op when the env var is unset.
 */
export async function ensureChains(options: EnsureChainsOptions = {}): Promise<void> {
  const file = process.env.ATOMIC_CHAINS_FILE?.trim();
  if (!file) return;
  const now = Date.now();
  if (!options.force && now - lastCheckAt < CHECK_INTERVAL_MS) return;
  lastCheckAt = now;

  let stat: Stats;
  try {
    stat = await fsp.stat(file);
  } catch (err) {
    // A transient stat failure (permissions, EIO) keeps the current
    // registry; only a genuinely gone file reverts the configuration.
    if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") return;
    if (lastAppliedRaw !== null) {
      lastAppliedRaw = null;
      lastKey = "";
      applyFileConfig(undefined);
      console.warn(`[atomic] chain config: ${file} disappeared — reverted to env configuration`);
    } else if (!warnedMissing) {
      warnedMissing = true;
      console.warn(`[atomic] chain config: ATOMIC_CHAINS_FILE=${file} is not readable — running on env configuration`);
    }
    return;
  }
  warnedMissing = false;

  let raw: string;
  try {
    raw = await fsp.readFile(file, "utf8");
  } catch {
    return; // transient read failure — keep the current registry
  }
  const key = `${stat.mtimeMs}:${stat.size}`;
  if (!options.force && key === lastKey && raw === lastAppliedRaw) return;
  lastKey = key;
  lastAppliedRaw = raw;
  applyFileConfig(raw);
  console.warn(`[atomic] chain config: applied ${file} — chain registry reloaded without restart`);
}
