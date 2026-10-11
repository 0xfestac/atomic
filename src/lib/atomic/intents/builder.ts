import type { IntentSpec, StagedIntent } from "../types";
import { CHAINS } from "../chains";
import { formatAmount, Rng } from "../engine/prng";
import { tokenBySymbol } from "../engine/tokens";
import { scanIntentParams } from "../security/checks";

/**
 * Intent preparation ("Act" stage). ATOMIC never holds keys and never
 * broadcasts: an intent is compiled into a signable typed-data payload
 * that the user reviews, approves explicitly, and executes from their own
 * wallet. Staged payloads remain unsigned data — approval is an
 * in-workspace review state only.
 */

export function intentSummary(spec: IntentSpec): string {
  const chainName = CHAINS[spec.chain]?.name ?? spec.chain;
  switch (spec.kind) {
    case "swap": {
      const inTok = tokenBySymbol(spec.inputToken ?? "USDC");
      const outTok = tokenBySymbol(spec.outputToken ?? "WETH");
      return `Swap ${formatAmount(spec.amount ?? 0)} ${inTok?.symbol} → ${outTok?.symbol} on ${chainName} (max slippage ${spec.slippagePct ?? 0.5}%)`;
    }
    case "transfer": {
      const tok = tokenBySymbol(spec.inputToken ?? "USDC");
      return `Transfer ${formatAmount(spec.amount ?? 0)} ${tok?.symbol} to ${short(spec.to)} on ${chainName}`;
    }
    case "approve": {
      const tok = tokenBySymbol(spec.inputToken ?? "USDC");
      return `Approve ${spec.amount === undefined ? "unlimited" : formatAmount(spec.amount)} ${tok?.symbol} for ${short(spec.to)} on ${chainName}`;
    }
    case "contract-call":
      return `Call ${short(spec.to)} on ${chainName}${spec.data ? ` with ${Math.floor((spec.data.length - 2) / 2)} bytes calldata` : ""}`;
  }
}

function short(address: string): string {
  return address.length > 12 ? `${address.slice(0, 8)}…${address.slice(-6)}` : address;
}

/** EIP-712 typed data a wallet would sign. Kept canonical & deterministic. */
export function buildTypedData(spec: IntentSpec): Record<string, unknown> {
  const chainId = 1 + ["ethereum", "base", "arbitrum", "optimism", "polygon", "bnb", "avalanche"].indexOf(spec.chain);
  return {
    domain: {
      name: "ATOMIC Intent",
      version: "1",
      chainId,
    },
    primaryType: "Intent",
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
      ],
      Intent: [
        { name: "kind", type: "string" },
        { name: "chain", type: "string" },
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "inputToken", type: "string" },
        { name: "amount", type: "string" },
        { name: "slippagePct", type: "string" },
        { name: "memo", type: "string" },
      ],
    },
    message: {
      kind: spec.kind,
      chain: spec.chain,
      from: spec.from,
      to: spec.to,
      inputToken: spec.inputToken ?? "",
      amount: spec.amount !== undefined ? String(spec.amount) : "",
      slippagePct: spec.slippagePct !== undefined ? String(spec.slippagePct) : "",
      memo: spec.memo ?? "",
    },
  };
}

export function stageIntent(spec: IntentSpec): StagedIntent {
  const scan = scanIntentParams({
    chain: spec.chain,
    to: spec.to,
    kind: spec.kind,
    amount: spec.amount,
    slippagePct: spec.slippagePct,
    inputToken: spec.inputToken,
  });

  const id = `int_${new Rng(`intent:${JSON.stringify(spec)}:${Date.now()}`).int(1e11, 9e11).toString(36)}`;

  return {
    id,
    kind: spec.kind,
    chain: spec.chain,
    createdAt: new Date().toISOString(),
    typedData: buildTypedData(spec),
    summary: intentSummary(spec),
    securityScore: scan.score,
    securityNotes: scan.warnings,
    state: "review",
  };
}

export function estimateIntentValue(spec: IntentSpec): number {
  if (spec.amount === undefined) return 0;
  const tok = tokenBySymbol(spec.inputToken ?? "USDC");
  return spec.amount * (tok?.priceUsd ?? 0);
}
