/**
 * Stale-while-revalidate cache for live RPC reads. Live probes (balances,
 * code, transfer-log scans) cost several round-trips, and a hard TTL makes
 * every navigation after expiry block on a full re-probe. Instead: fresh
 * entries return synchronously, expired entries return immediately (stale)
 * while a background refresh repopulates the cache, and concurrent loads
 * for one key are deduped. Only the very first load of a key can block.
 */
export class SwrCache<T> {
  private entries = new Map<string, { at: number; value: T }>();
  private inflight = new Map<string, Promise<T>>();
  /** Bumped by clear() so in-flight loads from before it never write back. */
  private generation = 0;

  constructor(
    readonly ttlMs: number,
    private readonly capacity: number,
  ) {}

  get(key: string, load: () => Promise<T>): Promise<T> {
    const cached = this.entries.get(key);
    if (cached && Date.now() - cached.at < this.ttlMs) return Promise.resolve(cached.value);
    const pending = this.inflight.get(key);
    if (pending) return cached ? Promise.resolve(cached.value) : pending;

    const generation = this.generation;
    const refreshed = load().then(
      (value) => {
        if (this.inflight.get(key) === refreshed) this.inflight.delete(key);
        if (generation === this.generation) {
          if (this.entries.size >= this.capacity) this.entries.clear();
          this.entries.set(key, { at: Date.now(), value });
        }
        return value;
      },
      (err: unknown) => {
        if (this.inflight.get(key) === refreshed) this.inflight.delete(key);
        throw err;
      },
    );
    this.inflight.set(key, refreshed);

    if (cached) {
      // Serve the stale value now; the refresh continues in the background.
      refreshed.catch(() => {});
      return Promise.resolve(cached.value);
    }
    return refreshed;
  }

  clear(): void {
    this.generation++;
    this.entries.clear();
    this.inflight.clear();
  }
}
