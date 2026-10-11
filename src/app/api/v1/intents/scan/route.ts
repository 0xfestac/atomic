import { NextResponse } from "next/server";
import { scanIntentParams } from "@/lib/atomic/security/checks";
import { isChainId } from "@/lib/atomic/chains";
import { BodyTooLarge, NO_STORE, guardRequest, jsonError, readJsonBody, validAddress } from "@/lib/atomic/api/guard";

export const dynamic = "force-dynamic";

const KINDS = ["swap", "transfer", "approve", "contract-call"] as const;

function boundedNumber(value: unknown, max: number): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max ? value : undefined;
}

export async function POST(req: Request) {
  const limited = guardRequest(req);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await readJsonBody(req, 10_000);
  } catch (err) {
    if (err instanceof BodyTooLarge) return jsonError("body too large", 413);
    return jsonError("invalid JSON body", 400);
  }

  const { chain, to, kind, amount, slippagePct, inputToken } = (body ?? {}) as Record<string, unknown>;

  if (typeof chain !== "string" || !isChainId(chain)) return jsonError("unknown chain", 400);
  if (!validAddress(to)) return jsonError("invalid recipient", 400);
  if (typeof kind !== "string" || !(KINDS as readonly string[]).includes(kind)) {
    return jsonError("invalid kind", 400);
  }

  const scan = scanIntentParams({
    chain,
    to: to.toLowerCase(),
    kind,
    amount: boundedNumber(amount, 1e15),
    slippagePct: boundedNumber(slippagePct, 90),
    inputToken: typeof inputToken === "string" && inputToken.length <= 32 ? inputToken : undefined,
  });

  return NextResponse.json(
    { scan, note: "read-only pre-flight — ATOMIC never broadcasts transactions" },
    { headers: NO_STORE },
  );
}
