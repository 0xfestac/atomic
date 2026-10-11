import { NextResponse } from "next/server";
import { entitySummary } from "@/lib/atomic/engine/entities";
import { securityReport } from "@/lib/atomic/security/checks";
import { isEvmAddress } from "@/lib/atomic/engine/prng";

export async function GET(_req: Request, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!isEvmAddress(address)) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }
  const entity = entitySummary(address);
  return NextResponse.json(securityReport(address, entity));
}
