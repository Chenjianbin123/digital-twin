import assert from 'node:assert/strict';
import test from 'node:test';
import { compileString } from 'sass';
import { readFileSync } from 'node:fs';

test('dashboard font compiles with a 12px floor and scoped viewport scaling', () => {
  const source = readFileSync(new URL('../src/styles/dashboard.scss', import.meta.url), 'utf8');
  for (const size of [9, 12, 14, 22]) {
    const css = compileString(source + `.probe { font-size: dash-font(${size}); }`).css;
    assert.ok(css.includes(`max(12px, ${size} * var(--dashboard-font-unit, 1px))`));
  }
});
