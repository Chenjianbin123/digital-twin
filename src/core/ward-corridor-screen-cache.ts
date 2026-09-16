/** Coalesce queued room updates and cap Canvas rendering; stale textures never reach a new binding. */
export class WardCorridorScreenCache {
  private entries = new Map<string, { signature: string }>();
  private pending = new Map<string, { run(): Promise<void>; cancel(): void }>();
  private active = 0;
  readonly stats = { rendered: 0, skipped: 0, discarded: 0 };

  clear() {
    this.entries.clear();
    for (const job of this.pending.values()) job.cancel();
    this.pending.clear();
  }

  update<T extends { dispose(): void }>(key: string, signature: string,
    render: () => Promise<T>, apply: (texture: T) => void): Promise<void> {
    if (this.entries.get(key)?.signature === signature) {
      this.stats.skipped++;
      return Promise.resolve();
    }
    const entry = { signature };
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
