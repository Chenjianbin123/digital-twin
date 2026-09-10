import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dataSource = readFileSync(new URL('../src/core/data-source.ts', import.meta.url), 'utf8');

assert.match(
  dataSource,
  /return value === 'mock' \|\| value === 'database' \? value : 'remote';/,
  '未显式配置 mock 时应默认使用真实 SWP 后端接口',
);
