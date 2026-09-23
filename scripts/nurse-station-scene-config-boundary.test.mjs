import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = await readFile(new URL('../src/config/nurse-station-scene.ts', import.meta.url), 'utf8');
const areaScene = await readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8');

assert.match(config, /export const nurseStationSceneConfig/);
assert.match(config, /model:\s*\{/);
assert.match(config, /maxSize:\s*\{ x: 11\.04, y: 2\.3895, z: 5\.102 \}/);
assert.match(config, /position:\s*\{ x: 0, z: 14 \}/);
assert.match(config, /deskFov: \d+(?:\.\d+)?/);
assert.match(config, /initialDistance: \d+(?:\.\d+)?/);
assert.match(config, /initialAngle: \{ azimuthDeg: -?\d+(?:\.\d+)?, elevationDeg: -?\d+(?:\.\d+)? \}/);
assert.match(config, /distance:\s*\{ min: 0\.5, max: 12 \}/);
assert.match(config, /limitsEnabled:\s*true/);
assert.doesNotMatch(config, /farWallMesh:\s*"Lobby_Back_Wall"/);
assert.match(config, /ceilingMesh:\s*"天花板"/);
assert.match(config, /wallMeshes:\s*\["墙壁", "墙壁2"\]/);
assert.match(config, /endWallMesh:\s*"立方体\.005"/);
assert.match(config, /layout: "legacy"/);
assert.match(config, /nurse-station\.glb\?v=20260921/);
assert.match(areaScene, /from '@\/config\/nurse-station-scene';/);
assert.match(areaScene, /nurseStationSceneConfig\.model\.url/);
assert.match(areaScene, /nurseStationSceneConfig\.camera\.target/);
assert.doesNotMatch(areaScene, /const NURSE_STATION_MODEL_URL = ['"]\/models\//);

console.log('Nurse-station scene config boundary checks passed.');
