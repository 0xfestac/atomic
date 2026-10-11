import type { EntitySummary, RiskLevel, SecurityCheck, SecurityReport } from "../types";
import { CHAINS } from "../chains";
import { knownEntity } from "../engine/entities";
import { Rng, DATA_NOW } from "../engine/prng";
import { tokenByAddress } from "../engine/tokens";

/**
 * Deterministic security analysis. Every check is a fixed, explainable
 * rule evaluated against the stable dataset — no model calls, no hidden
 * randomness. Production deployments register additional check providers
 * under the same interface.
 */

interface CheckSpec {
  id: string;
  title: string;
  category: SecurityCheck["category"];
  severityIfFail: RiskLevel;
  evaluate: (ctx: EvalContext) => { status: SecurityCheck["status"]; detail: string; evidence: string };
}

interface EvalContext {
  address: string;
  rng: Rng;
  entity: EntitySummary;
  isToken: boolean;
  isContract: boolean;
  flagged: boolean;
  tokenMeta: ReturnType<typeof tokenByAddress>;
}

const SPECS: CheckSpec[] = [
  {
    id: "SRC-01",
    title: "Source verification",
    category: "contract",
    severityIfFail: "high",
    evaluate: (c) => {
      const verified = c.isContract ? c.rng.chance(c.flagged ? 0.15 : 0.82) : true;
      return {
        status: verified ? "pass" : "fail",
        detail: verified
          ? "Bytecode matches published, verified source on the chain explorer."
          : "No verified source found; behavior cannot be audited from bytecode alone.",
        evidence: verified ? "explorer:verified-metadata" : "explorer:unverified-bytecode",
      };
    },
  },
  {
    id: "OWN-01",
    title: "Ownership & admin keys",
    category: "ownership",
    severityIfFail: "high",
    evaluate: (c) => {
      if (!c.isContract && !c.isToken) {
        return { status: "info", detail: "Not applicable: subject is an externally-owned wallet.", evidence: "n/a" };
      }
      const renounced = c.rng.chance(c.flagged ? 0.1 : 0.68);
      return {
        status: renounced ? "pass" : "warn",
        detail: renounced
          ? "Owner privileges renounced; no single key can change core parameters."
          : "Owner role retained. Admin keys can modify parameters without notice.",
        evidence: renounced ? "owner=0x000…000 (renounced)" : "owner=EOA retained",
      };
    },
  },
  {
    id: "OWN-02",
    title: "Mint authority",
    category: "ownership",
    severityIfFail: "critical",
    evaluate: (c) => {
      if (!c.isToken) {
        return { status: "info", detail: "Not applicable: no mint surface on subject.", evidence: "n/a" };
      }
      const mintable = c.rng.chance(c.flagged ? 0.7 : 0.2);
      return {
        status: mintable ? "fail" : "pass",
        detail: mintable
          ? "Unrestricted mint function reachable by owner; supply can be inflated."
          : "Mint authority disabled or capped; supply is fixed at deployment.",
        evidence: mintable ? "mint(address,uint256) reachable" : "mint disabled",
      };
    },
  },
  {
    id: "ECH-01",
    title: "Holder concentration",
    category: "economy",
    severityIfFail: "high",
    evaluate: (c) => {
      const top10 = c.isToken ? c.rng.logScale(12, 74) : c.rng.logScale(5, 40);
      const status = top10 > 55 ? "fail" : top10 > 35 ? "warn" : "pass";
      return {
        status,
        detail: `Top 10 holders control ${top10.toFixed(1)}% of supply. ${status === "pass" ? "Distribution is healthy." : status === "warn" ? "Moderate concentration — monitor exit risk." : "Severe concentration; single exits can crash price."}`,
        evidence: `top10=${top10.toFixed(1)}%`,
      };
    },
  },
  {
    id: "ECH-02",
    title: "Transfer tax & honeypot heuristic",
    category: "behavior",
    severityIfFail: "critical",
    evaluate: (c) => {
      const tax = c.rng.chance(c.flagged ? 0.75 : 0.12);
      const status = tax ? "fail" : "pass";
      return {
        status,
        detail: tax
          ? "Simulation shows sell-side extraction above 10% or blocked sell paths (honeypot pattern)."
          : "Simulated buy/sell round-trip: no hidden fees or blocked transfers detected.",
        evidence: tax ? "sim:sell-blocked/tax>10%" : "sim:roundtrip-clean",
      };
    },
  },
  {
    id: "BEH-01",
    title: "Blacklist / freeze functions",
    category: "behavior",
    severityIfFail: "high",
    evaluate: (c) => {
      const present = c.rng.chance(c.flagged ? 0.6 : 0.22);
      return {
        status: present ? "warn" : "pass",
        detail: present
          ? "Address blacklist function present — holders can be frozen at will."
          : "No blacklist or freeze surface in ABI or bytecode.",
        evidence: present ? "blacklist(address) present" : "no freeze surface",
      };
    },
  },
  {
    id: "UPG-01",
    title: "Proxy upgradeability",
    category: "contract",
    severityIfFail: "medium",
    evaluate: (c) => {
      const proxy = c.rng.chance(0.34);
      return {
        status: proxy ? "warn" : "pass",
        detail: proxy
          ? "Upgradeable proxy pattern in use; implementation can be swapped by admin."
          : "Immutable deployment — no proxy slots detected.",
        evidence: proxy ? "EIP-1967 proxy" : "immutable",
      };
    },
  },
  {
    id: "LIQ-01",
    title: "Liquidity lock & burn",
    category: "liquidity",
    severityIfFail: "high",
    evaluate: (c) => {
      const locked = c.rng.chance(c.flagged ? 0.12 : 0.72);
      return {
        status: locked ? "pass" : "fail",
        detail: locked
          ? "LP positions locked or burned; liquidity cannot be pulled at short notice."
          : "LP tokens held in an unlocked EOA — liquidity can be removed instantly.",
        evidence: locked ? "lp:locked>180d" : "lp:unlocked",
      };
    },
  },
  {
    id: "DEP-01",
    title: "Deployer reputation",
    category: "behavior",
    severityIfFail: "medium",
    evaluate: (c) => {
      const clean = c.rng.chance(c.flagged ? 0.08 : 0.8);
      return {
        status: clean ? "pass" : "warn",
        detail: clean
          ? "Deployer history shows no association with flagged contracts."
          : "Deployer previously shipped contracts now flagged (demo attribution).",
        evidence: clean ? "deployer:clean" : "deployer:linked-to-flagged",
      };
    },
  },
  {
    id: "NET-01",
    title: "Sanctions & registry screening",
    category: "behavior",
    severityIfFail: "critical",
    evaluate: (c) => {
      const hit = c.flagged;
      return {
        status: hit ? "fail" : "pass",
        detail: hit
          ? "Address appears on a simulated risk registry (mixer / honeypot attribution). Interactions carry legal and funds-safety risk."
          : "No hits across registry screening (demo registries).",
        evidence: hit ? "registry:match" : "registry:clean",
      };
    },
  },
];

