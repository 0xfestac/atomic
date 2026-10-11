import { CHAIN_LIST } from "@/lib/atomic/chains";
import { Badge, PageHeader, Panel, SectionHeader } from "@/components/ui";
import { IntegrationToggle } from "@/components/integrations/toggle";

export const metadata = { title: "Integrations" };

const DATA_PROVIDERS = [
  { id: "etherscan", name: "Etherscan / Explorers", desc: "Verified source, ABI, and receipt data per chain." },
  { id: "alchemy", name: "Alchemy / Indexers", desc: "Live balances, decoded logs, and graph streaming." },
  { id: "dune", name: "Dune Analytics", desc: "Bulk analytics queries for dashboard backfill." },
];

const AI_PROVIDERS = [
  { id: "llm-openai", name: "LLM: OpenAI-compatible", desc: "Optional narrative rephrasing on analyst reports. Findings and evidence stay rule-driven." },
  { id: "llm-local", name: "LLM: local inference", desc: "Self-hosted provider for air-gapped investigations." },
  { id: "mcp-agent", name: "MCP agent host", desc: "Expose ATOMIC read tools (entities, security, tokenomics) to MCP-compatible agents over the v1 API." },
];

const API_ENDPOINTS = [
  { method: "GET", path: "/api/v1/health", desc: "Service heartbeat" },
  { method: "GET", path: "/api/v1/tokens", desc: "Token catalog (demo snapshot)" },
  { method: "GET", path: "/api/v1/entities/{address}", desc: "Entity profile, holdings, relationships" },
  { method: "GET", path: "/api/v1/security/{address}", desc: "Deterministic security report" },
  { method: "POST", path: "/api/v1/intents/scan", desc: "Pre-flight scan of intent parameters" },
];

export default function IntegrationsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Operations · Integrations"
        title="Providers, agents & API surface"
        sub="The platform ships with a deterministic demo data plane. Bind live providers here — the engine consumes the same interfaces, so checks and reports remain auditable either way."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <SectionHeader title="Chains" sub="Indexed networks (always on)" />
          <div className="space-y-2">
            {CHAIN_LIST.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-ink-700 bg-ink-800/50 px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                  <span className="text-sm text-mist-bright">{c.name}</span>
                </div>
                <Badge tone="green">indexed</Badge>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <SectionHeader title="Data providers" sub="Bind live indexers & explorers" />
          <div className="space-y-2">
            {DATA_PROVIDERS.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-ink-700 bg-ink-800/50 px-4 py-2.5">
                <div>
                  <p className="text-sm text-mist-bright">{p.name}</p>
                  <p className="text-[11px] text-mist-dim">{p.desc}</p>
                </div>
                <IntegrationToggle id={p.id} />
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <SectionHeader title="AI agents" sub="Optional intelligence extensions" />
          <div className="space-y-2">
            {AI_PROVIDERS.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-ink-700 bg-ink-800/50 px-4 py-2.5">
                <div>
                  <p className="text-sm text-mist-bright">{p.name}</p>
                  <p className="text-[11px] text-mist-dim">{p.desc}</p>
                </div>
                <IntegrationToggle id={p.id} />
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <SectionHeader title="Public API (v1)" sub="Machine surface for agents & automation" />
          <div className="space-y-2">
            {API_ENDPOINTS.map((e) => (
              <div key={`${e.method}-${e.path}`} className="flex items-center gap-3 rounded-lg border border-ink-700 bg-ink-800/50 px-4 py-2.5">
                <span className={`w-12 shrink-0 rounded border px-1.5 py-0.5 text-center font-mono text-[10px] ${e.method === "GET" ? "border-cyan-900/60 text-cyan-300" : "border-violet-900/60 text-violet-300"}`}>
                  {e.method}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-mist-bright">{e.path}</p>
                  <p className="text-[11px] text-mist-dim">{e.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-mist-dim">
            Read-only except intent scanning — the API never broadcasts transactions and never holds keys.
          </p>
        </Panel>
      </div>
    </div>
  );
}
