import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/api/swp-events.ts', import.meta.url), 'utf8');

function functionBody(name, nextName) {
  const start = source.indexOf(`export function ${name}`);
  const end = source.indexOf(`export function ${nextName}`, start);
  assert.notEqual(start, -1, `${name} should exist`);
  assert.notEqual(end, -1, `${nextName} should follow ${name}`);
  return source.slice(start, end);
}

assert.match(source, /async function querySinglePage/);

const calls = functionBody('fetchActiveSwpCalls', 'fetchActiveSwpAlarms');
assert.match(calls, /querySinglePage/);
assert.doesNotMatch(calls, /queryPages/);

const alarms = functionBody('fetchActiveSwpAlarms', 'fetchSwpResponseTimeliness');
assert.match(alarms, /querySinglePage/);
assert.doesNotMatch(alarms, /queryPages/);

const responseMetrics = source.slice(source.indexOf('export function fetchSwpResponseTimeliness'));
assert.match(responseMetrics, /queryPages/);

console.log('SWP active event single-page boundary checks passed.');
