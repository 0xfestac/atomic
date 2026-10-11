"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useWorkspace } from "@/lib/atomic/workspace";
import { CONDITION_LABELS, evaluateRules } from "@/lib/atomic/alerts/rules";
import { isEvmAddress, shortAddress } from "@/lib/atomic/engine/prng";
import { entitySummary } from "@/lib/atomic/engine/entities";
import { Badge, Panel, RiskBadge, SectionHeader } from "@/components/ui";
import type { AlertCondition, AlertRule, RiskLevel } from "@/lib/atomic/types";

const CONDITIONS = Object.keys(CONDITION_LABELS) as AlertCondition[];

export function AlertsConsole() {
  const { alertRules, upsertRule, removeRule, toggleRule, dismissedEvents, dismissEvent, hydrated } = useWorkspace();

  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [condition, setCondition] = useState<AlertCondition>("transfer-above-usd");
  const [threshold, setThreshold] = useState("100000");
  const [channel, setChannel] = useState<"in-app" | "webhook">("in-app");
  const [webhookUrl, setWebhookUrl] = useState("");

  const targetValid = isEvmAddress(target);
  const canCreate = name.trim().length >= 3 && targetValid;

  const events = useMemo(() => (hydrated ? evaluateRules(alertRules) : []), [alertRules, hydrated]);
  const visibleEvents = events.filter((e) => !dismissedEvents.includes(e.id));

  if (!hydrated) return <p className="text-xs text-mist-dim">Loading workspace…</p>;

  const create = () => {
    if (!canCreate) return;
    const rule: AlertRule = {
      id: `rule_${Math.random().toString(36).slice(2, 10)}`,
      name: name.trim(),
      target: target.trim().toLowerCase(),
      condition,
      threshold: Number(threshold) || 0,
      channel,
      webhookUrl: channel === "webhook" ? webhookUrl : undefined,
      enabled: true,
    };
    upsertRule(rule);
    setName("");
    setTarget("");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-6 lg:col-span-3">
        <Panel>
          <SectionHeader title="Rules" sub="Persisted in this workspace · evaluated live against the dataset" />
          <div className="space-y-2">
            {alertRules.map((rule) => {
              const subject = entitySummary(rule.target);
              return (
                <div key={rule.id} className="rounded-lg border border-ink-700 bg-ink-800/50 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-sm ${rule.enabled ? "text-mist-bright" : "text-mist-dim line-through"}`}>{rule.name}</span>
                    <Badge tone="cyan">{CONDITION_LABELS[rule.condition]}</Badge>
                    {rule.threshold > 0 && <Badge>${rule.threshold.toLocaleString()}</Badge>}
                    <Badge>{rule.channel === "webhook" ? "webhook" : "in-app"}</Badge>
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        onClick={() => toggleRule(rule.id)}
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] ${rule.enabled ? "border-emerald-900/60 bg-emerald-950/40 text-emerald-300" : "border-ink-600 text-mist-dim"}`}
                        aria-label={rule.enabled ? "Disable rule" : "Enable rule"}
                      >
                        {rule.enabled ? "enabled" : "paused"}
                      </button>
                      <button onClick={() => removeRule(rule.id)} className="text-xs text-mist-dim hover:text-red-300" aria-label="Delete rule">
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mist-dim">
                    <Link href={`/investigate/${rule.target}`} className="font-mono text-cyan-300 hover:underline">
                      {rule.targetLabel ?? subject.label ?? shortAddress(rule.target)}
                    </Link>
                    <RiskBadge level={subject.riskLevel} small />
                    {rule.channel === "webhook" && rule.webhookUrl && (
                      <span className="truncate font-mono text-[10px]">{rule.webhookUrl}</span>
                    )}
                  </div>
                </div>
              );
            })}
            {alertRules.length === 0 && <p className="text-sm text-mist">No rules yet — create one on the right.</p>}
          </div>
        </Panel>

        <Panel>
          <SectionHeader
            title="Triggered events"
            sub="Latest evaluation per enabled rule"
            action={<button onClick={() => visibleEvents.forEach((e) => dismissEvent(e.id))} className="text-xs text-mist-dim hover:text-mist-bright">Dismiss all</button>}
          />
          <div className="space-y-2">
            {visibleEvents.length === 0 ? (
              <p className="text-sm text-mist">No events from enabled rules.</p>
            ) : (
              visibleEvents.map((e) => (
                <div key={e.id} className="flex items-start justify-between gap-3 rounded-lg border border-ink-700 bg-ink-800/50 px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <RiskBadge level={e.severity as RiskLevel} small />
                      <span className="text-sm text-mist-bright">{e.ruleName}</span>
                    </div>
                    <p className="mt-1 text-xs text-mist">{e.message}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-mist-dim">{e.timestamp.slice(0, 16).replace("T", " ")} UTC</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Link href={`/investigate/${e.subject}`} className="text-xs text-cyan-300 hover:underline">Investigate</Link>
                    <button onClick={() => dismissEvent(e.id)} className="text-xs text-mist-dim hover:text-mist-bright">Dismiss</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      <Panel className="lg:col-span-2">
        <SectionHeader title="New rule" sub="Workflow: rule → evaluate → notify / investigate" />
        <div className="space-y-4">
          <div>
            <label htmlFor="rule-name" className="label-mono">Name</label>
            <input id="rule-name" className="input mt-1.5" placeholder="Treasury outflow guard" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="rule-target" className="label-mono">Target address</label>
            <input
              id="rule-target"
              className={`input mt-1.5 font-mono ${target && !targetValid ? "!border-red-800" : ""}`}
              placeholder="0x…"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="rule-cond" className="label-mono">Condition</label>
            <select id="rule-cond" className="input mt-1.5" value={condition} onChange={(e) => setCondition(e.target.value as AlertCondition)}>
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>{CONDITION_LABELS[c]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rule-threshold" className="label-mono">Threshold</label>
            <input
              id="rule-threshold"
              className="input mt-1.5 font-mono"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              disabled={condition === "flagged-counterparty" || condition === "new-contract-interaction"}
            />
          </div>
          <div>
            <label htmlFor="rule-channel" className="label-mono">Channel</label>
            <select id="rule-channel" className="input mt-1.5" value={channel} onChange={(e) => setChannel(e.target.value as "in-app" | "webhook")}>
              <option value="in-app">In-app feed</option>
              <option value="webhook">Webhook (POST JSON)</option>
            </select>
          </div>
          {channel === "webhook" && (
            <div>
              <label htmlFor="rule-hook" className="label-mono">Webhook URL</label>
              <input id="rule-hook" className="input mt-1.5 font-mono text-xs" placeholder="https://hooks.example.internal/…" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} />
            </div>
          )}
          <button className="btn-primary w-full" disabled={!canCreate} onClick={create}>
            Create rule
          </button>
          <p className="text-[11px] leading-relaxed text-mist-dim">
            Rules run deterministically against the indexed dataset. In production, evaluations subscribe to live indexer streams and deliver via the configured channel.
          </p>
        </div>
      </Panel>
    </div>
  );
}
