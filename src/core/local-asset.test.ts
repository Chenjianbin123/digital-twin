import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveLocalAsset } from './local-asset.ts';

test('static files and embedded images remain usable', () => {
  assert.equal(resolveLocalAsset('videos/demo.mp4'), '/videos/demo.mp4');
  assert.equal(resolveLocalAsset('/images/staff-default-nurse.png'), '/images/staff-default-nurse.png');
  assert.equal(resolveLocalAsset('data:image/png;base64,abc'), 'data:image/png;base64,abc');
  assert.match(resolveLocalAsset('/swp_upload/picture/template/img/bg.png'), /^data:image\/svg\+xml,/);
});

test('backend, external and traversal paths cannot be used as resources', () => {
  for (const path of [undefined, '', 'https://hospital.example/a.png', '//hospital.example/a.png',
    '/swp/query', '/db-adapter/api/areas', '/images/../../swp/query', '/images\\evil.png'])
    assert.equal(resolveLocalAsset(path), '');
});
