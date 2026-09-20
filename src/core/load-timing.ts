export type LoadStage = 'area-options' | 'area-entry' | 'door-details' | 'bed-details' | 'file-prefix' | 'hospital-info';
export interface LoadTiming {
  stage: LoadStage;
  durationMs: number;
  outcome: 'ready' | 'error' | 'stale';
}

const records: LoadTiming[] = [];
let generation = 0;

/** Fixed stage names only: never retain request bodies, tokens or patient identifiers. */
export function startLoadStage(stage: LoadStage) {
  const startedAt = performance.now();
  const session = generation;
  let finished = false;
  return (outcome: LoadTiming['outcome'] = 'ready') => {
    if (finished || session !== generation) return;
    finished = true;
    const durationMs = performance.now() - startedAt;
    records.push({ stage, durationMs, outcome });
    if (records.length > 60) records.shift();
    const name = `digital-twin:${stage}`;
    // Diagnostics must never turn a successful business request into a failure.
    try {
      performance.clearMeasures(name);
      performance.measure(name, { start: startedAt, duration: durationMs });
    }
    catch { /* Older runtimes may not support measure options. */ }
  };
}

export async function measureLoadStage<T>(stage: LoadStage, task: () => Promise<T>): Promise<T> {
  const finish = startLoadStage(stage);
  try {
    const result = await task();
    finish();
    return result;
  }
  catch (error) {
    finish('error');
    throw error;
  }
}

export function getLoadTimings(): LoadTiming[] {
  return records.map(record => ({ ...record }));
}

export function clearLoadTimings() {
  generation++;
  for (const { stage } of records) performance.clearMeasures(`digital-twin:${stage}`);
  records.length = 0;
}
