/**
 * Chain identifiers are configuration-driven: operators add or patch
 * networks via ATOMIC_CHAINS without code changes, so ChainId is an
 * opaque slug ("ethereum", "zksync-era", …) resolved through the
 * registry in lib/atomic/chains.ts.
 */
export type ChainId = string;

export interface Chain {
  id: ChainId;
  name: string;
  short: string;
  color: string;
  /** EIP-155 chain id — binds typed-data signatures to the target network */
  evmChainId: number;
  /** explorer base URL, or null when the network has none configured */
  explorer: string | null;
  nativeSymbol: string;
  /** ordered JSON-RPC endpoints; the first reachable endpoint serves reads */
  rpc: string[];
  /** false → demo-plane only: the platform never dials this chain */
  live: boolean;
  avgGasGwei: number;
  finalitySec: number;
  /** builtin = ships with the platform; config = operator-supplied */
  source: "builtin" | "config";
  /** true when ATOMIC_RPC_<ID> replaced the default endpoint list */
  rpcOverridden: boolean;
}

export type EntityType = "wallet" | "contract" | "token";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface EntitySummary {
  address: string;
  label: string | null;
  type: EntityType;
  chains: ChainId[];
  firstSeen: string;
  lastActive: string;
  txCount: number;
  volumeUsd: number;
  riskScore: number;
  riskLevel: RiskLevel;
  riskFlags: RiskFlag[];
  balanceUsd: number;
}

export interface RiskFlag {
  id: string;
  label: string;
  level: RiskLevel;
  detail: string;
}

export interface TokenHolding {
  token: string;
  symbol: string;
  chain: ChainId;
  amount: number;
  priceUsd: number;
  valueUsd: number;
  change24h: number;
}

export interface TxRecord {
  hash: string;
  chain: ChainId;
  type: "send" | "receive" | "swap" | "approve" | "contract";
  token: string;
  symbol: string;
  amount: number;
  valueUsd: number;
  counterparty: string;
  counterpartyLabel: string | null;
  timestamp: string;
  status: "success" | "failed";
  gasUsd: number;
}

export interface RelationshipEdge {
  node: string;
  label: string | null;
  type: EntityType;
  weight: number;
  volumeUsd: number;
  txCount: number;
  firstInteraction: string;
  riskLevel: RiskLevel;
}

export interface RelationshipGraph {
  root: string;
  edges: RelationshipEdge[];
  clusters: { id: string; label: string; members: string[] }[];
}

export interface TokenMeta {
  symbol: string;
  name: string;
  chain: ChainId;
  address: string;
  decimals: number;
  priceUsd: number;
  change24h: number;
  marketCapUsd: number;
  holders: number;
  liquidityUsd: number;
  category: "stable" | "major" | "defi" | "governance" | "meme" | "project";
  demo: boolean;
}

export interface SecurityCheck {
  id: string;
  title: string;
  category: "contract" | "economy" | "ownership" | "liquidity" | "behavior";
  status: "pass" | "warn" | "fail" | "info";
  severityIfFail: RiskLevel;
  detail: string;
  evidence: string;
  /** onchain = evaluated against live RPC reads; heuristic = deterministic demo plane */
  source?: "onchain" | "heuristic";
}

export interface SecurityReport {
  subject: string;
  subjectLabel: string | null;
  grade: "A" | "B" | "C" | "D" | "F";
  score: number;
  checks: SecurityCheck[];
  generatedAt: string;
  /** chains with live on-chain reads backing this report, when any */
  liveChains?: string[];
}

export interface Finding {
  id: string;
  severity: RiskLevel;
  title: string;
  detail: string;
  evidence: string[];
}

export interface AnalystReport {
  subject: string;
  headline: string;
  narrative: string[];
  findings: Finding[];
  confidence: number;
  sources: string[];
  generatedAt: string;
}

export interface VestingTranche {
  bucket: string;
  sharePct: number;
  tgeUnlockPct: number;
  cliffMonths: number;
  linearMonths: number;
}

export interface VestingPoint {
  month: number;
  date: string;
  circulatingPct: number;
}

export interface TokenomicsProfile {
  symbol: string;
  name: string;
  totalSupply: number;
  circulatingPct: number;
  allocation: VestingTranche[];
  schedule: VestingPoint[];
  tgeDate: string;
  holders: { rank: number; label: string | null; address: string; sharePct: number; kind: string }[];
  concentration: { top10Pct: number; giniHint: string };
  unlockOverhangPct: number;
}

export type IntentKind = "swap" | "transfer" | "approve" | "contract-call";

export interface IntentSpec {
  kind: IntentKind;
  chain: ChainId;
  from: string;
  to: string;
  inputToken?: string;
  outputToken?: string;
  amount?: number;
  slippagePct?: number;
  data?: string;
  memo?: string;
}

export interface StagedIntent {
  id: string;
  kind: IntentKind;
  chain: ChainId;
  createdAt: string;
  typedData: Record<string, unknown>;
  summary: string;
  securityScore: number;
  securityNotes: { status: "pass" | "warn" | "fail"; text: string }[];
  state: "review" | "approved" | "discarded";
}

export type AlertCondition =
  | "risk-score-above"
  | "transfer-above-usd"
  | "new-contract-interaction"
  | "flagged-counterparty";

export interface AlertRule {
  id: string;
  name: string;
  target: string;
  targetLabel?: string;
  condition: AlertCondition;
  threshold: number;
  channel: "in-app" | "webhook";
  webhookUrl?: string;
  enabled: boolean;
}

export interface AlertEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  message: string;
  subject: string;
  severity: RiskLevel;
  timestamp: string;
}