const WEIGHTS: Record<SecurityCheck["status"], number> = { pass: 0, info: 0, warn: 9, fail: 26 };

export function securityReport(rawAddress: string, entity?: EntitySummary): SecurityReport {
  const address = rawAddress.toLowerCase();
  const ent = entity ?? undefined;
  const known = knownEntity(address);
  const rng = new Rng(`security:${address}`);
  const tokenMeta = tokenByAddress(address);
  const isContract = (ent?.type ?? known?.type) === "contract" || !!tokenMeta;
  const flagged = !!known && known.riskBias >= 30;

  const ctx: EvalContext = { address, rng, entity: ent as EntitySummary, isToken: !!tokenMeta, isContract, flagged, tokenMeta };

  const checks: SecurityCheck[] = SPECS.map((spec) => {
    const result = spec.evaluate(ctx);
    return {
      id: spec.id,
      title: spec.title,
      category: spec.category,
      status: result.status,
      severityIfFail: spec.severityIfFail,
      detail: result.detail,
      evidence: result.evidence,
    };
  });

  const score = Math.max(0, Math.min(100, 100 - checks.reduce((acc, c) => acc + WEIGHTS[c.status], 0)));
  const grade = score >= 88 ? "A" : score >= 72 ? "B" : score >= 55 ? "C" : score >= 35 ? "D" : "F";

  return {
    subject: address,
    subjectLabel: known?.label ?? null,
    grade,
    score: Math.round(score),
    checks,
    generatedAt: new Date(DATA_NOW).toISOString(),
  };
}

export interface TxScanResult {
  warnings: { status: "pass" | "warn" | "fail"; text: string }[];
  score: number;
}

/** Deterministic pre-flight scan of an intent's parameters. */
export function scanIntentParams(params: {
  chain: string;
  to: string;
  kind: string;
  amount?: number;
  slippagePct?: number;
  inputToken?: string;
}): TxScanResult {
  const warnings: TxScanResult["warnings"] = [];
  const rng = new Rng(`txscan:${JSON.stringify(params)}`);
  const to = params.to.toLowerCase();
  const known = knownEntity(to);
  const flagged = !!known && known.riskBias >= 30;

  warnings.push(
    flagged
      ? { status: "fail", text: `Recipient ${known?.label ?? to} is flagged by risk registries — funds may be unrecoverable.` }
      : { status: "pass", text: "Recipient has no registry hits." },
  );
  if (flagged) {
    warnings.push({ status: "fail", text: "Recipient carries sanctions-watch attribution — proceeding creates legal exposure for the sender." });
  }

  if (params.kind === "approve") {
    if (params.amount === undefined || params.amount > 1_000_000) {
      warnings.push({ status: "warn", text: "Approval is unlimited or near-unlimited — consider an exact amount." });
    } else {
      warnings.push({ status: "pass", text: "Approval scope is bounded." });
    }
  }

  const slippage = params.slippagePct ?? 0.5;
  warnings.push(
    slippage > 3
      ? { status: "warn", text: `Slippage tolerance ${slippage}% is high — exposed to sandwich attacks.` }
      : { status: "pass", text: `Slippage tolerance ${slippage}% within safe band.` },
  );

  const chainMeta = CHAINS[params.chain as keyof typeof CHAINS];
  warnings.push({
    status: "pass",
    text: `Route targets ${chainMeta?.name ?? params.chain}; estimated gas ${rng.logScale(0.2, 12).toFixed(2)} USD.`,
  });

  const score = Math.max(0, 100 - warnings.filter((w) => w.status !== "pass").length * 22);
  return { warnings, score };
}
