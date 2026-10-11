import { NextResponse } from "next/server";
import { scanIntentParams } from "@/lib/atomic/security/checks";
import { CHAINS } from "@/lib/atomic/chains";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { chain, to, kind, amount, slippagePct, inputToken } = (body ?? {}) as Record<string, unknown>;

  if (typeof chain !== "string" || !(chain in CHAINS)) {
    return NextResponse.json({ error: "unknown chain" }, { status: 400 });
  }
  if (typeof to !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(to)) {
    return NextResponse.json({ error: "invalid recipient" }, { status: 400 });
  }
  if (typeof kind !== "string" || !["swap", "transfer", "approve", "contract-call"].includes(kind)) {
    return NextResponse.json({ error: "invalid kind" }, { status: 400 });
  }

  const scan = scanIntentParams({
    chain,
    to: to.toLowerCase(),
    kind,
    amount: typeof amount === "number" ? amount : undefined,
    slippagePct: typeof slippagePct === "number" ? slippagePct : undefined,
    inputToken: typeof inputToken === "string" ? inputToken : undefined,
  });

  return NextResponse.json({ scan, note: "read-only pre-flight — ATOMIC never broadcasts transactions" });
}
