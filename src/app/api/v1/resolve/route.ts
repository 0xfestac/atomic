import { NextResponse } from "next/server";
import { resolveEns } from "@/lib/atomic/onchain/adapter";
import { NO_STORE, guardRequest, jsonError } from "@/lib/atomic/api/guard";

export const dynamic = "force-dynamic";

/** Forward ENS resolution on Ethereum mainnet: /api/v1/resolve?name=vitalik.eth */
export async function GET(req: Request) {
  const limited = guardRequest(req);
  if (limited) return limited;

  const name = new URL(req.url).searchParams.get("name") ?? "";
  if (name.length > 255 || !/^[a-zA-Z0-9.-]+$/.test(name) || !name.includes(".")) {
    return jsonError("invalid name", 400);
  }

  const address = await resolveEns(name);
  if (!address) return jsonError("no resolution", 404, { name });
  return NextResponse.json({ name: name.toLowerCase(), address }, { headers: NO_STORE });
}
