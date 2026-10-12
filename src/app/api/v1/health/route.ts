import { NextResponse } from "next/server";
import { CHAIN_LIST } from "@/lib/atomic/chains";
import { ensureChains } from "@/lib/atomic/chains-config";
import { liveEnabled, chainHealth } from "@/lib/atomic/onchain/rpc";
import { NO_STORE, guardRequest } from "@/lib/atomic/api/guard";

export const dynamic = "force-dynamic";

const VERSION = "1.0.0";

export async function GET(req: Request) {
  const limited = guardRequest(req, 300);
  if (limited) return limited;
  await ensureChains();

  const primary = CHAIN_LIST.find((c) => c.live);
  const health = liveEnabled() && primary ? await chainHealth(primary.id) : null;

  return NextResponse.json(
    {
      status: "ok",
      service: "ATOMIC",
      version: VERSION,
      chainCount: CHAIN_LIST.length,
      chains: CHAIN_LIST.map((c) => ({ id: c.id, name: c.name, evmChainId: c.evmChainId, live: c.live })),
      dataPlane: liveEnabled() ? "live-onchain+demo-enrichment" : "deterministic-demo",
      liveRpc: {
        enabled: liveEnabled(),
        primary: primary && health
          ? { chain: primary.id, reachable: health.reachable, blockNumber: health.blockNumber, checkedAt: health.checkedAt }
          : { chain: primary?.id ?? null, reachable: false, blockNumber: null, checkedAt: null },
      },
      time: new Date().toISOString(),
    },
    { headers: NO_STORE },
  );
}
