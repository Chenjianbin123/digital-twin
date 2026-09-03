import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/services/remote-area-fetcher.ts', import.meta.url), 'utf8');

test('病区完整数据默认每 5 分钟刷新一次', () => {
  assert.match(source, /startRemoteAreaFetcher\(store: TwinStore, intervalMs = 300_000\)/);
  assert.doesNotMatch(source, /startRemoteAreaFetcher\(store: TwinStore, intervalMs = 60_000\)/);
});
