/** Coalesce queued room updates and cap Canvas rendering; stale textures never reach a new binding. */
export class WardCorridorScreenCache {
  private entries = new Map<string, { signature: string; expiresAt: number }>();
  private pending = new Map<string, { run(): Promise<void>; cancel(): void }>();
  private active = 0;
  private readonly ttlMs: number;
  private readonly now: () => number;
  readonly stats = { rendered: 0, skipped: 0, discarded: 0 };

  constructor(options: { ttlMs?: number; now?: () => number } = {}) {
    this.ttlMs = options.ttlMs ?? Number.POSITIVE_INFINITY;
    this.now = options.now ?? Date.now;
  }

  clear() {
    this.entries.clear();
    for (const job of this.pending.values()) job.cancel();
    this.pending.clear();
  }

  update<T extends { dispose(): void }>(key: string, signature: string,
    render: () => Promise<T>, apply: (texture: T) => void): Promise<void> {
    const cached = this.entries.get(key);
    if (cached?.signature === signature && cached.expiresAt > this.now()) {
      this.stats.skipped++;
      return Promise.resolve();
    }
    // Queued and active work must finish before its refresh interval starts.
    const entry = { signature, expiresAt: Number.POSITIVE_INFINITY };
    this.entries.set(key, entry);
    this.pending.get(key)?.cancel();
    const result = new Promise<void>((resolve, reject) => {
      this.pending.set(key, {
        cancel: resolve,
        run: async () => {
          try {
            const texture = await render();
            if (this.entries.get(key) !== entry) {
              texture.dispose();
              this.stats.discarded++;
            }
            else {
              apply(texture);
              entry.expiresAt = this.now() + this.ttlMs;
              this.stats.rendered++;
            }
            resolve();
          }
          catch (error) {
            if (this.entries.get(key) === entry) {
              this.entries.delete(key);
              reject(error);
            }
            else resolve();
          }
        },
      });
    });
    this.pump();
    return result;
  }

  private pump() {
    while (this.active < 2 && this.pending.size) {
      const [key, job] = this.pending.entries().next().value!;
      this.pending.delete(key);
      this.active++;
      void job.run().finally(() => { this.active--; this.pump(); });
    }
  }
}
