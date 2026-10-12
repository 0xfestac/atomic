import { NextResponse } from "next/server";
import { CHAIN_LIST } from "@/lib/atomic/chains";
import { ensureChains } from "@/lib/atomic/chains-config";
import { entitySummary } from "@/lib/atomic/engine/entities";
import { activity, holdings, relationshipGraph } from "@/lib/atomic/engine/activity";
import { onchainFactsForChains } from "@/lib/atomic/onchain/adapter";
import { liveTokenBalancesForChains, liveTransfersForChains } from "@/lib/atomic/onchain/erc20";
import { NO_STORE, guardRequest, jsonError, validAddress } from "@/lib/atomic/api/guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ address: string }> }) {
  const limited = guardRequest(req);
  if (limited) return limited;
  await ensureChains();

  const { address } = await params;
  if (!validAddress(address)) return jsonError("invalid address", 400);

  const chainPool = CHAIN_LIST.map((c) => c.id);
  const entity = entitySummary(address, chainPool);
  const live = await onchainFactsForChains(entity.chains, entity.address);
  const [livePositions, liveTransfers] = await Promise.all([
    liveTokenBalancesForChains(entity.chains, entity.address, 3),
    liveTransfersForChains(entity.chains, entity.address, 3),
  ]);

  return NextResponse.json(
    {
      entity,
      live: live.filter(Boolean).map((f) => ({
        chain: f!.chain,
        isContract: f!.classification?.isContract ?? null,
        codeSizeBytes: f!.classification?.codeSizeBytes ?? null,
        delegation: f!.classification?.delegation?.delegate ?? null,
        nativeBalanceWei: f!.nativeBalanceWei?.toString() ?? null,
        txCount: f!.txCount,
        proxyImplementation: f!.proxy?.implementation ?? null,
        ownerRenounced: f!.owner?.renounced ?? null,
      })),
      livePositions: livePositions.filter((p): p is NonNullable<typeof p> => Array.isArray(p) && p.length > 0).flat(),
      liveTransfers: liveTransfers.filter((t): t is NonNullable<typeof t> => Array.isArray(t) && t.length > 0).flat(),
      holdings: holdings(entity),
      relationships: relationshipGraph(entity, chainPool),
      activity: activity(entity, 20, chainPool),
    },
    { headers: NO_STORE },
  );
}
