import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [httpClient, hospitalInfo, twinStore, dataSource] = await Promise.all([
  readFile(new URL('../src/api/http-client.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/api/hospital-info.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/stores/twin-store.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/data-source.ts', import.meta.url), 'utf8'),
]);

assert.match(httpClient, /export interface ApiRequestRecord/);
assert.match(httpClient, /export function getRecentApiRequests/);
assert.match(httpClient, /clearRecentApiRequests/);
assert.match(httpClient, /durationMs/);
assert.doesNotMatch(httpClient, /record[^\n]*token/i);

assert.match(hospitalInfo, /export async function fetchHospitalInfo\(/);
assert.match(twinStore, /fetchHospitalInfo\(\)/);
assert.match(twinStore, /医院基本信息接口失败/);
assert.match(dataSource, /resolveDataSource/);
assert.doesNotMatch(dataSource, /catch[\s\S]{0,80}mock/);

console.log('Data-chain observability boundary checks passed.');
