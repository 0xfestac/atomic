import type { AlertCondition, AlertEvent, AlertRule, EntitySummary, RiskLevel } from "../types";
import { Rng, daysAgoIso, formatUsd, shortAddress } from "../engine/prng";
import { entitySummary } from "../engine/entities";
import { activity } from "../engine/activity";

/**
 * Alert rules & workflows. Rules are persisted client-side (workspace
 * settings) and evaluated against the deterministic dataset, so demo
 * triggers are reproducible. Production deployments register webhook,
 * email, and agent actions against the same rule interface.
 */

export const CONDITION_LABELS: Record<AlertCondition, string> = {
  "risk-score-above": "Risk score rises above",
  "transfer-above-usd": "Single transfer exceeds",
  "new-contract-interaction": "First interaction with new contract",
  "flagged-counterparty": "Any flagged-counterparty exposure",
};

/**
 * Webhook targets must be public http(s) URLs — loopback, link-local,
 * private-range, and non-http schemes are rejected at rule creation so a
 * later delivery worker can never be pointed at internal infrastructure.
 */
export function isValidWebhookUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const [a, b] = host.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224) return false;
  }
  if (host === "[::1]" || host.startsWith("[")) return false;
  return true;
}

interface EvaluatedTx {
  valueUsd: number;
  counterparty: string;
  type: string;
}

function evaluateRule(rule: AlertRule): AlertEvent | null {
  const entity: EntitySummary = entitySummary(rule.target);

  if (rule.condition === "risk-score-above") {
    if (entity.riskScore > rule.threshold) {
      return makeEvent(rule, entity, `Risk score ${entity.riskScore}/100 crossed threshold ${rule.threshold}.`, entity.riskLevel);
    }
    return null;
  }

  const txs: EvaluatedTx[] = activity(entity, 60).map((tx) => ({
    valueUsd: tx.valueUsd,
    counterparty: tx.counterparty,
    type: tx.type,
  }));

  if (rule.condition === "transfer-above-usd") {
    const hit = txs.find((tx) => tx.valueUsd > rule.threshold);
    if (hit) {
      return makeEvent(rule, entity, `Transfer of ${formatUsd(hit.valueUsd)} observed to ${shortAddress(hit.counterparty)}.`, hit.valueUsd > rule.threshold * 4 ? "high" : "medium");
    }
    return null;
  }

  if (rule.condition === "new-contract-interaction") {
    const contractTxs = txs.filter((tx) => tx.type === "contract" || tx.type === "approve");
    const hit = contractTxs[contractTxs.length - 1];
    if (hit) {
      return makeEvent(rule, entity, `New contract interaction with ${shortAddress(hit.counterparty)}.`, "low");
    }
    return null;
  }

  // flagged-counterparty
  const rng = new Rng(`alerts:flagged:${rule.target}`);
  if (entity.riskFlags.length > 0 || rng.chance(0.3)) {
    return makeEvent(rule, entity, `Flagged-counterparty exposure detected (${entity.riskFlags[0]?.label ?? "registry match"}).`, "high");
  }
  return null;
}

function makeEvent(rule: AlertRule, entity: EntitySummary, message: string, severity: RiskLevel): AlertEvent {
  const rng = new Rng(`event:${rule.id}:${rule.condition}`);
  return {
    id: `evt_${rule.id.slice(0, 8)}_${rng.int(1e5, 9e5)}`,
    ruleId: rule.id,
    ruleName: rule.name,
    message,
    subject: entity.address,
    severity,
    timestamp: daysAgoIso(rng.int(0, 3) + rng.float()),
  };
}

export function evaluateRules(rules: AlertRule[]): AlertEvent[] {
  return rules
    .filter((r) => r.enabled)
    .map(evaluateRule)
    .filter((e): e is AlertEvent => e !== null)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function defaultRules(): AlertRule[] {
  return [
    {
      id: "rule_treasury_watch",
      name: "Treasury outflow guard",
      target: "0xa70f1c00000000000000000000000000000a70f1",
      targetLabel: "ATOMIC Treasury (demo)",
      condition: "transfer-above-usd",
      threshold: 5_000,
      channel: "in-app",
      enabled: true,
    },
    {
      id: "rule_nexa_whale",
      name: "NEXA whale movement",
      target: "0x9f8c1d3b7a2e4f5a6b8c0d1e2f3a4b5c6d7e8f9a",
      targetLabel: "StealthLaunch Router (flagged)",
      condition: "transfer-above-usd",
      threshold: 50_000,
      channel: "webhook",
      webhookUrl: "https://hooks.example.internal/atomic/nexa",
      enabled: true,
    },
    {
      id: "rule_mixeree_watch",
      name: "Mixer exposure monitor",
      target: "0x5f260e612d8e2aa66e4174025197e9d68ee743c4",
      targetLabel: "Mixeree Pro (flagged)",
      condition: "flagged-counterparty",
      threshold: 0,
      channel: "in-app",
      enabled: false,
    },
  ];
}
