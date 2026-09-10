import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const distUrl = new URL('../dist/', import.meta.url);
const indexUrl = new URL('index.html', distUrl);

test('production entry bundle stays below the initial-load budget', (t) => {
  if (!existsSync(indexUrl)) {
    t.skip('run npm run build before checking the production bundle');
    return;
  }

  const index = readFileSync(indexUrl, 'utf8');
  const match = index.match(/src="\/assets\/([^"]+\.js)"/);
  assert.ok(match, 'dist/index.html must reference a JavaScript entry');

  const entryPath = fileURLToPath(new URL(`assets/${match[1]}`, distUrl));
  const entry = readFileSync(entryPath);
  assert.ok(statSync(entryPath).size <= 300 * 1024, 'entry JavaScript must stay at or below 300 KiB');
  assert.ok(gzipSync(entry).byteLength <= 100 * 1024, 'gzipped entry JavaScript must stay at or below 100 KiB');
});
