import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveDbAdapterHost } from './db-adapter-host.mjs';

test('database adapter binds to localhost by default', () => {
  assert.equal(resolveDbAdapterHost(), '127.0.0.1');
});
