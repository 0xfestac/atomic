import { watch, type FSWatcher } from "node:fs";
import fsp from "node:fs/promises";
import { basename, dirname } from "node:path";
import { reconfigureChains, registryOptionsFromEnv } from "./chains";
import { resetRpcCaches } from "./onchain/rpc";
import { resetOnchainCaches } from "./onchain/adapter";
import { resetErc20Caches } from "./onchain/erc20";

/**
 * Runtime chain-config reloading (server only).
 *
 * Env vars are frozen once a process starts, so operators who want to
 * change the registry without a restart point ATOMIC_CHAINS_FILE at a
 * JSON file with the same schema as ATOMIC_CHAINS. ensureChains() is
 * called at the top of every registry-consuming page and API route. The
 * file is detected two ways, whichever lands first:
 *
 *   1. an fs.watch watcher on the file's directory (inotify) — the
 *      directory is watched rather than the inode so atomic
 *      write-temp-then-rename editor saves are caught too; events are
 *      debounced and trigger an immediate re-check;
 *   2. an mtime/size poll per request, throttled to 1s — the fallback
 *      for filesystems or sandboxes where watch is unavailable.
 *
 * When the content changed the registry is re-applied — env layers
 * first, file entries last (the file wins) — and the RPC/health/fact
 * caches are reset so stale endpoints are never reused. Removing the
 * file reverts to env-only configuration. A broken file is skipped with
 * a warning; a config mistake can never take the platform down.
 */

const CHECK_INTERVAL_MS = 1_000;
const WATCH_DEBOUNCE_MS = 80;

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
  resetErc20Caches();
}

export interface EnsureChainsOptions {
  /** bypass the stat throttle (used at first call and in tests) */
  force?: boolean;
}

// ── Directory watcher (inotify) ──────────────────────────────────────────

let dirWatcher: FSWatcher | null = null;
let watchedPath = "";
let reloadTimer: ReturnType<typeof setTimeout> | null = null;

function stopConfigWatcher(): void {
  if (reloadTimer) {
    clearTimeout(reloadTimer);
    reloadTimer = null;
  }
  dirWatcher?.close();
  dirWatcher = null;
  watchedPath = "";
}

function scheduleImmediateCheck(): void {
  if (reloadTimer) clearTimeout(reloadTimer);
  // Debounce: editors often fire several events per save.
  reloadTimer = setTimeout(() => {
    reloadTimer = null;
    ensureChains({ force: true }).catch(() => {});
  }, WATCH_DEBOUNCE_MS);
  reloadTimer.unref?.();
}

/** Watch the config file's directory so atomic saves and recreation are caught. */
function startConfigWatcher(file: string): void {
  if (dirWatcher && watchedPath === file) return;
  stopConfigWatcher();
  watchedPath = file;
  const dir = dirname(file);
  const base = basename(file);
  try {
    dirWatcher = watch(dir, (event, filename) => {
      if (filename && filename !== base) return;
      scheduleImmediateCheck();
    });
    dirWatcher.on("error", () => stopConfigWatcher());
    // Never hold the process open for the watcher (tests, one-shot scripts).
    dirWatcher.unref?.();
  } catch {
    dirWatcher = null; // watch unavailable — the per-request poll still applies
  }
}

/**
 * Apply ATOMIC_CHAINS_FILE when its content changed. Cheap enough to
 * call at the top of every request path; no-op when the env var is unset.
 */
export async function ensureChains(options: EnsureChainsOptions = {}): Promise<void> {
  const file = process.env.ATOMIC_CHAINS_FILE?.trim();
  if (!file) return;
  startConfigWatcher(file);
  const now = Date.now();
  if (!options.force && now - lastCheckAt < CHECK_INTERVAL_MS) return;
  lastCheckAt = now;

  try {
    await fsp.stat(file);
  } catch (err) {
    // A transient stat failure (permissions, EIO) keeps the current
    // registry; only a genuinely gone file reverts the configuration.
    if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") return;
    if (lastAppliedRaw !== null) {
      lastAppliedRaw = null;
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
  if (raw === lastAppliedRaw) return; // nothing changed — never re-apply, even when forced
  lastAppliedRaw = raw;
  applyFileConfig(raw);
  console.warn(`[atomic] chain config: applied ${file} — chain registry reloaded without restart`);
}

/** Tear down the file watcher — used by tests. */
export function stopChainsConfigWatcherForTests(): void {
  stopConfigWatcher();
}
