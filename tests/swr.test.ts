import { describe, expect, it, vi } from "vitest";
import { SwrCache } from "@/lib/atomic/onchain/swr";

describe("stale-while-revalidate cache", () => {
  it("loads once and serves fresh entries without reloading", async () => {
    const cache = new SwrCache<number>(1_000, 100);
    const load = vi.fn().mockResolvedValue(7);
    expect(await cache.get("k", load)).toBe(7);
    expect(await cache.get("k", load)).toBe(7);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("serves an expired entry immediately and refreshes in the background", async () => {
    vi.useFakeTimers();
    try {
      const cache = new SwrCache<number>(50, 100);
      let value = 1;
      expect(await cache.get("k", () => Promise.resolve(value))).toBe(1);
      vi.advanceTimersByTime(51); // entry is now past its TTL

      value = 2;
      let release!: (v: number) => void;
      const slow = new Promise<number>((r) => (release = r));
      // expired entry: must not block on the slow refresh
      expect(await cache.get("k", () => slow)).toBe(1);

      release(2);
      await vi.waitFor(() => expect(cache["inflight"].size).toBe(0));
      // refreshed value is served on the next read
      expect(await cache.get("k", () => Promise.resolve(3))).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("hands background refresh tasks to the injected scheduler", async () => {
    vi.useFakeTimers();
    try {
      const scheduled: Promise<number>[] = [];
      const cache = new SwrCache<number>(50, 100, (t) => scheduled.push(t));
      expect(await cache.get("k", () => Promise.resolve(1))).toBe(1);
      vi.advanceTimersByTime(51);

      // stale serve: the refresh runs through the scheduler (e.g. after())
      expect(await cache.get("k", () => Promise.resolve(2))).toBe(1);
      expect(scheduled).toHaveLength(1);
      await expect(scheduled[0]).resolves.toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("dedupes concurrent loads for one key", async () => {
    const cache = new SwrCache<number>(1_000, 100);
    let release!: (v: number) => void;
    const load = vi.fn(() => new Promise<number>((r) => (release = r)));
    const a = cache.get("k", load);
    const b = cache.get("k", load);
    release(9);
    expect(await a).toBe(9);
    expect(await b).toBe(9);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("keeps the stale value when the background refresh fails", async () => {
    vi.useFakeTimers();
    try {
      const cache = new SwrCache<number>(50, 100);
      expect(await cache.get("k", () => Promise.resolve(4))).toBe(4);
      vi.advanceTimersByTime(51);

      const refresh = cache.get("k", () => Promise.reject(new Error("rpc down")));
      expect(await refresh).toBe(4); // stale served, rejection swallowed
      await vi.waitFor(() => expect(cache["inflight"].size).toBe(0));

      // failed refresh leaves the entry stale: the next read retries
      expect(await cache.get("k", () => Promise.resolve(5))).toBe(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it("clear drops entries and in-flight loads", async () => {
    const cache = new SwrCache<number>(1_000, 100);
    let release!: (v: number) => void;
    const pending = cache.get("k", () => new Promise<number>((r) => (release = r)));
    cache.clear();
    release(1);
    await pending;
    const load = vi.fn().mockResolvedValue(6);
    expect(await cache.get("k", load)).toBe(6);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("evicts everything at capacity", async () => {
    const cache = new SwrCache<number>(1_000, 2);
    await cache.get("a", () => Promise.resolve(1));
    await cache.get("b", () => Promise.resolve(2));
    await cache.get("c", () => Promise.resolve(3));
    const load = vi.fn().mockResolvedValue(4);
    await cache.get("a", load); // evicted by the capacity flush
    expect(load).toHaveBeenCalledTimes(1);
  });
});
