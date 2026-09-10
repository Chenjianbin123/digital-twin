import assert from 'node:assert/strict';
import test from 'node:test';
import { md5Hex } from './md5.ts';

test('MD5 matches standard ASCII vectors', () => {
  assert.equal(md5Hex(''), 'd41d8cd98f00b204e9800998ecf8427e');
  assert.equal(md5Hex('abc'), '900150983cd24fb0d6963f7d28e17f72');
  assert.equal(md5Hex('message digest'), 'f96b697d7cb7938d525a2f31aaf161d0');
});

test('MD5 encodes non-ASCII input as UTF-8', () => {
  assert.equal(md5Hex('你好'), '7eca689f0d3389d9dea66ae112e5cfd7');
});
