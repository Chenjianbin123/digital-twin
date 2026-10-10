import assert from 'node:assert/strict';
import test from 'node:test';

import { assertRemoteRequestsAllowed, resolveDataSource } from './data-source.ts';

test('defaults missing and invalid data-source values to local mock', () => {
  assert.equal(resolveDataSource(), 'mock');
  assert.equal(resolveDataSource('invalid'), 'mock');
});

test('remote and database environment settings cannot enable network data', () => {
  assert.equal(resolveDataSource('remote'), 'mock');
  assert.equal(resolveDataSource('database'), 'mock');
  assert.equal(resolveDataSource('mock'), 'mock');
});

test('business transport is blocked before network IO', () => {
  assert.throws(assertRemoteRequestsAllowed, /已禁用后台接口请求/);
});
