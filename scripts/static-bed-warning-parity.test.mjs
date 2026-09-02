import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = new URL('..', import.meta.url);
const indexPath = new URL('../digital-twin/index.html', import.meta.url);

test('static deployment bundle contains the current empty-bed warning guard', () => {
  const index = readFileSync(indexPath, 'utf8');
  const match = index.match(/src="\/assets\/([^"]+\.js)"/);
  assert.ok(match, 'digital-twin/index.html must reference a JavaScript bundle');

  const bundlePath = join(root.pathname, 'digital-twin', 'assets', match[1]);
  assert.ok(existsSync(bundlePath), `missing referenced bundle: ${bundlePath}`);

  const bundle = readFileSync(bundlePath, 'utf8');
  assert.match(
    bundle,
    /shouldWarnForMissingBedDevice/,
    'static bundle is stale and still uses the pre-fix bed template loader',
  );
  assert.match(
    bundle,
    /!text\([^)]*deviceCode\)[^&]*&&[^.]*\.isOccupied/,
    'static bundle must keep the occupied-bed-only warning guard',
  );
});
