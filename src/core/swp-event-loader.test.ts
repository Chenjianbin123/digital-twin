import assert from 'node:assert/strict';
import test from 'node:test';

import { createSwpEventSnapshotLoader } from './swp-event-loader.ts';
import { readSwpRecordPage } from './swp-page-coverage.ts';
import { mergeSwpEventSnapshot } from './swp-event-snapshot.ts';
import type { TwinAreaEntity } from '../types/twin.ts';

const area: TwinAreaEntity = {
  areaName: '一病区',
  areaCode: 'A1',
  deptName: '内科',
  rooms: [],
};

test('unknown event statuses warn and cannot clear previously fetched events', async () => {
  const load = createSwpEventSnapshotLoader({
    fetchCalls: async () => readSwpRecordPage({ records: [{ id: 1, areaId: 8 }], total: 1, current: 1 }),
    fetchAlarms: async () => readSwpRecordPage({ records: [{ id: 2, areaId: 8, eventStatus: '2' }], total: 1, current: 1 }),
  });
  const result = await load(8, area);
  assert.equal(result.events.length, 0);
  assert.deepEqual(result.refreshedSources, []);
  assert.match(result.warning ?? '', /呼叫.*1 条.*状态.*输液.*1 条.*状态/);
});

test('updates alarms and preserves calls when only the call endpoint fails', async () => {
  const load = createSwpEventSnapshotLoader({
    fetchCalls: async () => { throw new Error('呼叫接口不可用'); },
    fetchAlarms: async () => readSwpRecordPage({ records: [{ id: 2, areaId: 8, eventStatus: '0', alarmStartTime: '2026-08-21 10:01:00' }], total: 1, current: 1 }),
  });

  const result = await load(8, area);
  assert.equal(result.events.length, 1);
  assert.deepEqual(result.refreshedSources, ['swp-alarm']);
  assert.equal(result.warning, '未处理呼叫同步失败：呼叫接口不可用');
});

test('explicit processed status clears only that occurrence even on a partial page', async () => {
  let processed = false;
  const load = createSwpEventSnapshotLoader({
    fetchCalls: async () => readSwpRecordPage({ records: [
      { id: 1, areaId: 8, eventStatus: processed ? '1' : '0', callStartTime: '2026-09-30 09:00:00' },
      ...(!processed ? [{ id: 2, areaId: 8, eventStatus: '0' }] : []),
    ], total: 100, current: 1, size: 2, pages: 50 }),
    fetchAlarms: async () => readSwpRecordPage({ records: [], total: 0, current: 1 }),
  });
  const initial = await load(8, area);
  assert.equal(initial.events.length, 2);
  processed = true;
  const next = await load(8, area);
  const merged = mergeSwpEventSnapshot(initial.events, next);
  assert.equal(merged.length, 1);
  assert.match(merged[0].id, /swp:call:8:2/);
  assert.equal(merged[0].retained, true);
});

test('fails the event refresh only when both live endpoints fail', async () => {
  const load = createSwpEventSnapshotLoader({
    fetchCalls: async () => { throw new Error('呼叫失败'); },
    fetchAlarms: async () => { throw new Error('报警失败'); },
  });

  await assert.rejects(() => load(8, area), /呼叫失败.*报警失败/);
});

test('closes a processed occurrence when the pending endpoint correctly excludes status 1', async () => {
  let processed = false;
  const target = { id: 71, areaId: 8, eventStatus: '0', callStartTime: '2026-09-30 09:00:00' };
  const load = createSwpEventSnapshotLoader({
    fetchCalls: async () => readSwpRecordPage({ records: processed ? [] : [target], total: 500, current: 1, size: 200, pages: 3 }),
    fetchAlarms: async () => readSwpRecordPage({ records: [], total: 0, current: 1 }),
    fetchProcessedCalls: async () => readSwpRecordPage({ records: processed ? [{ ...target, eventStatus: '1' }] : [], total: processed ? 1 : 0, current: 1 }),
  });
  const before = await load(8, area);
  processed = true;
  const after = await load(8, area);
  assert.equal(mergeSwpEventSnapshot(before.events, after).length, 0);
});

