import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SWP_ALARM_LIST_PATH,
  SWP_CALL_LIST_PATH,
  SWP_RESPONSE_TIMELINESS_PATH,
  buildActiveSwpEventQuery,
  buildSwpResponseQuery,
  collectPagedSwpRecords,
} from './swp-event-query.ts';

test('uses the verified SWP event endpoints', () => {
  assert.equal(SWP_CALL_LIST_PATH, 'swp/swpCallInfo/querySwpCallInfo');
  assert.equal(SWP_ALARM_LIST_PATH, 'swp/swpAlarmInfo/querySwpAlarmInfo');
  assert.equal(SWP_RESPONSE_TIMELINESS_PATH, 'swp/swpCallInfo/queryCallEventResponseTimeliness');
});

test('queries only active events for the selected area', () => {
  assert.deepEqual(buildActiveSwpEventQuery(18), {
    areaId: 18,
    eventStatus: '0',
    pageNum: 1,
    pageSize: 200,
  });
});

test('scopes response metrics to the selected area and rolling lookback window', () => {
  const now = new Date(2026, 7, 21, 12, 30, 45);
  assert.deepEqual(buildSwpResponseQuery(18, now), {
    areaId: 18,
    callStartTime: '2026-08-20 12:30:45',
    callEndTime: '2026-08-21 12:30:45',
    pageNum: 1,
    pageSize: 200,
  });
});

test('loads every page reported by the SWP endpoint', async () => {
  const requestedPages: number[] = [];
  const records = await collectPagedSwpRecords(
    { areaId: 18, pageNum: 1, pageSize: 2 },
    async (query) => {
      requestedPages.push(query.pageNum);
      return {
        records: query.pageNum === 1 ? [{ id: 1 }, { id: 2 }] : [{ id: 3 }],
        total: 3,
      };
    },
  );

  assert.deepEqual(requestedPages, [1, 2]);
  assert.deepEqual(records, [{ id: 1 }, { id: 2 }, { id: 3 }]);
});

test('stops when the backend repeats the same page instead of honoring pageNum', async () => {
  const requestedPages: number[] = [];
  const records = await collectPagedSwpRecords(
    { areaId: 18, pageNum: 1, pageSize: 2 },
    async (query) => {
      requestedPages.push(query.pageNum);
      return {
        records: [{ id: 1 }, { id: 2 }],
        total: 500,
        current: 1,
        size: 2,
      };
    },
  );

  assert.deepEqual(requestedPages, [1, 2]);
  assert.deepEqual(records, [{ id: 1 }, { id: 2 }]);
});

test('treats a short page as the end when total is inconsistent', async () => {
  const requestedPages: number[] = [];
  const records = await collectPagedSwpRecords(
    { areaId: 18, pageNum: 1, pageSize: 200 },
    async (query) => {
      requestedPages.push(query.pageNum);
      return {
        records: [{ id: 1 }, { id: 2 }],
        total: 500,
      };
    },
  );

  assert.deepEqual(requestedPages, [1]);
  assert.deepEqual(records, [{ id: 1 }, { id: 2 }]);
});

test('caps paged queries at twenty requests when backend pagination never ends', async () => {
  const requestedPages: number[] = [];
  const records = await collectPagedSwpRecords(
    { areaId: 18, pageNum: 1, pageSize: 2 },
    async (query) => {
      requestedPages.push(query.pageNum);
      return {
        records: [{ id: `${query.pageNum}-1` }, { id: `${query.pageNum}-2` }],
        total: 10_000,
        current: query.pageNum,
        size: 2,
      };
    },
  );

  assert.equal(requestedPages.length, 20);
  assert.equal(records.length, 40);
});
