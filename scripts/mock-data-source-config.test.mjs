import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dataSource = readFileSync(new URL('../src/core/data-source.ts', import.meta.url), 'utf8');

assert.match(
  dataSource,
  /return 'mock';/,
  '本地模拟分支必须固定使用 mock',
);
