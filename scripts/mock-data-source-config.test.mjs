import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env.development', import.meta.url), 'utf8');

assert.match(env, /^VITE_DATA_SOURCE=remote$/m, '开发环境应直接使用真实 SWP 后端接口');
