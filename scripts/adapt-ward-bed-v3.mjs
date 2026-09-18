import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

// Preserve source buffers, textures and Draco primitives; only adapt the node contract.
const [source, destination] = process.argv.slice(2);
if (!source || !destination || resolve(source).toLowerCase() === resolve(destination).toLowerCase())
  throw new Error('Provide distinct source and output GLB paths');
const file = readFileSync(source);
if (file.readUInt32LE(0) !== 0x46546c67 || file.readUInt32LE(4) !== 2)
  throw new Error('Expected GLB version 2');
const jsonLength = file.readUInt32LE(12);
const gltf = JSON.parse(file.subarray(20, 20 + jsonLength).toString('utf8'));
const remainder = file.subarray(20 + jsonLength);
const roots = new Set(gltf.scenes[gltf.scene ?? 0].nodes);
const node = name => {
  const i = gltf.nodes.findIndex(n => n.name === name);
  if (i < 0)
    throw new Error('Missing source node ' + name);
  return i;
};
const tryNode = name => gltf.nodes.findIndex(n => n.name === name);
const addNode = value => {
  gltf.nodes.push(value);
  return gltf.nodes.length - 1;
};
const group = (name, children) => {
  children.forEach(i => roots.delete(i));
  const i = addNode({ name, children });
  roots.add(i);
  return i;
};
const rename = (from, to) => {
  const i = node(from);
  gltf.nodes[i].name = to;
  return i;
};
const primitiveMesh = (sourceMesh, indices, name) => {
  const i = gltf.meshes.length;
  gltf.meshes.push({
    ...sourceMesh,
    name,
    primitives: indices.map(index => sourceMesh.primitives[index]),
  });
  return i;
};
const materialName = primitive => gltf.materials[primitive.material]?.name ?? '';
const findPrimitive = (mesh, matName) => {
  const index = mesh.primitives.findIndex(p => materialName(p) === matName);
  if (index < 0)
    throw new Error(`Missing material ${matName} on mesh ${mesh.name || '?'}`);
  return index;
};

rename('床', 'BedBody');
rename('墙上贴纸2', 'BedHeadWall');
rename('墙上贴2', 'BedHeadServicePanel');
rename('环体.002', 'CurtainRail');
rename('椅', 'BedChair');
group('BedsideCabinet', [rename('床头柜1', 'CabinetBody'), rename('床头柜把手1', 'CabinetHandle')]);

const terminal = gltf.nodes[node('床头机')];
const terminalMesh = gltf.meshes[terminal.mesh];
if (terminalMesh.primitives.length !== 2 || materialName(terminalMesh.primitives[1]) !== '门口机内')
  throw new Error('Unexpected terminal primitive contract');
terminal.name = 'BedTerminal';
terminal.children = [
  addNode({ name: 'BedTerminalHousing', mesh: primitiveMesh(terminalMesh, [0], 'BedTerminalHousing') }),
  addNode({ name: 'BedTerminalSurface', mesh: primitiveMesh(terminalMesh, [1], 'BedTerminalSurface') }),
];
delete terminal.mesh;

const shellIndex = tryNode('壳');
if (shellIndex >= 0) {
  // Legacy split export: 壳 + 液体 + NURBS路径
  const stand = gltf.nodes[shellIndex];
  const standMesh = gltf.meshes[stand.mesh];
  if (standMesh.primitives.length !== 3 || materialName(standMesh.primitives[1]) !== '材质.015')
    throw new Error('Unexpected infusion primitive contract');
  const bottle = addNode({
    ...stand,
    name: 'InfusionBottle',
    mesh: primitiveMesh(standMesh, [1], 'InfusionBottle'),
  });
  stand.name = 'IVStand';
  stand.mesh = primitiveMesh(standMesh, [0, 2], 'IVStandFrameAndBase');
  group('InfusionEquipment', [
    bottle,
    rename('液体', 'InfusionLiquid'),
    rename('NURBS路径', 'InfusionTube'),
  ]);
}
else {
  // Newer export merges stand / bottle / liquid / tube into NURBS路径.
  const pathIndex = node('NURBS路径');
  const pathNode = gltf.nodes[pathIndex];
  const pathMesh = gltf.meshes[pathNode.mesh];
  const bottleI = findPrimitive(pathMesh, '材质.015');
  const liquidI = findPrimitive(pathMesh, '材质.016');
  const tubeI = findPrimitive(pathMesh, '材质.002');
  const standIndices = pathMesh.primitives
    .map((_, i) => i)
    .filter(i => i !== bottleI && i !== liquidI && i !== tubeI);
  if (!standIndices.length)
    throw new Error('NURBS路径 is missing IV stand primitives');

  const translation = pathNode.translation ? [...pathNode.translation] : undefined;
  const rotation = pathNode.rotation ? [...pathNode.rotation] : undefined;
  const scale = pathNode.scale ? [...pathNode.scale] : undefined;
  const transform = {
    ...(translation ? { translation } : {}),
    ...(rotation ? { rotation } : {}),
    ...(scale ? { scale } : {}),
  };

  pathNode.name = 'IVStand';
  pathNode.mesh = primitiveMesh(pathMesh, standIndices, 'IVStandFrameAndBase');
  const bottle = addNode({
    name: 'InfusionBottle',
    mesh: primitiveMesh(pathMesh, [bottleI], 'InfusionBottle'),
    ...transform,
  });
  const liquid = addNode({
    name: 'InfusionLiquid',
    mesh: primitiveMesh(pathMesh, [liquidI], 'InfusionLiquid'),
    ...transform,
  });
  const tube = addNode({
    name: 'InfusionTube',
    mesh: primitiveMesh(pathMesh, [tubeI], 'InfusionTube'),
    ...transform,
  });
  group('InfusionEquipment', [bottle, liquid, tube]);
}

const anchor = [-1.760222, 0.903284, -0.070125];
const normalized = addNode({
  name: 'BedSourceOrigin',
  children: [...roots],
  translation: [anchor[2], -anchor[1], -anchor[0]],
  rotation: [0, -Math.SQRT1_2, 0, Math.SQRT1_2],
});
const sha256 = createHash('sha256').update(file).digest('hex');
gltf.scenes = [{
  name: 'BedUnitV3',
  nodes: [addNode({
    name: 'BedUnit',
    children: [normalized],
    extras: {
      sourceSha256: sha256,
      source: source.replace(/\\/g, '/').split('/').pop(),
      sourceAnchor: anchor,
    },
  })],
}];
gltf.scene = 0;
const json = Buffer.from(JSON.stringify(gltf));
const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20);
json.copy(padded);
const header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(20 + padded.length + remainder.length, 8);
header.writeUInt32LE(padded.length, 12);
header.writeUInt32LE(0x4e4f534a, 16);
writeFileSync(destination, Buffer.concat([header, padded, remainder]));
console.log(JSON.stringify({
  sourceSha256: sha256,
  output: destination,
  bytes: 20 + padded.length + remainder.length,
  binaryPreserved: true,
}));
