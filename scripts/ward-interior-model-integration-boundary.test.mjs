import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const wardScene = readFileSync(new URL('../src/core/ward-scene.ts', import.meta.url), 'utf8');

test('loads the versioned smart ward GLB with a stale-result token', () => {
  assert.match(wardScene, /GLTFLoader/);
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

test('applies the model pose scale to each cloned Blender bed', () => {
  assert.match(wardScene, /group\.scale\.setScalar\(pose\.scale\)/);
});

test('keeps the JSON template renderer and configures model canvas UVs', () => {
  assert.match(wardScene, /loadParsedTemplate\(bed\.templateId\)/);
  assert.match(wardScene, /renderBedTerminalTexture\(bed, parsed, status\)/);
  assert.match(wardScene, /configureWardInteriorCanvasTexture\(tex\)/);
});

test('keeps the generated room as fallback and invalidates late loads on dispose', () => {
  assert.match(wardScene, /failed to load smart ward interior GLB, using generated fallback/);
  assert.match(wardScene, /this\.roomGroup\.visible = true/);
  assert.match(wardScene, /\+\+this\.wardInteriorModelLoadToken/);
  assert.match(wardScene, /disposeWardInteriorModel/);
});

test('tears down a partially mounted GLB before rebuilding the generated fallback', () => {
  const loadStart = wardScene.indexOf('private async loadWardInteriorModel');
  const loadEnd = wardScene.indexOf('private addAccentStrip', loadStart);
  const loadMethod = wardScene.slice(loadStart, loadEnd);

  assert.match(loadMethod, /this\.scene\.remove\(model\)/);
  assert.match(loadMethod, /this\.wardInteriorModel = null/);
  assert.match(loadMethod, /this\.wardInteriorParts = null/);
  assert.match(loadMethod, /if \(this\.ward\)\s+this\.updateWard\(this\.ward\)/);
});

test('removes CSS bed overlays before disposing a replaced bed group', () => {
  const disposeStart = wardScene.indexOf('private disposeBedMeshGroup');
  const disposeEnd = wardScene.indexOf('private clearBedMeshes', disposeStart);
  const disposeMethod = wardScene.slice(disposeStart, disposeEnd);

  assert.match(disposeMethod, /meshGroup\.label\?\.removeFromParent\(\)/);
  assert.match(disposeMethod, /meshGroup\.deviceTag\?\.removeFromParent\(\)/);
});
