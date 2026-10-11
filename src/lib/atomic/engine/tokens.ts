import type { TokenMeta } from "../types";
import { Rng, seededHex } from "./prng";

/**
 * Curated catalog of well-known assets used by the demo data plane.
 * Prices are static snapshots (anchor date) — live deployments bind a
 * market-data provider. `demo: true` marks synthetic project tokens used
 * for tokenomics/vesting analysis; they are not ATOMIC assets and carry
 * no value.
 */
const CATALOG: Omit<TokenMeta, "address">[] = [
  { symbol: "USDC", name: "USD Coin", chain: "ethereum", decimals: 6, priceUsd: 1.0, change24h: 0.01, marketCapUsd: 44.2e9, holders: 6_140_000, liquidityUsd: 890e6, category: "stable", demo: false },
  { symbol: "USDT", name: "Tether USD", chain: "ethereum", decimals: 6, priceUsd: 1.0, change24h: -0.02, marketCapUsd: 120e9, holders: 7_020_000, liquidityUsd: 1_240e6, category: "stable", demo: false },
  { symbol: "WETH", name: "Wrapped Ether", chain: "ethereum", decimals: 18, priceUsd: 3985.42, change24h: 2.4, marketCapUsd: 68.5e9, holders: 3_050_000, liquidityUsd: 640e6, category: "major", demo: false },
  { symbol: "stETH", name: "Lido Staked Ether", chain: "ethereum", decimals: 18, priceUsd: 3981.1, change24h: 2.3, marketCapUsd: 33.9e9, holders: 128_400, liquidityUsd: 92e6, category: "defi", demo: false },
  { symbol: "WBTC", name: "Wrapped Bitcoin", chain: "ethereum", decimals: 8, priceUsd: 103_240.0, change24h: 1.1, marketCapUsd: 15.8e9, holders: 96_700, liquidityUsd: 48e6, category: "major", demo: false },
  { symbol: "UNI", name: "Uniswap", chain: "ethereum", decimals: 18, priceUsd: 14.62, change24h: -1.8, marketCapUsd: 8.8e9, holders: 382_000, liquidityUsd: 61e6, category: "governance", demo: false },
  { symbol: "AAVE", name: "Aave", chain: "ethereum", decimals: 18, priceUsd: 296.85, change24h: 4.2, marketCapUsd: 4.4e9, holders: 141_500, liquidityUsd: 38e6, category: "defi", demo: false },
  { symbol: "LINK", name: "Chainlink", chain: "ethereum", decimals: 18, priceUsd: 28.41, change24h: 3.0, marketCapUsd: 18.2e9, holders: 704_000, liquidityUsd: 84e6, category: "defi", demo: false },
  { symbol: "PEPE", name: "Pepe", chain: "ethereum", decimals: 18, priceUsd: 0.0000121, change24h: -6.4, marketCapUsd: 5.1e9, holders: 1_420_000, liquidityUsd: 31e6, category: "meme", demo: false },
  { symbol: "ARB", name: "Arbitrum", chain: "arbitrum", decimals: 18, priceUsd: 1.06, change24h: -2.2, marketCapUsd: 4.7e9, holders: 618_000, liquidityUsd: 44e6, category: "governance", demo: false },
  { symbol: "OP", name: "Optimism", chain: "optimism", decimals: 18, priceUsd: 1.78, change24h: 1.6, marketCapUsd: 3.1e9, holders: 402_000, liquidityUsd: 29e6, category: "governance", demo: false },
  { symbol: "USDbC", name: "Base USD Coin", chain: "base", decimals: 6, priceUsd: 1.0, change24h: 0.0, marketCapUsd: 180e6, holders: 210_000, liquidityUsd: 42e6, category: "stable", demo: false },
  { symbol: "AERO", name: "Aerodrome", chain: "base", decimals: 18, priceUsd: 1.34, change24h: 5.1, marketCapUsd: 1.1e9, holders: 88_400, liquidityUsd: 24e6, category: "defi", demo: false },
  { symbol: "CAKE", name: "PancakeSwap", chain: "bnb", decimals: 18, priceUsd: 2.64, change24h: -0.9, marketCapUsd: 760e6, holders: 1_910_000, liquidityUsd: 19e6, category: "defi", demo: false },
  { symbol: "JOE", name: "Trader Joe", chain: "avalanche", decimals: 18, priceUsd: 0.42, change24h: 2.9, marketCapUsd: 160e6, holders: 74_200, liquidityUsd: 8.4e6, category: "defi", demo: false },
  { symbol: "SAND", name: "The Sandbox", chain: "polygon", decimals: 18, priceUsd: 0.38, change24h: -3.1, marketCapUsd: 920e6, holders: 580_000, liquidityUsd: 12e6, category: "major", demo: false },
  { symbol: "NEXA", name: "Nexa Protocol (demo)", chain: "ethereum", decimals: 18, priceUsd: 2.14, change24h: 7.8, marketCapUsd: 214e6, holders: 41_300, liquidityUsd: 6.2e6, category: "project", demo: true },
  { symbol: "HELIX", name: "Helix Network (demo)", chain: "base", decimals: 18, priceUsd: 0.87, change24h: -4.6, marketCapUsd: 87e6, holders: 18_900, liquidityUsd: 2.1e6, category: "project", demo: true },
];

export const TOKENS: TokenMeta[] = CATALOG.map((t) => ({
  ...t,
  address: t.symbol === "WETH"
    ? "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
    : t.symbol === "USDC"
      ? "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
      : t.symbol === "USDT"
        ? "0xdac17f958d2ee523a2206206994597c13d831ec7"
        : `0x${seededHex(`token:${t.symbol}`, 40)}`,
}));

export const TOKEN_BY_SYMBOL: Record<string, TokenMeta> = Object.fromEntries(
  TOKENS.map((t) => [t.symbol, t]),
);

export function tokenBySymbol(symbol: string): TokenMeta | undefined {
  return TOKEN_BY_SYMBOL[symbol.toUpperCase()];
}

export function tokenByAddress(address: string): TokenMeta | undefined {
  const lower = address.toLowerCase();
  return TOKENS.find((t) => t.address.toLowerCase() === lower);
}

/** Deterministic price series (30d) for sparklines — a smooth random walk. */
export function priceSeries(symbol: string, days = 30, anchorPrice?: number): number[] {
  const meta = tokenBySymbol(symbol);
  const end = anchorPrice ?? meta?.priceUsd ?? 100;
  const rng = new Rng(`series:${symbol}:${days}`);
  const drift = ((meta?.change24h ?? 0) / 100) / 30;
  const series: number[] = [];
  let price = end;
  const back: number[] = [price];
  for (let i = 0; i < days - 1; i++) {
    const shock = (rng.float() - 0.5) * 0.055;
    price = price / (1 + drift + shock);
    back.push(price);
  }
  for (let i = back.length - 1; i >= 0; i--) series.push(back[i]);
  return series;
}

export function trendingTokens(count = 6): TokenMeta[] {
  const rng = new Rng("trending:v1");
  return rng.sample(TOKENS.filter((t) => !t.demo), count).sort(
    (a, b) => Math.abs(b.change24h) - Math.abs(a.change24h),
  );
}
