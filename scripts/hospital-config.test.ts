import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

assert.equal(existsSync(new URL('../src/config/hospitals/index.ts', import.meta.url)), false);
assert.equal(existsSync(new URL('../src/api/mock-twin.ts', import.meta.url)), false);
