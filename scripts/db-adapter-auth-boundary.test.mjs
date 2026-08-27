import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const adapter = readFileSync(new URL('../server/db-adapter.mjs', import.meta.url), 'utf8');

test('database adapter exposes login and role-confirm routes', () => {
  assert.match(adapter, /url\.pathname === '\/auth\/login'/);
  assert.match(adapter, /url\.pathname === '\/auth\/role-confirm'/);
  assert.match(adapter, /authService\.login/);
  assert.match(adapter, /authService\.confirmRole/);
});

test('database adapter protects business routes with bearer sessions and area authorization', () => {
  assert.match(adapter, /authService\.bearerToken\(req\.headers\.authorization\)/);
  assert.match(adapter, /authService\.listAuthorizedAreas/);
  assert.match(adapter, /authService\.assertAreaAccess/);
  assert.match(adapter, /'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'/);
  assert.match(adapter, /'Access-Control-Allow-Headers': 'Content-Type, Authorization'/);
});

test('database twin queries never merge unscoped patients into an authorized area', () => {
  assert.doesNotMatch(adapter, /OR area_out_code IS NULL/);
});

test('authorized area list keeps explicitly granted empty areas visible', () => {
  const authService = readFileSync(new URL('../server/db-auth-service.mjs', import.meta.url), 'utf8');
  const areaQuery = authService.slice(
    authService.indexOf('async function listAuthorizedAreas'),
    authService.indexOf('async function assertAreaAccess'),
  );
  assert.doesNotMatch(areaQuery, /HAVING roomCount/);
});
