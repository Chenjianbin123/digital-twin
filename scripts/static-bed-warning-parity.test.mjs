import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const distDir = fileURLToPath(new URL('../dist/', import.meta.url));
const indexPath = new URL('../dist/index.html', import.meta.url);

test('production bundle contains the current empty-bed warning guard', (t) => {
  if (!existsSync(indexPath)) {
    t.skip('run npm run build before checking the production bundle');
    return;
  }
  const assetsDir = join(distDir, 'assets');
  const bundle = readdirSync(assetsDir)
    .filter(name => name.endsWith('.js'))
    .map(name => readFileSync(join(assetsDir, name), 'utf8'))
    .join('\\n');

  assert.match(
    bundle,
    /空床.*无患者.*未入住.*未分配/,
    'production bundles must contain the current empty-bed warning policy',
  );
  assert.match(
    bundle,
    /未关联床头机设备/,
    'production bundles must retain the missing-device warning path',
  );
});
