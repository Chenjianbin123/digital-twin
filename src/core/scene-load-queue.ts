// Serialise first visits and retries across scenes to
// avoid allocating three GLB buffers, bitmap sets and WASM heaps at once.
let pending: Promise<void> = Promise.resolve();

export async function acquireSceneLoad(): Promise<() => void> {
  const previous = pending;
  let release!: () => void;
  pending = new Promise<void>(resolve => { release = resolve; });
  await previous;
  return release;
}
