"use client";

import { useWorkspace } from "@/lib/atomic/workspace";
import { Badge } from "@/components/ui";

export function IntegrationToggle({ id }: { id: string }) {
  const { integrations, toggleIntegration, hydrated } = useWorkspace();
  const enabled = hydrated && !!integrations[id];
  return (
    <button
      onClick={() => toggleIntegration(id)}
      className={`rounded-full border px-3 py-1 text-[11px] font-mono transition-colors ${
        enabled
          ? "border-emerald-900/60 bg-emerald-950/40 text-emerald-300"
          : "border-ink-600 bg-ink-800 text-mist-dim hover:text-mist-bright"
      }`}
      aria-pressed={enabled}
      aria-label={enabled ? "Disable connector" : "Enable connector"}
    >
      {enabled ? "enabled" : "connect"}
    </button>
  );
}

export function IntegrationStateBadge({ id }: { id: string }) {
  const { integrations, hydrated } = useWorkspace();
  if (!hydrated) return null;
  return integrations[id] ? <Badge tone="green">bound</Badge> : null;
}
