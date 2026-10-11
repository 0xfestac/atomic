/**
 * Deterministic seeded pseudo-random utilities.
 *
 * The ATOMIC demo dataset is derived from stable string seeds (addresses,
 * symbols, hashes) so every render — server or client, today or next week —
 * produces identical values. No external APIs are required for the demo
 * data plane; production deployments bind the same interfaces to live
 * indexers (see /integrations).
 */

export const DATA_NOW = Date.UTC(2026, 9, 1, 12, 0, 0); // fixed analysis anchor

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  private next: () => number;

  constructor(seed: string) {
    this.next = mulberry32(xmur3(seed)());
  }

  float(): number {
    return this.next();
  }

  int(min: number, max: number): number {
    return Math.floor(this.float() * (max - min + 1)) + min;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.float() * items.length)];
  }

  sample<T>(items: readonly T[], count: number): T[] {
    const pool = [...items];
    const out: T[] = [];
    while (out.length < count && pool.length > 0) {
      out.push(pool.splice(Math.floor(this.float() * pool.length), 1)[0]);
    }
    return out;
  }

  /** Exponential-ish distribution around a log-uniform mean. */
  logScale(min: number, max: number): number {
    const t = this.float();
    return min * Math.pow(max / min, t);
  }

  chance(p: number): boolean {
    return this.float() < p;
  }
}

const HEX = "0123456789abcdef";

export function seededHex(seed: string, length: number): string {
  const rng = new Rng(seed);
  let out = "";
  for (let i = 0; i < length; i++) out += HEX[rng.int(0, 15)];
  return out;
}

export function shortAddress(address: string, size = 4): string {
  if (address.length <= size * 2 + 2) return address;
  return `${address.slice(0, size + 2)}…${address.slice(-size)}`;
}

export function isEvmAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value.trim());
}

export function formatUsd(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

export function formatAmount(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  if (abs >= 1) return value.toFixed(2);
  return value.toPrecision(3);
}

export function daysAgoIso(days: number, anchor = DATA_NOW): string {
  return new Date(anchor - days * 86400_000).toISOString();
}
