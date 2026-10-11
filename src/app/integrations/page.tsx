import { CHAIN_LIST, CHAIN_WARNINGS } from "@/lib/atomic/chains";
import { chainHealth, liveEnabled } from "@/lib/atomic/onchain/rpc";
import { Badge, PageHeader, Panel, SectionHeader } from "@/components/ui";
import { IntegrationToggle } from "@/components/integrations/toggle";

export const metadata = { title: "Integrations" };

export const dynamic = "force-dynamic";

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
  { method: "GET", path: "/api/v1/health", desc: "Service heartbeat + primary chain probe" },
  { method: "GET", path: "/api/v1/chains", desc: "Configured chain registry (adds, patches, EIP-155 ids)" },
  { method: "GET", path: "/api/v1/tokens", desc: "Token catalog (demo snapshot)" },
  { method: "GET", path: "/api/v1/entities/{address}", desc: "Entity profile, holdings, relationships" },
  { method: "GET", path: "/api/v1/security/{address}", desc: "Deterministic security report" },
  { method: "POST", path: "/api/v1/intents/scan", desc: "Pre-flight scan of intent parameters" },
];

const ADD_CHAIN_SNIPPET = `ATOMIC_CHAINS='[{
  "id": "zksync-era",
  "name": "zkSync Era",
  "evmChainId": 324,
  "nativeSymbol": "ETH",
  "rpc": ["https://mainnet.era.zksync.io"],
  "explorer": "https://explorer.zksync.io"
}]'`;

export default async function IntegrationsPage() {
  // Health for every configured chain, probed in parallel (30s cache).
  const liveChains = CHAIN_LIST.filter((c) => c.live);
  const health = liveEnabled()
    ? await Promise.all(liveChains.map((c) => chainHealth(c.id)))
    : [];
  const healthById = new Map(health.map((h) => [h.chain, h]));

  return (
    <div>
      <PageHeader
        eyebrow="Operations · Integrations"
        title="Providers, agents & API surface"
        sub="The platform ships with a deterministic demo data plane. Bind live providers here — the engine consumes the same interfaces, so checks and reports remain auditable either way."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <SectionHeader
            title="Chains"
            sub={`${CHAIN_LIST.length} configured networks · EIP-155 ids enforced unique · endpoint failover per chain`}
          />
          <div className="space-y-2">
            {CHAIN_LIST.map((c) => {
              const h = healthById.get(c.id);
              return (
                <div key={c.id} className="rounded-lg border border-ink-700 bg-ink-800/50 px-4 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.color }} />
                      <span className="truncate text-sm text-mist-bright">{c.name}</span>
                      <span className="shrink-0 font-mono text-[10px] text-mist-dim">chain {c.evmChainId}</span>
                      {c.source === "config" && <Badge tone="cyan">config</Badge>}
                      {!c.live && <Badge tone="amber">demo-only</Badge>}
                    </div>
                    {c.live && h && (
                      h.reachable ? (
                        <Badge tone="green">#{h.blockNumber?.toLocaleString()}</Badge>
                      ) : (
                        <Badge tone="red">rpc unreachable</Badge>
                      )
                    )}
                    {c.live && !h && <Badge tone="amber">live reads off</Badge>}
                    {!c.live && <Badge>off</Badge>}
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-mist-dim">
                    {c.rpc.length} endpoint{c.rpc.length === 1 ? "" : "s"} {c.rpcOverridden ? "· operator override" : "· public defaults"}
                    {h?.checkedAt ? ` · probed ${h.checkedAt.slice(11, 19)}Z` : ""}
                  </p>
                </div>
              );
            })}
          </div>
          {CHAIN_WARNINGS.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-900/60 bg-amber-950/20 px-4 py-3">
              <p className="text-xs font-medium text-amber-300">{CHAIN_WARNINGS.length} chain config warning{CHAIN_WARNINGS.length > 1 ? "s" : ""}</p>
              <ul className="mt-1 space-y-0.5">
                {CHAIN_WARNINGS.map((w, i) => (
                  <li key={i} className="font-mono text-[11px] text-amber-200/80">{w}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-4 border-t border-ink-700 pt-4">
            <SectionHeader title="Add a chain" sub="Registry changes are environment config — no code changes" />
            <pre className="overflow-auto rounded-lg border border-ink-700 bg-ink-900 px-4 py-3 font-mono text-[11px] leading-relaxed text-mist">{ADD_CHAIN_SNIPPET}</pre>
            <p className="mt-2 text-[11px] leading-relaxed text-mist-dim">
              New ids append a network; existing ids patch the built-in. ATOMIC_RPC_&lt;ID&gt; replaces endpoints (comma-separated), ATOMIC_CHAINS_DISABLED removes entries. See the README for the full schema.
            </p>
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
