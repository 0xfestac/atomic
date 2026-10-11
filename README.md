# ATOMIC

**ATOMIC** is a production-grade, multi-chain Web3 intelligence and operations platform. It follows one cohesive workflow:

**Discover → Investigate → Verify → Explain → Act**

## Capabilities

| Area | What it does |
| --- | --- |
| Discover (`/`) | Multi-chain overview: chain status, trending assets, alerts feed, registry watch |
| Investigate (`/investigate`) | Any EVM address resolves to a profile: holdings, decoded activity, relationship graph, risk flags |
| Tokenomics (`/tokenomics`) | Supply, allocation, holder concentration, and cliff/linear vesting schedules with unlock overhang |
| Security (`/security`) | Deterministic, explainable contract & behavioral checks (source, ownership, mint, honeypot heuristic, liquidity locks, registries) |
| Explain | Rule-based analyst reports with findings, evidence, and confidence — every conclusion is auditable |
| Act (`/intents`) | Intent-based transaction preparation: compile, pre-flight scan, review, explicit approval. Non-custodial — ATOMIC never holds keys or broadcasts |
| Portfolio (`/portfolio`) | Cross-chain holdings, chain exposure, NFT and treasury monitoring |
| Alerts (`/alerts`) | Monitoring rules and research workflows routed to in-app feed or webhook |
| Integrations (`/integrations`) | Pluggable data providers, AI-agent extensions, and the public v1 API |

## Architecture

- **Next.js 15 (App Router) + TypeScript + Tailwind** — server components stream engine data; client components own workspace state.
- **Live on-chain layer** (`src/lib/atomic/onchain/`) — keyless JSON-RPC reads over public endpoints (multi-endpoint failover, timeouts, 60s fact cache): address classification, native balances, tx counts, ERC-20 metadata, EIP-1967 proxy detection, `owner()` reads, bytecode selector scans, ENS resolution, and EIP-55 checksums. Pin dedicated endpoints via `ATOMIC_RPC_<CHAIN>` (see `.env.example`) or set `ATOMIC_DISABLE_LIVE=1` for offline runs.
- **Deterministic data plane** (`src/lib/atomic/engine/`) — every profile, transaction, graph, and report is derived from stable seeds, so results are identical across renders and runs. When live reads succeed they upgrade the view with real chain evidence; when they fail the UI says so and falls back to the demo plane. Live deployments can bind the same interfaces to full indexers (see `/integrations`).
- **Security engine** (`src/lib/atomic/security/`) — fixed, explainable rules with evidence on every check, labeled `onchain` (live RPC evidence) or `heuristic` (deterministic demo plane). No model calls in the scoring path.
- **Analyst engine** (`src/lib/atomic/analyst/`) — findings derived from the investigation dataset; an LLM provider may only rephrase, never invent findings.
- **Workspace state** (`src/lib/atomic/workspace.tsx`) — watchlist, alert rules, staged intents, and integration toggles persist to `localStorage`.
- **API hardening** (`src/lib/atomic/api/`) — per-IP sliding-window rate limiting, strict input validation, bounded JSON bodies, and uniform `no-store` error responses on every public route.

## Principles

- **Non-custodial by design.** Actions are prepared as signable EIP-712 intents and executed in the user's own wallet. ATOMIC holds no keys and broadcasts nothing.
- **Deterministic security checks.** Every pass/warn/fail links to evidence and its provenance (`onchain` vs `heuristic`); the same input always yields the same report.
- **No platform token.** ATOMIC introduces no token. Synthetic demo tokens used for vesting analysis are clearly marked.

## Configuring chains

Networks are **configuration, not code**. The registry ships with seven built-in EVM chains (Ethereum, Base, Arbitrum One, OP Mainnet, Polygon PoS, BNB Chain, Avalanche) and operators extend it at startup via environment variables — no code changes, no redeploy of logic:

```bash
# Add a network (new id) or patch a built-in (existing id) — JSON array.
# Required for new chains: id, name, evmChainId, nativeSymbol, rpc.
ATOMIC_CHAINS='[{
  "id": "zksync-era",
  "name": "zkSync Era",
  "evmChainId": 324,
  "nativeSymbol": "ETH",
  "rpc": ["https://mainnet.era.zksync.io", "https://rpc.ankr.com/zksync_era"],
  "explorer": "https://explorer.zksync.io",
  "short": "ZK",
  "color": "#8c8dfc"
}]'

# Replace endpoints per chain — comma-separated for failover.
# Dashes in ids map to underscores: "zksync-era" → ATOMIC_RPC_ZKSYNC_ERA
ATOMIC_RPC_ETHEREUM=https://your-node.example.com/v3/key
ATOMIC_RPC_ZKSYNC_ERA=https://primary.example.com,https://backup.example.com

# Remove chains (comma-separated ids)
ATOMIC_CHAINS_DISABLED=avalanche

# Optional per-chain flags in ATOMIC_CHAINS entries:
#   live: false        → demo-plane only; ATOMIC never dials the chain
#   avgGasGwei, finalitySec, short, color
```

Rules enforced by the registry (`src/lib/atomic/chains.ts`):

- **EIP-155 uniqueness** — two chains cannot claim the same `evmChainId`; typed-data signatures are bound to the real chain id, so a collision would mean mis-signed intents. Colliding entries are dropped with a warning.
- **Fail-safe startup** — invalid entries (bad id, missing fields, unusable endpoints) are skipped with a warning; a config typo can never take the platform down. Warnings appear in server logs, on `/integrations`, and via the API.
- **Honest provenance** — the active registry (with source `builtin`/`config`, endpoint counts, override flags, and per-chain health) is machine-readable at `GET /api/v1/chains`. Raw endpoint URLs are never exposed — they routinely embed provider keys.
- **Deterministic demo plane** — engine-sampled profiles always use the built-in chain set, so server/client rendering stays identical no matter which chains operators add. Added chains work for live reads, security probes, health, and intent targets immediately.

## Public API (v1)

```
GET  /api/v1/health
GET  /api/v1/chains
GET  /api/v1/tokens
GET  /api/v1/entities/{address}
GET  /api/v1/security/{address}
GET  /api/v1/resolve?name=vitalik.eth
POST /api/v1/intents/scan
```

Read-only except intent scanning — agents can consume intelligence but never transact through ATOMIC. All routes are rate limited (default 120 req/min/IP, `Retry-After` on 429) and return `cache-control: no-store`.

## Production deployment

1. `pnpm install && pnpm build && pnpm start` (or deploy to any Node host / Vercel).
2. Configure your chain registry — set `ATOMIC_RPC_<CHAIN>` to dedicated endpoints (Alchemy, Infura, self-hosted; public endpoints are rate limited by their operators) and add networks with `ATOMIC_CHAINS` (see [Configuring chains](#configuring-chains)).
3. Optionally tune `ATOMIC_RATE_LIMIT_RPM`.
4. Front the app with HTTPS; security headers (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP) are set by `next.config.ts`.

## Development

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm lint       # eslint
pnpm typecheck  # tsc --noEmit
pnpm test       # vitest
pnpm build      # production build
```

Package scope is `@atomic/platform`. All branding, metadata, and logs use **ATOMIC** consistently.
