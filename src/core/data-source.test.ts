import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveDataSource } from './data-source.ts';

test('defaults missing and invalid data-source values to remote', () => {
  assert.equal(resolveDataSource(), 'remote');
  assert.equal(resolveDataSource('invalid'), 'remote');
});

test('keeps explicitly configured data-source values', () => {
  assert.equal(resolveDataSource('remote'), 'remote');
  assert.equal(resolveDataSource('database'), 'database');
  assert.equal(resolveDataSource('mock'), 'mock');
});
