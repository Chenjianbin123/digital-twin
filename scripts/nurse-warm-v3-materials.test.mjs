import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { inflateSync } from 'node:zlib';

const assetUrl = new URL('../public/models/smart-ward-nurse-station/nurse-station-warm-v3.glb', import.meta.url);
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
let assetPromise;

async function asset() {
  assetPromise ??= (async () => {
    const bytes = await readFile(assetUrl);
    assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
    assert.equal(bytes.readUInt32LE(4), 2);
    assert.equal(bytes.readUInt32LE(8), bytes.length);
    assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
    const endJson = 20 + bytes.readUInt32LE(12);
    assert.ok(endJson + 8 <= bytes.length);
    assert.equal(bytes.readUInt32LE(endJson + 4), 0x004e4942);
    assert.equal(endJson + 8 + bytes.readUInt32LE(endJson), bytes.length);
    return { json: JSON.parse(bytes.toString('utf8', 20, endJson)), binary: bytes.subarray(endJson + 8) };
  })();
  return assetPromise;
}

function unitInterval(value, message) {
  assert.ok(Number.isFinite(value) && value >= 0 && value <= 1, `${message}: ${value}`);
}

function material(json, name) {
  const matches = json.materials.filter(value => value.name === name);
  assert.equal(matches.length, 1, `${name}: one material`);
  return matches[0];
}

function sourceIndex(json, info) {
  assert.ok(info && Number.isInteger(info.index) && json.textures[info.index], 'Texture binding resolves');
  const source = json.textures[info.index].source;
  assert.ok(Number.isInteger(source) && json.images[source], 'Texture source image resolves');
  return source;
}

function imageBytes(document, image) {
  assert.equal(image.uri, undefined, `${image.name}: no external image dependency`);
  assert.ok(Number.isInteger(image.bufferView), `${image.name}: embedded buffer view`);
  const view = document.json.bufferViews[image.bufferView];
  assert.ok(view && view.buffer === 0 && view.byteLength > 0);
  const start = view.byteOffset ?? 0;
  assert.ok(start >= 0 && start + view.byteLength <= document.binary.length);
  return document.binary.subarray(start, start + view.byteLength);
}

function owners(json, mat) {
  const index = json.materials.indexOf(mat);
  return json.nodes.filter(node => node.mesh !== undefined
    && json.meshes[node.mesh].primitives.some(primitive => primitive.material === index)).map(node => node.name);
}

function roughnessStats(png) {
  assert.deepEqual(png.subarray(0, 8), pngSignature);
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  assert.ok(width > 0 && height > 0 && width <= 4096 && height <= 4096);
  assert.equal(png[24], 8, 'Derived roughness PNG uses 8-bit channels');
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[png[25]];
  assert.ok(channels, 'Supports grayscale/RGB PNG with optional alpha');
  assert.deepEqual([...png.subarray(26, 29)], [0, 0, 0], 'Standard compression/filter, noninterlaced');
  const idat = [];
  for (let offset = 8; offset < png.length;) {
    assert.ok(offset + 12 <= png.length, 'Complete PNG chunk header');
    const length = png.readUInt32BE(offset);
    assert.ok(offset + length + 12 <= png.length, 'Complete PNG chunk payload');
    if (png.toString('ascii', offset + 4, offset + 8) === 'IDAT') idat.push(png.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat), { maxOutputLength: (stride + 1) * height });
  assert.equal(raw.length, (stride + 1) * height);
  let previous = Buffer.alloc(stride);
  let sum = 0; let squared = 0; let min = 255; let max = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    assert.ok(filter <= 4, 'Known PNG row filter');
    const row = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const left = x < channels ? 0 : row[x - channels];
      const up = previous[x];
      const corner = x < channels ? 0 : previous[x - channels];
      const estimate = left + up - corner;
      const pa = Math.abs(estimate - left); const pb = Math.abs(estimate - up); const pc = Math.abs(estimate - corner);
      const paeth = pa <= pb && pa <= pc ? left : pb <= pc ? up : corner;
      const predictor = [0, left, up, Math.floor((left + up) / 2), paeth][filter];
      row[x] = (raw[y * (stride + 1) + 1 + x] + predictor) & 255;
    }
    // glTF reads roughness from G; a packed metallic B channel need not match it.
    const green = channels >= 3 ? 1 : 0;
    for (let x = 0; x < width; x++) {
      const value = row[x * channels + green];
      sum += value; squared += value * value; min = Math.min(min, value); max = Math.max(max, value);
    }
    previous = row;
  }
  const count = width * height;
  return { mean: sum / count / 255, std: Math.sqrt(Math.max(0, squared / count - (sum / count) ** 2)) / 255,
    min: min / 255, max: max / 255 };
}

