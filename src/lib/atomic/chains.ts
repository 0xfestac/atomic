import type { Chain, ChainId } from "./types";

export const CHAINS: Record<ChainId, Chain> = {
  ethereum: {
    id: "ethereum",
    name: "Ethereum",
    short: "ETH",
    color: "#8b9cf6",
    explorer: "https://etherscan.io",
    nativeSymbol: "ETH",
    avgGasGwei: 12.4,
    finalitySec: 780,
  },
  base: {
    id: "base",
    name: "Base",
    short: "BASE",
    color: "#3b82f6",
    explorer: "https://basescan.org",
    nativeSymbol: "ETH",
    avgGasGwei: 0.02,
    finalitySec: 132,
  },
  arbitrum: {
    id: "arbitrum",
    name: "Arbitrum One",
    short: "ARB",
    color: "#22d3ee",
    explorer: "https://arbiscan.io",
    nativeSymbol: "ETH",
    avgGasGwei: 0.1,
    finalitySec: 84,
  },
  optimism: {
    id: "optimism",
    name: "OP Mainnet",
    short: "OP",
    color: "#f87171",
    explorer: "https://optimistic.etherscan.io",
    nativeSymbol: "ETH",
    avgGasGwei: 0.01,
    finalitySec: 84,
  },
  polygon: {
    id: "polygon",
    name: "Polygon PoS",
    short: "POL",
    color: "#a78bfa",
    explorer: "https://polygonscan.com",
    nativeSymbol: "POL",
    avgGasGwei: 34,
    finalitySec: 32,
  },
  bnb: {
    id: "bnb",
    name: "BNB Chain",
    short: "BNB",
    color: "#fbbf24",
    explorer: "https://bscscan.com",
    nativeSymbol: "BNB",
    avgGasGwei: 3,
    finalitySec: 6,
  },
  avalanche: {
    id: "avalanche",
    name: "Avalanche C-Chain",
    short: "AVAX",
    color: "#e8734a",
    explorer: "https://snowtrace.io",
    nativeSymbol: "AVAX",
    avgGasGwei: 28,
    finalitySec: 2,
  },
};

export const CHAIN_LIST: Chain[] = Object.values(CHAINS);

export function chain(id: ChainId): Chain {
  return CHAINS[id];
}

export function isChainId(value: string): value is ChainId {
  return Object.prototype.hasOwnProperty.call(CHAINS, value);
}
