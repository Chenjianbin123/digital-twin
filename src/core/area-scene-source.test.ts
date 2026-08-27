import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sourceUrl = new URL('./area-scene.ts', import.meta.url);
const visualSceneUrl = new URL('../components/NurseStationVisualScene.vue', import.meta.url);

test('area scene uses only the high-fidelity nurse station model', async () => {
  const source = await readFile(sourceUrl, 'utf8');

  assert.doesNotMatch(source, /\bbuildHospitalNurseStation\b/);
  assert.doesNotMatch(source, /\bgeneratedNurseStationGroup\b/);
  assert.doesNotMatch(source, /generated-nurse-station/);
  assert.match(source, /attachNurseStationBoardDisplays\(model\)/);
  assert.match(source, /loader\.loadAsync\(NURSE_STATION_MODEL_URL\)/);
});

test('nurse station loading errors do not claim a fallback scene is active', async () => {
  const [areaSceneSource, visualSceneSource] = await Promise.all([
    readFile(sourceUrl, 'utf8'),
    readFile(visualSceneUrl, 'utf8'),
  ]);

  assert.doesNotMatch(areaSceneSource, /failed to load nurse station GLB, using generated fallback/);
  assert.doesNotMatch(visualSceneSource, /已启用轻量场景/);
  assert.match(visualSceneSource, /护士站模型加载失败/);
});
