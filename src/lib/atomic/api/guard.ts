import { NextResponse } from "next/server";
import { isEvmAddress } from "../engine/prng";

/**
 * Public API hardening: per-IP sliding-window rate limiting, strict input
 * validation, and uniform JSON error responses that never leak internals.
 */

export interface RateLimitOptions {
  /** requests allowed per window */
  rpm: number;
  /** window length in ms */
  windowMs?: number;
}

interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

const buckets = new Map<string, number[]>();
const DEFAULT_WINDOW = 60_000;

function envRpm(fallback: number): number {
  const raw = Number(process.env.ATOMIC_RATE_LIMIT_RPM);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

export function rateLimit(key: string, options?: Partial<RateLimitOptions>, now = Date.now()): RateLimitResult {
  const rpm = options?.rpm ?? envRpm(120);
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW;
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= rpm) {
    const oldest = hits[0];
    buckets.set(key, hits);
    return { ok: false, remaining: 0, retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)) };
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5_000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
      if (buckets.size <= 2_500) break;
    }
  }
  return { ok: true, remaining: rpm - hits.length, retryAfterSec: 0 };
}

export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}

export function jsonError(message: string, status: number, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ error: message, ...extra }, { status, headers: NO_STORE });
}

export const NO_STORE = { "cache-control": "no-store" } as const;

export interface GuardedRequest {
  req: Request;
  rpm?: number;
  windowMs?: number;
}

/** Rate-limit gate for a route handler; returns a 429 response when exceeded. */
export function guardRequest(req: Request, rpm?: number): NextResponse | null {
  const result = rateLimit(`${new URL(req.url).pathname}:${clientKey(req)}`, { rpm: rpm ?? envRpm(120) });
  if (result.ok) return null;
  return NextResponse.json(
    { error: "rate limit exceeded" },
    { status: 429, headers: { ...NO_STORE, "retry-after": String(result.retryAfterSec) } },
  );
}

export function validAddress(value: unknown): value is string {
  return typeof value === "string" && isEvmAddress(value);
}

export function validChain(value: unknown, chains: string[]): value is string {
  return typeof value === "string" && chains.includes(value);
}

/** Read+parse a JSON body with a hard size cap. */
export async function readJsonBody(req: Request, maxBytes = 10_000): Promise<unknown> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) throw new BodyTooLarge();
  const text = await req.text();
  if (text.length > maxBytes) throw new BodyTooLarge();
  return JSON.parse(text);
}

export class BodyTooLarge extends Error {
  constructor() {
    super("body too large");
    this.name = "BodyTooLarge";
  }
}
