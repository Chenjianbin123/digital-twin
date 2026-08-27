interface RetryablePromiseCacheOptions {
  ttlMs?: number;
  now?: () => number;
}

interface CacheEntry<V> {
  promise: Promise<V>;
  expiresAt: number;
}

export function createRetryablePromiseCache<K, V>(options: RetryablePromiseCacheOptions = {}) {
  const entries = new Map<K, CacheEntry<V>>();
  const ttlMs = options.ttlMs ?? Number.POSITIVE_INFINITY;
  const now = options.now ?? Date.now;

  return {
    load(key: K, loader: () => Promise<V>): Promise<V> {
      const cached = entries.get(key);
      if (cached && cached.expiresAt > now())
        return cached.promise;

      const entry: CacheEntry<V> = {
        promise: Promise.resolve(undefined as V),
        expiresAt: Number.POSITIVE_INFINITY,
      };

      const pending = loader().then((value) => {
        if (entries.get(key) === entry)
          entry.expiresAt = now() + ttlMs;
        return value;
      }).catch((error) => {
        if (entries.get(key) === entry)
          entries.delete(key);
        throw error;
      });
      entry.promise = pending;
      entries.set(key, entry);
      return pending;
    },
    clear(): void {
      entries.clear();
    },
  };
}