test('a truncated successful page preserves metadata and does not authorize clearing its source', async () => {
  const load = createSwpEventSnapshotLoader({
    fetchCalls: async () => readSwpRecordPage({ records: [], total: 0, current: 1, pages: 0 }),
    fetchAlarms: async () => readSwpRecordPage({ records: [{ id: 2, areaId: 8, eventStatus: '0' }], total: 1333, current: 1, size: 10, pages: 134 }),
  });
  const result = await load(8, area);
  assert.deepEqual(result.refreshedSources, ['swp-call']);
  assert.match(result.warning ?? '', /本次获取 1 \/ 1333 条.*未确认完整/);
  assert.equal(result.coverage?.[1].pages, 134);
});

test('foreign-area responses never authorize clearing the current ward', async () => {
  const load = createSwpEventSnapshotLoader({
    fetchCalls: async () => readSwpRecordPage({ records: [{ id: 1, areaId: 9, eventStatus: '0' }], total: 1, current: 1 }),
    fetchAlarms: async () => readSwpRecordPage({ records: [], total: 0, current: 1 }),
    fetchProcessedCalls: async () => readSwpRecordPage({ records: [{ id: 71, areaId: 9, eventStatus: '1' }], total: 1, current: 1 }),
  });
  const result = await load(8, area);
  assert.deepEqual(result.refreshedSources, ['swp-alarm']);
  assert.equal(result.resolvedEventIds?.length, 0);
  assert.match(result.warning ?? '', /其他病区/);
});

test('failed processed reconciliation retains unconfirmed events', async () => {
  const load = createSwpEventSnapshotLoader({
    fetchCalls: async () => readSwpRecordPage({ records: [], total: 500, current: 1, size: 200, pages: 3 }),
    fetchAlarms: async () => readSwpRecordPage({ records: [], total: 0, current: 1 }),
    fetchProcessedCalls: async () => { throw Error('offline'); },
  });
  const result = await load(8, area);
  assert.equal(result.resolvedEventIds?.length, 0);
  assert.match(result.warning ?? '', /已处理状态对账失败/);
  assert.deepEqual(result.refreshedSources, ['swp-alarm']);
});

test('advances processed reconciliation beyond 200 records, cycles and resets on ward switch', async () => {
  const requested: Array<[number, number]> = [];
  const target = {id:71,areaId:8,eventStatus:'0',callStartTime:'2026-09-30 09:00:00'};
  let initial = true;
  const load = createSwpEventSnapshotLoader({
    fetchCalls: async () => readSwpRecordPage({records:initial?[target]:[],total:500,current:1,size:200,pages:3}),
    fetchAlarms: async () => readSwpRecordPage({records:[],total:0,current:1}),
    fetchProcessedCalls: async (areaId, pageNum) => {
      requested.push([areaId,pageNum]);
      return readSwpRecordPage({records:pageNum === 2?[{...target,eventStatus:'1'}]:[],total:201,current:pageNum,size:200,pages:2});
    },
  });
  let queue = (await load(8,area)).events;
  initial = false;
  queue = mergeSwpEventSnapshot(queue,await load(8,area));
  assert.equal(queue.length,0);
  await load(8,area);
  await load(9,area);
  assert.deepEqual(requested,[[8,1],[8,2],[8,1],[9,1]]);
});

test('an explicit pending occurrence wins over contradictory processed data in the same refresh', async () => {
  const target = {id:71,areaId:8,eventStatus:'0',callStartTime:'2026-09-30 09:00:00'};
  const load = createSwpEventSnapshotLoader({
    fetchCalls: async () => readSwpRecordPage({records:[target],total:1,current:1}),
    fetchAlarms: async () => readSwpRecordPage({records:[],total:0,current:1}),
    fetchProcessedCalls: async () => readSwpRecordPage({records:[{...target,eventStatus:'1'}],total:1,current:1}),
  });
  assert.equal(mergeSwpEventSnapshot([],await load(8,area)).length,1);
});

test('a stale same-ward run cannot change the new run reconciliation cursor', async () => {
  const requested: number[] = [];
  let release!: () => void;
  const load = createSwpEventSnapshotLoader({
    fetchCalls: async () => readSwpRecordPage({records:[],total:0,current:1}),
    fetchAlarms: async () => readSwpRecordPage({records:[],total:0,current:1}),
    fetchProcessedCalls: async (_areaId,pageNum) => {
      requested.push(pageNum);
      if (requested.length === 1) await new Promise<void>(resolve=>{release=resolve;});
      return readSwpRecordPage({records:[],total:600,current:pageNum,size:200,pages:3});
    },
  });
  const obsolete=load(8,area);
  await load(8,area);
  release(); await obsolete;
  await load(8,area);
  assert.deepEqual(requested,[1,1,2]);
});
