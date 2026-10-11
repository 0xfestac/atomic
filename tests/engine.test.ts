import { describe, expect, it } from "vitest";
import { activity, holdings, relationshipGraph, relationshipTargets } from "@/lib/atomic/engine/activity";
import { entitySummary, knownEntity } from "@/lib/atomic/engine/entities";
import { riskLevelOf } from "@/lib/atomic/engine/entities";
import { priceSeries, tokenBySymbol, trendingTokens } from "@/lib/atomic/engine/tokens";
import { securityReport, scanIntentParams } from "@/lib/atomic/security/checks";
import { tokenomicsProfile } from "@/lib/atomic/vesting/schedules";
import { analystReport } from "@/lib/atomic/analyst/report";
import { buildTypedData, intentSummary, stageIntent } from "@/lib/atomic/intents/builder";
import { evaluateRules, defaultRules } from "@/lib/atomic/alerts/rules";

const MIXER = "0x5f260e612d8e2aa66e4174025197e9d68ee743c4";
const ROUTER = "0xe592427a0aece92de3edee1f18e0157c05861564";
const GENERIC = "0x1234567890abcdef1234567890abcdef12345678";

describe("engine determinism", () => {
  it("entity profiles are stable across calls", () => {
    expect(JSON.stringify(entitySummary(GENERIC))).toBe(JSON.stringify(entitySummary(GENERIC)));
  });

  it("activity, holdings, and graphs are stable", () => {
    const e = entitySummary(GENERIC);
    expect(JSON.stringify(activity(e))).toBe(JSON.stringify(activity(e)));
    expect(JSON.stringify(holdings(e))).toBe(JSON.stringify(holdings(e)));
    expect(JSON.stringify(relationshipGraph(e))).toBe(JSON.stringify(relationshipGraph(e)));
  });

  it("different addresses produce different profiles", () => {
    const a = entitySummary(GENERIC);
    const b = entitySummary("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd");
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("profiles sample the supplied chain pool and fall back on an empty one", () => {
    const pool = ["zksync-era", "ethereum", "base", "polygon"];
    const profiled = entitySummary(GENERIC, pool);
    expect(profiled.chains.length).toBeGreaterThan(0);
    for (const chain of profiled.chains) expect(pool).toContain(chain);
    expect(JSON.stringify(entitySummary(GENERIC, pool))).toBe(JSON.stringify(profiled));
    expect(JSON.stringify(entitySummary(GENERIC, []))).toBe(JSON.stringify(entitySummary(GENERIC)));
  });

  it("operator-added chains flow through relationships and alerts", () => {
    const pool = ["zksync-era", "ethereum", "base"];
    const targets = relationshipTargets(GENERIC, 8, pool);
    expect(targets.every((t) => pool.includes(t.chain))).toBe(true);
    const rules = defaultRules().filter((r) => r.enabled);
    const events = evaluateRules(rules, pool);
    expect(JSON.stringify(events)).toBe(JSON.stringify(evaluateRules(rules, pool)));
  });

  it("price series are stable and trending tokens are sorted by move size", () => {
    expect(priceSeries("WETH", 30)).toEqual(priceSeries("WETH", 30));
    const moves = trendingTokens().map((t) => Math.abs(t.change24h));
    expect([...moves].sort((x, y) => y - x)).toEqual(moves);
  });
});

describe("entities & risk", () => {
  it("risk level mapping covers bands", () => {
    expect(riskLevelOf(10)).toBe("low");
    expect(riskLevelOf(30)).toBe("medium");
    expect(riskLevelOf(60)).toBe("high");
    expect(riskLevelOf(90)).toBe("critical");
  });

  it("flagged entities carry critical registry flags and high risk", () => {
    const mixer = entitySummary(MIXER);
    expect(knownEntity(MIXER)?.tags).toContain("mixer");
    expect(mixer.riskFlags.some((f) => f.level === "critical")).toBe(true);
    expect(mixer.riskScore).toBeGreaterThan(50);
  });

  it("relationship targets exclude the subject itself", () => {
    const e = entitySummary(GENERIC);
    expect(relationshipTargets(GENERIC, 10).every((t) => t.address !== GENERIC)).toBe(true);
    expect(relationshipGraph(e).edges.length).toBeGreaterThan(0);
  });
});

describe("security checks", () => {
  it("every check carries evidence and bounded scores", () => {
    const report = securityReport(GENERIC, entitySummary(GENERIC));
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(report.checks.length).toBeGreaterThan(5);
    for (const check of report.checks) {
      expect(check.evidence.length).toBeGreaterThan(0);
      expect(["pass", "warn", "fail", "info"]).toContain(check.status);
    }
  });

  it("clean anchor scores higher than flagged mixer", () => {
    const clean = securityReport(ROUTER, entitySummary(ROUTER));
    const dirty = securityReport(MIXER, entitySummary(MIXER));
    expect(clean.score).toBeGreaterThan(dirty.score);
  });

  it("tx scan flags flagged recipients and unlimited approvals", () => {
    const flagged = scanIntentParams({ chain: "ethereum", to: MIXER, kind: "transfer", amount: 100 });
    expect(flagged.warnings.some((w) => w.status === "fail")).toBe(true);

    const unlimited = scanIntentParams({ chain: "base", to: GENERIC, kind: "approve" });
    expect(unlimited.warnings.some((w) => w.status === "warn")).toBe(true);
  });
});

describe("vesting & tokenomics", () => {
  it("demo token schedule starts at TGE unlock and reaches 100% monotonically", () => {
    const profile = tokenomicsProfile("NEXA");
    expect(profile).not.toBeNull();
    const schedule = profile!.schedule;
    expect(schedule[0].circulatingPct).toBeGreaterThan(0);
    expect(schedule[schedule.length - 1].circulatingPct).toBe(100);
    for (let i = 1; i < schedule.length; i++) {
      expect(schedule[i].circulatingPct).toBeGreaterThanOrEqual(schedule[i - 1].circulatingPct);
    }
  });

  it("returns null for non-demo tokens", () => {
    expect(tokenomicsProfile("WETH")).toBeNull();
  });

  it("allocation shares sum to 100", () => {
    const profile = tokenomicsProfile("HELIX")!;
    const sum = profile.allocation.reduce((acc, a) => acc + a.sharePct, 0);
    expect(sum).toBe(100);
  });
});

describe("analyst report", () => {
  it("flags critical exposure for the mixer and stays deterministic", () => {
    const mixer = entitySummary(MIXER);
    const report = analystReport(mixer);
    expect(report.findings.some((f) => f.severity === "critical")).toBe(true);
    expect(JSON.stringify(report)).toBe(JSON.stringify(analystReport(mixer)));
    expect(report.narrative.length).toBeGreaterThanOrEqual(3);
  });

  it("headline always carries a verdict and stays deterministic", () => {
    const router = entitySummary(ROUTER);
    const report = analystReport(router);
    expect(report.headline.length).toBeGreaterThan(10);
    expect(JSON.stringify(report)).toBe(JSON.stringify(analystReport(router)));
  });
});

describe("intents", () => {
  const spec = {
    kind: "swap" as const,
    chain: "base" as const,
    from: GENERIC,
    to: ROUTER,
    inputToken: "USDC",
    outputToken: "WETH",
    amount: 2500,
    slippagePct: 0.5,
  };

  it("typed data is EIP-712 shaped with ATOMIC domain", () => {
    const typed = buildTypedData(spec);
    const domain = typed.domain as { name: string; version: string; chainId: number };
    expect(domain.name).toBe("ATOMIC Intent");
    expect(domain.version).toBe("1");
    expect(domain.chainId).toBeGreaterThan(0);
    expect((typed.message as Record<string, unknown>).kind).toBe("swap");
  });

  it("summary describes the action and staging attaches scan results", () => {
    expect(intentSummary(spec)).toContain("USDC");
    const staged = stageIntent(spec);
    expect(staged.state).toBe("review");
    expect(staged.securityNotes.length).toBeGreaterThan(2);
    expect(staged.securityScore).toBeGreaterThanOrEqual(0);
    expect(staged.securityScore).toBeLessThanOrEqual(100);
  });

  it("staged intent against flagged recipient scores low", () => {
    const staged = stageIntent({ ...spec, to: MIXER });
    expect(staged.securityScore).toBeLessThan(60);
  });
});

describe("alerts", () => {
  it("evaluation is deterministic and targets exist", () => {
    const rules = defaultRules();
    const run = evaluateRules(rules);
    expect(JSON.stringify(run)).toBe(JSON.stringify(evaluateRules(rules)));
    for (const rule of rules) {
      expect(rule.target.toLowerCase()).toMatch(/^0x[0-9a-f]{40}$/);
    }
  });

  it("treasury outflow guard produces an event (dataset exceeds threshold)", () => {
    const events = evaluateRules(defaultRules().filter((r) => r.id === "rule_treasury_watch"));
    expect(events.length).toBe(1);
    expect(events[0].ruleName).toBe("Treasury outflow guard");
  });

  it("token catalog contains ATOMIC treasury anchor token requirements", () => {
    expect(tokenBySymbol("USDC")).toBeDefined();
    expect(tokenBySymbol("NEXA")?.demo).toBe(true);
  });
});
