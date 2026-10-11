import { NextResponse } from "next/server";
import { CHAIN_LIST, CHAIN_WARNINGS } from "@/lib/atomic/chains";
import { NO_STORE, guardRequest } from "@/lib/atomic/api/guard";

export const dynamic = "force-dynamic";

/**
 * Chain registry endpoint — the machine-readable view of every network
 * this deployment serves, including operator-configured chains.
 * Raw RPC endpoint URLs are deliberately omitted: they routinely embed
 * provider API keys. Consumers get the endpoint count and whether the
 * operator replaced the defaults instead.
 */
export async function GET(req: Request) {
  const limited = guardRequest(req, 120);
  if (limited) return limited;

  return NextResponse.json(
    {
      chains: CHAIN_LIST.map((c) => ({
        id: c.id,
        name: c.name,
        evmChainId: c.evmChainId,
        short: c.short,
        nativeSymbol: c.nativeSymbol,
        color: c.color,
        explorer: c.explorer,
        live: c.live,
        avgGasGwei: c.avgGasGwei,
        finalitySec: c.finalitySec,
        rpcEndpoints: c.rpc.length,
        rpcOverridden: c.rpcOverridden,
        source: c.source,
      })),
      configWarnings: CHAIN_WARNINGS,
    },
    { headers: NO_STORE },
  );
}
