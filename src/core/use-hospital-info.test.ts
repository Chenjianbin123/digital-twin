import assert from 'node:assert/strict';
import test from 'node:test';
import { useHospitalInfo } from './use-hospital-info.ts';
import type { HospitalInfo } from '../types/hospital.ts';

const hospital = (name: string) => ({ hospitalName: name }) as HospitalInfo;
test('hospital metadata coalesces, caches only success, and supports explicit refresh', async () => {
  let count = 0;
  const resource = useHospitalInfo(async () => { count++; return hospital('test'); });
  const a = resource.load();
  assert.equal(resource.load(), a);
  await a;
  await resource.load();
  assert.equal(count, 1);
  await resource.load(true);
  assert.equal(count, 2);
  assert.equal(resource.loading.value, false);
});

test('failed metadata retains the last valid result and can retry', async () => {
  let fail = false;
  const resource = useHospitalInfo(async () => fail ? null : hospital('valid'));
  await resource.load();
  fail = true;
  await resource.load(true);
  assert.equal(resource.info.value?.hospitalName, 'valid');
  assert.ok(resource.error.value);
  fail = false;
  await resource.load(true);
  assert.equal(resource.error.value, null);
});

test('old hospital success/failure cannot overwrite a new login or its pending state', async () => {
  for (const fails of [false, true]) {
    const requests: { resolve: (info: HospitalInfo) => void; reject: (cause: Error) => void }[] = [];
    const resource = useHospitalInfo(() => new Promise((resolve, reject) => requests.push({ resolve, reject })));
    const old = resource.load();
    resource.clear();
    const current = resource.load();
    if (fails) requests[0].reject(new Error('old'));
    else requests[0].resolve(hospital('old'));
    await old;
    assert.equal(resource.info.value, null);
    assert.equal(resource.error.value, null);
    assert.equal(resource.loading.value, true);
    requests[1].resolve(hospital('new'));
    await current;
    assert.equal((resource.info.value as HospitalInfo | null)?.hospitalName, 'new');
    resource.clear();
    assert.equal(resource.info.value, null);
  }
});
