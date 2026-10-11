import type { AnalystReport, EntitySummary, Finding } from "../types";
import { CHAINS } from "../chains";
import { holdings, relationshipGraph } from "../engine/activity";
import { knownEntity } from "../engine/entities";
import { DATA_NOW, formatUsd, shortAddress } from "../engine/prng";
import { securityReport } from "../security/checks";

/**
 * Rule-based analyst engine ("Explain" stage). Findings are derived
 * deterministically from the investigation dataset — the same subject
 * always produces the same report. An LLM provider can be attached to
 * rephrase narrative (see /integrations) but findings and evidence stay
 * rule-driven so conclusions are auditable.
 */

export function analystReport(entity: EntitySummary): AnalystReport {
  const graph = relationshipGraph(entity);
  const security = securityReport(entity.address, entity);
  const positions = holdings(entity);
  const known = knownEntity(entity.address);
  const findings: Finding[] = [];

  // F1: registry / flags
  if (entity.riskFlags.length > 0) {
    const worst = entity.riskFlags[0];
    findings.push({
      id: "F1",
      severity: worst.level,
      title: `${entity.riskFlags.length} risk flag${entity.riskFlags.length > 1 ? "s" : ""} on subject`,
      detail: entity.riskFlags.map((f) => `${f.label}: ${f.detail}`).join(" "),
      evidence: entity.riskFlags.map((f) => `flag:${f.id}`),
    });
  }

  // F2: flagged counterparty exposure
  const flaggedEdges = graph.edges.filter((e) => e.riskLevel === "high" || e.riskLevel === "critical");
  if (flaggedEdges.length > 0) {
    const volume = flaggedEdges.reduce((acc, e) => acc + e.volumeUsd, 0);
    findings.push({
      id: "F2",
      severity: flaggedEdges.length > 2 ? "high" : "medium",
      title: `Exposure to ${flaggedEdges.length} flagged counterpart${flaggedEdges.length > 1 ? "ies" : "y"}`,
      detail: `Traced ${formatUsd(volume)} in cumulative volume to high-risk addresses, including ${flaggedEdges[0].label ?? shortAddress(flaggedEdges[0].node)}. Direct interactions observed within the lookback window.`,
      evidence: flaggedEdges.slice(0, 3).map((e) => `edge:${shortAddress(e.node)} vol=${formatUsd(e.volumeUsd)}`),
    });
  }

  // F3: security posture
  const failed = security.checks.filter((c) => c.status === "fail");
  if (failed.length > 0) {
    findings.push({
      id: "F3",
      severity: failed.some((c) => c.severityIfFail === "critical") ? "critical" : "high",
      title: `Security grade ${security.grade} — ${failed.length} failed check${failed.length > 1 ? "s" : ""}`,
      detail: `Failed: ${failed.map((c) => c.title).join(", ")}. ${failed[0].detail}`,
      evidence: failed.map((c) => `check:${c.id}`),
    });
  }

  // F4: concentration / custody
  const custody = graph.edges.filter((e) => knownEntity(e.node)?.tags.includes("exchange"));
  if (custody.length > 0 && entity.balanceUsd > 100_000) {
    findings.push({
      id: "F4",
      severity: "low",
      title: "Custody-linked activity",
      detail: `Routes value through ${custody.length} exchange-linked address${custody.length > 1 ? "es" : ""} (${custody.map((c) => c.label ?? shortAddress(c.node)).join(", ")}). Consistent with brokerage or OTC behavior; not inherently adverse.`,
      evidence: custody.map((c) => `edge:${c.label ?? shortAddress(c.node)}`),
    });
  }

  // F5: maturity
  const ageDays = Math.round((DATA_NOW - new Date(entity.firstSeen).getTime()) / 86400_000);
  if (ageDays < 30) {
    findings.push({
      id: "F5",
      severity: "medium",
      title: "Recently activated wallet",
      detail: `First observed ${ageDays} day${ageDays === 1 ? "" : "s"} ago with ${formatUsd(entity.balanceUsd)} current balance. Short history limits behavioral attribution; treat peer conclusions as provisional.`,
      evidence: [`firstSeen:${entity.firstSeen.slice(0, 10)}`],
    });
  }

  findings.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

  const headline = buildHeadline(entity, findings, known?.label ?? null);
  const narrative = buildNarrative(entity, findings, security.grade, positions.length, graph.edges.length);

  return {
    subject: entity.address,
    headline,
    narrative,
    findings,
    confidence: Math.max(38, Math.min(94, 60 + Math.min(graph.edges.length, 12) * 2 - findings.filter((f) => f.severity === "critical").length * 8)),
    sources: [
      "ATOMIC deterministic demo dataset",
      ...entity.chains.map((c) => `${CHAINS[c].name} indexer (demo)`),
      "risk registries (demo)",
    ],
    generatedAt: new Date(DATA_NOW).toISOString(),
  };
}

function severityRank(level: Finding["severity"]): number {
  return { critical: 4, high: 3, medium: 2, low: 1 }[level];
}

function buildHeadline(entity: EntitySummary, findings: Finding[], label: string | null): string {
  const name = label ?? shortAddress(entity.address);
  const critical = findings.filter((f) => f.severity === "critical" || f.severity === "high");
  if (critical.length > 0) {
    return `${name} presents elevated risk: ${critical.length} high-severity finding${critical.length > 1 ? "s" : ""} and a ${entity.riskScore}/100 risk score.`;
  }
  if (findings.length > 0) {
    return `${name} is moderately active with ${findings.length} finding${findings.length > 1 ? "s" : ""}; risk score ${entity.riskScore}/100.`;
  }
  return `${name} shows a clean profile: no adverse findings in the current lookback window.`;
}

function buildNarrative(entity: EntitySummary, findings: Finding[], grade: string, positionCount: number, edgeCount: number): string[] {
  const name = entity.label ?? shortAddress(entity.address);
  const chains = entity.chains.map((c) => CHAINS[c].name).join(", ");
  const lines: string[] = [];

  lines.push(
    `${name} is an ${entity.type === "contract" ? "on-chain contract" : "externally-owned wallet"} active on ${chains}, first observed ${entity.firstSeen.slice(0, 10)} with ${entity.txCount.toLocaleString()} recorded transactions and ${formatUsd(entity.volumeUsd)} lifetime volume.`,
  );
  lines.push(
    `The graph trace resolved ${edgeCount} direct counterparties grouped into funding clusters; ${positionCount} token positions worth ${formatUsd(entity.balanceUsd)} are currently attributed to the subject.`,
  );

  if (findings.length > 0) {
    lines.push(
      `Automated screening raised ${findings.length} finding${findings.length > 1 ? "s" : ""}, led by “${findings[0].title}”. Each finding links to the raw evidence used to derive it; severity follows the deterministic scoring matrix, not heuristics tuned per subject.`,
    );
  } else {
    lines.push("No adverse signals were raised by screening: registry checks, counterparty exposure, and contract posture all came back clean for the selected lookback window.");
  }

  lines.push(
    `Recommended posture: ${entity.riskLevel === "critical" || entity.riskLevel === "high"
      ? "avoid value transfer until exposures are resolved; verify counterparties out-of-band and consider attribution review."
      : entity.riskLevel === "medium"
        ? "permissible with monitoring — stage any interaction through intent review and keep exposure bounded."
        : "standard diligence applies; subject is within normal operating bounds."} Security grade for associated code surfaces: ${grade}.`,
  );

  return lines;
}
