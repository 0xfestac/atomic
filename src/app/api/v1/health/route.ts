import { NextResponse } from "next/server";
import { CHAIN_LIST } from "@/lib/atomic/chains";
import { liveEnabled, chainHealth } from "@/lib/atomic/onchain/rpc";
import { NO_STORE, guardRequest } from "@/lib/atomic/api/guard";

export const dynamic = "force-dynamic";

const VERSION = "1.0.0";

export async function GET(req: Request) {
  const limited = guardRequest(req, 300);
  if (limited) return limited;

  const primary = CHAIN_LIST[0];
  const health = liveEnabled() ? await chainHealth(primary.id) : null;

  return NextResponse.json(
    {
      status: "ok",
      service: "ATOMIC",
      version: VERSION,
      chains: CHAIN_LIST.map((c) => c.id),
      dataPlane: liveEnabled() ? "live-onchain+demo-enrichment" : "deterministic-demo",
      liveRpc: {
        enabled: liveEnabled(),
        ethereum: health
          ? { reachable: health.reachable, blockNumber: health.blockNumber, checkedAt: health.checkedAt }
          : { enabled: false },
      },
      time: new Date().toISOString(),
    },
    { headers: NO_STORE },
  );
}
