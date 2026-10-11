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
- **Deterministic data plane** (`src/lib/atomic/engine/`) — every profile, transaction, graph, and report is derived from stable seeds, so results are identical across renders and runs. The demo dataset needs no external APIs; live deployments bind the same interfaces to real indexers (see `/integrations`).
- **Security engine** (`src/lib/atomic/security/`) — fixed, explainable rules with evidence on every check. No model calls in the scoring path.
- **Analyst engine** (`src/lib/atomic/analyst/`) — findings derived from the investigation dataset; an LLM provider may only rephrase, never invent findings.
- **Workspace state** (`src/lib/atomic/workspace.tsx`) — watchlist, alert rules, staged intents, and integration toggles persist to `localStorage`.

## Principles

- **Non-custodial by design.** Actions are prepared as signable EIP-712 intents and executed in the user's own wallet. ATOMIC holds no keys and broadcasts nothing.
- **Deterministic security checks.** Every pass/warn/fail links to evidence; the same input always yields the same report.
- **No platform token.** ATOMIC introduces no token. Synthetic demo tokens used for vesting analysis are clearly marked.

## Public API (v1)

```
GET  /api/v1/health
GET  /api/v1/tokens
GET  /api/v1/entities/{address}
GET  /api/v1/security/{address}
POST /api/v1/intents/scan
```

Read-only except intent scanning — agents can consume intelligence but never transact through ATOMIC.

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
