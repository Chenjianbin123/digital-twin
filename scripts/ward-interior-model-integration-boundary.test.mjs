import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const wardScene = readFileSync(new URL('../src/core/ward-scene.ts', import.meta.url), 'utf8');

test('loads the versioned smart ward GLB with a stale-result token', () => {
  assert.match(wardScene, /GLTFLoader/);
  assert.match(wardScene, /DRACOLoader/);
  assert.match(wardScene, /WARD_INTERIOR_MODEL_URL/);
  assert.match(wardScene, /wardInteriorModelLoadToken/);
  assert.match(wardScene, /loader\.loadAsync\(WARD_INTERIOR_MODEL_URL\)/);
  assert.match(wardScene, /token !== this\.wardInteriorModelLoadToken/);
});

test('rebuilds the latest ward and templates after the model becomes ready', () => {
  assert.match(wardScene, /this\.roomGroup\.visible = false/);
  assert.match(wardScene, /this\.updateWard\(this\.ward\)/);
  assert.match(wardScene, /this\.syncWardBedTemplates\(this\.ward\)/);
});

test('binds baked room beds in place without cloning a BedPrototype', () => {
  assert.match(wardScene, /mode === 'baked'/);
  assert.match(wardScene, /bindWardInteriorBakedBed/);
  assert.match(wardScene, /syncWardInteriorBakedBedVisibility/);
  assert.match(wardScene, /wardInteriorBakedBed/);
});

test('prepares ward interior materials with IBL intensity and metalness caps', () => {
  assert.match(wardScene, /RoomEnvironment/);
  assert.match(wardScene, /prepareWardInteriorModelMaterials/);
  assert.match(wardScene, /environmentIntensity/);
  assert.match(wardScene, /outputColorSpace/);
});

test('keeps the JSON template renderer and configures model canvas UVs', () => {
  assert.match(wardScene, /loadParsedTemplate\(bed\.templateId\)/);
  assert.match(wardScene, /renderBedTerminalTexture\(bed, parsed, status\)/);
  assert.match(wardScene, /configureWardInteriorCanvasTexture\(tex\)/);
});

test('reports interior GLB load state so the shared loading overlay can match the corridor', () => {
  assert.match(wardScene, /onModelState\?\.\('loading'\)/);
  assert.match(wardScene, /onModelState\?\.\('ready'\)/);
  assert.match(wardScene, /onModelState\?\.\('fallback'\)/);
});

test('applies baked interior camera poses at native scale without live camera debug logs', () => {
  assert.match(wardScene, /usesNativeCameraPose/);
  assert.match(wardScene, /logCameraView/);
  assert.match(wardScene, /\[WardScene\] 视角/);
  assert.match(wardScene, /addEventListener\('end', this\.onControlsEnd\)/);
  assert.doesNotMatch(wardScene, /snapCameraToLockedView/);
  assert.doesNotMatch(wardScene, /\[WardScene\] 射线定机位/);
});

test('does not flash or fall back to the generated room while loading room-v1', () => {
  assert.match(wardScene, /this\.roomGroup\.visible = false/);
  assert.doesNotMatch(wardScene, /using generated fallback/);
  assert.match(wardScene, /failed to load room-v1 GLB/);
  assert.match(wardScene, /\+\+this\.wardInteriorModelLoadToken/);
  assert.match(wardScene, /disposeWardInteriorModel/);
});

test('tears down a partially mounted GLB without showing the generated room', () => {
  const loadStart = wardScene.indexOf('private async loadWardInteriorModel');
  const loadEnd = wardScene.indexOf('private addAccentStrip', loadStart);
  const loadMethod = wardScene.slice(loadStart, loadEnd);

  assert.match(loadMethod, /this\.scene\.remove\(model\)/);
  assert.match(loadMethod, /this\.wardInteriorModel = null/);
  assert.match(loadMethod, /this\.wardInteriorParts = null/);
  assert.doesNotMatch(loadMethod, /this\.roomGroup\.visible = true/);
});

test('removes CSS bed overlays before disposing a replaced bed group', () => {
  const disposeStart = wardScene.indexOf('private disposeBedMeshGroup');
  const disposeEnd = wardScene.indexOf('private clearBedMeshes', disposeStart);
  const disposeMethod = wardScene.slice(disposeStart, disposeEnd);

  assert.match(disposeMethod, /meshGroup\.label\?\.removeFromParent\(\)/);
  assert.match(disposeMethod, /meshGroup\.deviceTag\?\.removeFromParent\(\)/);
});

