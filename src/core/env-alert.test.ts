import assert from 'node:assert/strict';
import test from 'node:test';

import { analyzeEnvAlert } from './env-alert.ts';

test('identifies the clinical environment issue and severity', () => {
  const result = analyzeEnvAlert({
    temp: '31',
    relativeHumid: '70%',
    airQuality: '中',
    noiseLevel: '56',
  });

  assert.equal(result.level, 'danger');
  assert.deepEqual(result.items.map(item => item.field), [
    'temp',
    'relativeHumid',
    'airQuality',
    'noiseLevel',
  ]);
  assert.match(result.summary, /温度过高/);
  assert.match(result.summary, /湿度偏高/);
});

test('does not create an environment alert for normal readings', () => {
  const result = analyzeEnvAlert({
    temp: '24',
    relativeHumid: '55%',
    airQuality: '优',
    noiseLevel: '40',
  });

  assert.equal(result.level, 'normal');
  assert.equal(result.items.length, 0);
  assert.equal(result.summary, '环境正常');
});

test('treats explicitly poor air quality as a serious ward environment issue', () => {
  const result = analyzeEnvAlert({ airQuality: '差' });

  assert.equal(result.level, 'danger');
  assert.equal(result.items[0]?.message, '空气质量较差');
});