test('warm-v3 exports legal PBR factors with thin glass only and no refraction pass', async () => {
  const { json } = await asset();
  material(json, 'WarmStationV1_glass');
  for (const mat of json.materials) {
    const pbr = mat.pbrMetallicRoughness;
    assert.ok(pbr, `${mat.name}: PBR material exists`);
    const color = pbr.baseColorFactor ?? [1, 1, 1, 1];
    assert.equal(color.length, 4);
    color.forEach(value => unitInterval(value, `${mat.name}: baseColorFactor`));
    unitInterval(pbr.roughnessFactor ?? 1, `${mat.name}: roughnessFactor`);
    unitInterval(pbr.metallicFactor ?? 1, `${mat.name}: metallicFactor`);
    (mat.emissiveFactor ?? [0, 0, 0]).forEach(value => unitInterval(value, `${mat.name}: emissiveFactor`));
    assert.equal(mat.extensions?.KHR_materials_transmission?.transmissionFactor ?? 0, 0,
      `${mat.name}: runtime materials must not re-enable the full-scene refraction pass`);
    if (mat.name === 'WarmStationV1_glass') {
      assert.ok(Math.abs(color[3] - .22) < 1e-6, 'Only thin runtime glass uses 0.22 opacity');
      assert.equal(mat.alphaMode, 'BLEND', 'Thin glass retains transparency without transmission');
      assert.equal(mat.doubleSided ?? false, false, 'Thin glass keeps backface culling');
    } else {
      assert.equal(color[3], 1, `${mat.name}: no accidental transparent factor`);
      assert.equal(mat.alphaMode ?? 'OPAQUE', 'OPAQUE', `${mat.name}: only named glass can be blended`);
    }
    if (mat.normalTexture) assert.ok(Number.isFinite(mat.normalTexture.scale ?? 1) && (mat.normalTexture.scale ?? 1) >= 0);
  }
});

test('warm-v3 embeds all image bytes and reuses images within its material budget', async () => {
  const document = await asset();
  const { json } = document;
  assert.equal(json.buffers.length, 1);
  assert.equal(json.buffers[0].uri, undefined);
  assert.equal(json.images.length, 25, 'Two floor replacements do not multiply the source-image count');
  assert.ok(json.materials.length <= 48 && json.textures.length <= 64);
  for (const texture of json.textures) assert.ok(Number.isInteger(texture.source) && json.images[texture.source]);
  for (const image of json.images) {
    const bytes = imageBytes(document, image);
    if (image.mimeType === 'image/png') assert.deepEqual(bytes.subarray(0, 8), pngSignature);
    else {
      assert.equal(image.mimeType, 'image/jpeg');
      assert.equal(bytes.readUInt16BE(0), 0xffd8);
    }
  }
});

test('warm-v3 wood variants use distinct real factors but share all three wood images', async () => {
  const { json } = await asset();
  const names = ['WarmStationV1_oak', 'WarmStationV3_oak_door', 'WarmStationV3_oak_column', 'WarmStationV3_oak_portal'];
  const woods = names.map(name => material(json, name));
  const bindings = woods.map(mat => [sourceIndex(json, mat.pbrMetallicRoughness.baseColorTexture),
    sourceIndex(json, mat.normalTexture), sourceIndex(json, mat.pbrMetallicRoughness.metallicRoughnessTexture)]);
  for (const binding of bindings) assert.deepEqual(binding, bindings[0], 'Compare image sources, not duplicated glTF texture-reference indices');
  assert.deepEqual(bindings[0].map(index => json.images[index].name),
    ['warm-v2-oak-color', 'warm-v2-oak-normal', 'warm-v2-oak-roughness']);
  for (let i = 0; i < woods.length; i++) {
    const factor = woods[i].pbrMetallicRoughness.baseColorFactor;
    assert.ok(factor, `${names[i]}: factor was not lost during export`);
    assert.deepEqual(owners(json, woods[i]), [i === 0 ? 'Desk_Static' : 'Architecture_Static']);
    assert.equal(woods[i].extensions?.KHR_materials_transmission?.transmissionFactor ?? 0, 0);
    for (let j = 0; j < i; j++) assert.ok(factor.slice(0, 3).some((value, channel) =>
      Math.abs(value - woods[j].pbrMetallicRoughness.baseColorFactor[channel]) > .01), 'Wood roles remain visibly differentiated');
  }
});

test('warm-v3 uses both embedded derived floor roughness maps with real nonuniform G data', async () => {
  const document = await asset();
  const { json } = document;
  for (const key of ['floor', 'floor_blue']) {
    const mat = material(json, `WarmStationV1_${key}`);
    const pbr = mat.pbrMetallicRoughness;
    const image = json.images[sourceIndex(json, pbr.metallicRoughnessTexture)];
    assert.equal(image.name, `warm-v3-${key}-roughness`, 'New roughness was actually assigned and exported');
    assert.equal(image.mimeType, 'image/png');
    const stats = roughnessStats(imageBytes(document, image));
    const expected = key === 'floor' ? .2613 : .2762;
    assert.ok(Math.abs(stats.mean * (pbr.roughnessFactor ?? 1) - expected) < .007, `${key}: mean ${stats.mean}`);
    assert.ok(stats.std > .004 && stats.max - stats.min > .025, `${key}: quartz/wear variation is not a flat placeholder`);
    assert.ok(stats.min >= .18 && stats.max <= .42, `${key}: restrained micro-reflection range`);
    assert.equal(json.images[sourceIndex(json, pbr.baseColorTexture)].name, `warm-v2-${key}-color`);
    assert.equal(json.images[sourceIndex(json, mat.normalTexture)].name, `warm-v2-${key}-normal`);
    assert.deepEqual(owners(json, mat), ['Architecture_Static']);
  }
});
