import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('template query path matches swp-admin double-swp route through the /swp proxy', () => {
  const source = readFileSync(new URL('../src/api/template.ts', import.meta.url), 'utf8');

  assert.match(
    source,
    /const TEMPLATE_PATH = 'swp\/swpTemplateInfo\/querySwpTemplateInfoById';/,
  );
});

test('database template errors do not fall back to mock data', () => {
  const source = readFileSync(new URL('../src/api/template.ts', import.meta.url), 'utf8');
  const databaseBranch = source.slice(
    source.indexOf("if (dataSource === 'database')"),
    source.indexOf('const res = await postJson'),
  );

  assert.match(databaseBranch, /return fetchDatabaseTemplate\(id\)/);
  assert.doesNotMatch(databaseBranch, /catch|MOCK_TEMPLATES|本地回退/);
});
