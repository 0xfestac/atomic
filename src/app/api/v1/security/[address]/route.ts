import { NextResponse } from "next/server";
import { CHAIN_LIST } from "@/lib/atomic/chains";
import { ensureChains } from "@/lib/atomic/chains-config";
import { entitySummary } from "@/lib/atomic/engine/entities";
import { securityReport } from "@/lib/atomic/security/checks";
import { isEvmAddress } from "@/lib/atomic/engine/prng";
import { onchainFactsForChains } from "@/lib/atomic/onchain/adapter";
import { NO_STORE, guardRequest, jsonError } from "@/lib/atomic/api/guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ address: string }> }) {
  const limited = guardRequest(req);
  if (limited) return limited;
  await ensureChains();

  const { address } = await params;
  if (!isEvmAddress(address)) return jsonError("invalid address", 400);

  const subject = address.toLowerCase();
  const entity = entitySummary(subject, CHAIN_LIST.map((c) => c.id));
  const live = await onchainFactsForChains(entity.chains, subject);

  return NextResponse.json(securityReport(subject, entity, live), { headers: NO_STORE });
}
