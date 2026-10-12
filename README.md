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
- **Live on-chain layer** (`src/lib/atomic/onchain/`) — keyless JSON-RPC reads over public endpoints (multi-endpoint failover, timeouts, 60s stale-while-revalidate caches: expired entries are served instantly while a background refresh repopulates, so navigation never blocks on a re-probe): address classification, native balances, tx counts, ERC-20 metadata, EIP-1967 proxy detection, `owner()` reads, bytecode selector scans, ENS resolution, and EIP-55 checksums. Pin dedicated endpoints via `ATOMIC_RPC_<CHAIN>` (see `.env.example`) or set `ATOMIC_DISABLE_LIVE=1` for offline runs.
- **Live ERC-20 enrichment** (`src/lib/atomic/onchain/erc20.ts`) — real token positions (`balanceOf` over the chain's pinned token list) and a recent transfer log (ERC-20 `Transfer` events decoded from `eth_getLogs` over a bounded block window), no indexer required. Built-in chains ship with a curated major-token list; operators pin their own via the `tokens` config field, and the window is operator-tunable via `ATOMIC_TRANSFER_BLOCKS`. Both surfaces degrade to null on chains whose RPC rejects the calls — the UI labels live rows, keeps the deterministic tables separate, and renders an honest note when no live rows are available.
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
#   tokens             → ERC-20 contracts probed for live balances and
#                        transfer logs on this chain (built-ins ship with
#                        a curated major-token list; a config entry
#                        replaces it). symbol/decimals are optional —
#                        unknown values are read live from the contract.
#
#   "tokens": [
#     { "address": "0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4", "symbol": "USDC.e", "decimals": 6 }
#   ]
```

**Hot reload without a restart.** Environment variables are frozen once a process starts (an OS-level constraint — changing them means restarting), so for live changes point `ATOMIC_CHAINS_FILE` at a JSON file with the same schema as `ATOMIC_CHAINS`:

```bash
ATOMIC_CHAINS_FILE=/etc/atomic/chains.json
```

ATOMIC watches the file's directory via `fs.watch` (inotify) — this catches atomic editor saves (write-temp-then-rename) too — and additionally re-checks mtime/size per request (1s throttle) as a fallback for filesystems where watch is unavailable. Whichever lands first, an edit re-applies the registry on the spot: env layers first, file entries last (the file wins), and the RPC/health/fact caches are reset so stale endpoints are never reused. Removing the file reverts to env-only configuration; an unparseable file is skipped with a warning and the previous configuration stays active. Registry consumers (pages, security probes, intent targets, typed-data chain ids, the public API) pick the change up immediately; `/integrations` shows the reloaded chains with live health.

Rules enforced by the registry (`src/lib/atomic/chains.ts`):

- **EIP-155 uniqueness** — two chains cannot claim the same `evmChainId`; typed-data signatures are bound to the real chain id, so a collision would mean mis-signed intents. Colliding entries are dropped with a warning.
- **Fail-safe startup** — invalid entries (bad id, missing fields, unusable endpoints) are skipped with a warning; a config typo can never take the platform down. Warnings appear in server logs, on `/integrations`, and via the API.
- **Honest provenance** — the active registry (with source `builtin`/`config`, endpoint counts, override flags, and per-chain health) is machine-readable at `GET /api/v1/chains`. Raw endpoint URLs are never exposed — they routinely embed provider keys.
- **Deterministic demo plane** — engine-sampled profiles draw from the active registry, so operator-added chains participate in entity profiles, holdings, activity, portfolio exposure, and alert evaluation like any built-in. The registry is passed from server surfaces into client consoles as props, so server/client rendering stays identical no matter which chains operators configure; the browser fallback (standalone component use) is the built-in set. Added chains work for live reads, security probes, health, intent targets, and ERC-20 balance/transfer enrichment immediately — pin their token contracts with the `tokens` field.

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
