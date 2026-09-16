import test from 'node:test';
import assert from 'node:assert/strict';
import { wardField, wardDataNotice } from './ward-presentation.ts';
test('missing ward fields do not become confirmed negative findings', () => {
  for (const value of [null, undefined, '', '  ']) assert.equal(wardField(value), '未提供');
  assert.equal(wardField(' 无 '), '无');
  assert.equal(wardField(0), '0');
  assert.equal(wardField('青霉素'), '青霉素');
});
test('stale, failed and partial data remain explicit in patient details', () => {
  assert.match(wardDataNotice('error'), /上次数据/);
  assert.match(wardDataNotice('stale'), /过期/);
  assert.match(wardDataNotice('warning'), /未完整/);
  assert.match(wardDataNotice('loading'), /正在同步/);
  assert.equal(wardDataNotice('ready'), '');
});
