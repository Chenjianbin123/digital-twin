import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Adapt nurse-station.glb node contract for runtime binding:
 * - 时钟 → Clock_Display
 * - 顶栏 → Ceiling (viewBounds)
 * - Screen_Glass primitive → child mesh Screen_Main under Screen_Main_Frame
 */
const [sourceArg, destinationArg] = process.argv.slice(2);
const source = resolve(sourceArg || 'public/models/smart-ward-nurse-station/nurse-station.glb');
const destination = resolve(destinationArg || source);
const file = readFileSync(source);
if (file.readUInt32LE(0) !== 0x46546c67 || file.readUInt32LE(4) !== 2)
  throw new Error('Expected GLB version 2');

const jsonLength = file.readUInt32LE(12);
const jsonType = file.readUInt32LE(16);
if (jsonType !== 0x4e4f534a)
  throw new Error('Missing JSON chunk');
const gltf = JSON.parse(file.subarray(20, 20 + jsonLength).toString('utf8'));
const binStart = 20 + jsonLength;
const remainder = file.subarray(binStart);

const nodeIndex = (name) => {
  const i = gltf.nodes.findIndex(n => n.name === name);
  if (i < 0)
    throw new Error(`Missing node: ${name}`);
  return i;
};
const rename = (from, to) => {
  const i = nodeIndex(from);
  gltf.nodes[i].name = to;
  return i;
};

rename('时钟', 'Clock_Display');
rename('顶栏', 'Ceiling');

const frameIndex = nodeIndex('Screen_Main_Frame');
const frame = gltf.nodes[frameIndex];
if (frame.mesh == null)
  throw new Error('Screen_Main_Frame has no mesh');
const frameMesh = gltf.meshes[frame.mesh];
const materialName = (primitive) => gltf.materials[primitive.material]?.name ?? '';
const glassIndex = frameMesh.primitives.findIndex(p => materialName(p) === 'Screen_Glass');
const bezelIndex = frameMesh.primitives.findIndex(p => materialName(p) === 'Monitor_Bezel');
if (glassIndex < 0 || bezelIndex < 0)
  throw new Error('Screen_Main_Frame missing Monitor_Bezel / Screen_Glass primitives');

const glassMeshIndex = gltf.meshes.length;
gltf.meshes.push({
  name: 'Screen_Main',
  primitives: [frameMesh.primitives[glassIndex]],
});
gltf.meshes[frame.mesh] = {
  ...frameMesh,
  name: frameMesh.name || 'Screen_Main_Frame',
  primitives: [frameMesh.primitives[bezelIndex]],
};

const screenMainIndex = gltf.nodes.length;
gltf.nodes.push({ name: 'Screen_Main', mesh: glassMeshIndex });
frame.children = [...(frame.children ?? []), screenMainIndex];
// Keep Monitor_Bezel on Screen_Main_Frame; Screen_Main child holds Screen_Glass.

const json = Buffer.from(JSON.stringify(gltf), 'utf8');
const jsonPad = (4 - (json.length % 4)) % 4;
const jsonChunk = Buffer.alloc(8 + json.length + jsonPad);
jsonChunk.writeUInt32LE(json.length + jsonPad, 0);
jsonChunk.writeUInt32LE(0x4e4f534a, 4);
json.copy(jsonChunk, 8);
if (jsonPad)
  jsonChunk.fill(0x20, 8 + json.length);

// remainder already includes BIN chunk header + padding from original file.
const out = Buffer.alloc(12 + jsonChunk.length + remainder.length);
out.writeUInt32LE(0x46546c67, 0);
out.writeUInt32LE(2, 4);
out.writeUInt32LE(out.length, 8);
jsonChunk.copy(out, 12);
remainder.copy(out, 12 + jsonChunk.length);
writeFileSync(destination, out);
console.log(JSON.stringify({
  source,
  destination,
  bytes: out.length,
  renames: ['时钟→Clock_Display', '顶栏→Ceiling'],
  added: 'Screen_Main (Screen_Glass)',
}));
