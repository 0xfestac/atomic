import { NextResponse } from "next/server";
import { CHAIN_LIST } from "@/lib/atomic/chains";
import { DATA_NOW } from "@/lib/atomic/engine/prng";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "ATOMIC",
    version: "0.1.0",
    chains: CHAIN_LIST.map((c) => c.id),
    dataPlane: "deterministic-demo",
    anchor: new Date(DATA_NOW).toISOString(),
    time: new Date().toISOString(),
  });
}
