import { NextResponse } from "next/server";
import { TOKENS, priceSeries } from "@/lib/atomic/engine/tokens";
import { NO_STORE, guardRequest } from "@/lib/atomic/api/guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = guardRequest(req);
  if (limited) return limited;

  return NextResponse.json(
    {
      tokens: TOKENS.map((t) => ({
        symbol: t.symbol,
        name: t.name,
        chain: t.chain,
        address: t.address,
        priceUsd: t.priceUsd,
        change24h: t.change24h,
        marketCapUsd: t.marketCapUsd,
        category: t.category,
        demo: t.demo,
        series30d: priceSeries(t.symbol, 30),
      })),
    },
    { headers: NO_STORE },
  );
}
