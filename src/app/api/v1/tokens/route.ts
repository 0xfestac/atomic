import { NextResponse } from "next/server";
import { TOKENS, priceSeries } from "@/lib/atomic/engine/tokens";

export async function GET() {
  return NextResponse.json({
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
  });
}
