import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApiDiagnosticReport, safeApiPath } from './api-diagnostics.ts';

test('diagnostics export has an explicit allowlist and bounded records with no raw error or identity', () => {
  const record = { path: 'https://synthetic.test/swp/swp/swpCallInfo/querySwpCallInfo?token=secret-token',
    startedAt: '2026-10-05T00:00:00Z', durationMs: 10, status: 200, businessCode: 500, ok: false, kind: 'business' as const,
    error: 'secret-error', body: {patientName:'secret-patient'}, token: 'secret-token', account:'secret-account' };
  const report = buildApiDiagnosticReport(Array.from({length:65}, () => record));
  assert.doesNotMatch(report, /secret-|synthetic.test/);
  const parsed = JSON.parse(report);
  assert.equal(parsed.records.length, 60);
  assert.equal(parsed.records[0].path, '/swp/swpCallInfo/querySwpCallInfo');
  assert.equal(parsed.records[0].ok, false);
  assert.equal(parsed.records[0].businessCode, 500);
  assert.equal(safeApiPath('/patient/private-record'), '/[其他接口]');
});
