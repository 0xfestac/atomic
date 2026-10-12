import { CHAIN_LIST } from "./lib/atomic/chains";
import { chainHealth, liveEnabled } from "./lib/atomic/onchain/rpc";

/**
 * Runs once per server process at startup. Warms the chain-health cache
 * so /integrations badges and /api/v1/health never wait on a probe
 * round-trip: by the time the first request arrives the probes have
 * usually landed, and afterwards the stale-while-revalidate health cache
 * serves every read instantly. Probes are fire-and-forget and deduped —
 * a request landing mid-warm shares the in-flight probe.
 */
export function register(): void {
  if (!liveEnabled()) return;
  const live = CHAIN_LIST.filter((c) => c.live);
  for (const chain of live) void chainHealth(chain.id);
  console.log(`[atomic] warming chain health for ${live.length} live chain${live.length === 1 ? "" : "s"}`);
}
