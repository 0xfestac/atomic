import { NextResponse } from "next/server";
import { CHAIN_LIST } from "@/lib/atomic/chains";
import { ensureChains } from "@/lib/atomic/chains-config";
import { entitySummary } from "@/lib/atomic/engine/entities";
import { activity, holdings, relationshipGraph } from "@/lib/atomic/engine/activity";
import { onchainFactsForChains } from "@/lib/atomic/onchain/adapter";
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
      holdings: holdings(entity),
      relationships: relationshipGraph(entity, chainPool),
      activity: activity(entity, 20, chainPool),
    },
    { headers: NO_STORE },
  );
}
