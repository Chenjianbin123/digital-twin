import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

// Preserve source buffers, textures and Draco primitives; only adapt the node contract.
const [source, destination] = process.argv.slice(2);
if (!source || !destination || resolve(source).toLowerCase() === resolve(destination).toLowerCase()) throw new Error('Provide distinct source and output GLB paths');
const file = readFileSync(source);
if (file.readUInt32LE(0) !== 0x46546c67 || file.readUInt32LE(4) !== 2) throw new Error('Expected GLB version 2');
const jsonLength = file.readUInt32LE(12);
const gltf = JSON.parse(file.subarray(20, 20 + jsonLength).toString('utf8'));
const remainder = file.subarray(20 + jsonLength);
const roots = new Set(gltf.scenes[gltf.scene ?? 0].nodes);
const node = name => { const i = gltf.nodes.findIndex(n => n.name === name); if (i < 0) throw new Error('Missing source node ' + name); return i; };
const addNode = value => { gltf.nodes.push(value); return gltf.nodes.length - 1; };
const group = (name, children) => { children.forEach(i => roots.delete(i)); const i = addNode({ name, children }); roots.add(i); return i; };
const rename = (from, to) => { const i = node(from); gltf.nodes[i].name = to; return i; };
rename('床', 'BedBody');
rename('墙上贴纸2', 'BedHeadWall');
rename('墙上贴2', 'BedHeadServicePanel');
rename('环体.002', 'CurtainRail');
rename('椅', 'BedChair');
group('BedsideCabinet', [rename('床头柜1', 'CabinetBody'), rename('床头柜把手1', 'CabinetHandle')]);
const terminal = gltf.nodes[node('床头机')];
const terminalMesh = gltf.meshes[terminal.mesh];
if (terminalMesh.primitives.length !== 2 || gltf.materials[terminalMesh.primitives[1].material].name !== '门口机内') throw new Error('Unexpected terminal primitive contract');
const primitiveMesh = (sourceMesh, indices, name) => {
  const i = gltf.meshes.length;
  gltf.meshes.push({ ...sourceMesh, name, primitives: indices.map(index => sourceMesh.primitives[index]) });
  return i;
};
terminal.name = 'BedTerminal';
terminal.children = [
  addNode({ name: 'BedTerminalHousing', mesh: primitiveMesh(terminalMesh, [0], 'BedTerminalHousing') }),
  addNode({ name: 'BedTerminalSurface', mesh: primitiveMesh(terminalMesh, [1], 'BedTerminalSurface') }),
];
delete terminal.mesh;
const standIndex = node('壳');
const stand = gltf.nodes[standIndex];
const standMesh = gltf.meshes[stand.mesh];
if (standMesh.primitives.length !== 3 || gltf.materials[standMesh.primitives[1].material].name !== '材质.015') throw new Error('Unexpected infusion primitive contract');
const bottle = addNode({ ...stand, name: 'InfusionBottle', mesh: primitiveMesh(standMesh, [1], 'InfusionBottle') });
stand.name = 'IVStand';
stand.mesh = primitiveMesh(standMesh, [0, 2], 'IVStandFrameAndBase');
group('InfusionEquipment', [bottle, rename('液体', 'InfusionLiquid'), rename('NURBS路径', 'InfusionTube')]);
const anchor = [-1.760222, 0.903284, -0.070125];
const normalized = addNode({ name: 'BedSourceOrigin', children: [...roots], translation: [anchor[2], -anchor[1], -anchor[0]], rotation: [0, -Math.SQRT1_2, 0, Math.SQRT1_2] });
const sha256 = createHash('sha256').update(file).digest('hex');
gltf.scenes = [{ name: 'BedUnitV3', nodes: [addNode({ name: 'BedUnit', children: [normalized], extras: { sourceSha256: sha256, source: 'onlyBed-v3(1).glb', sourceAnchor: anchor } })] }];
gltf.scene = 0;
const json = Buffer.from(JSON.stringify(gltf));
const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20); json.copy(padded);
const header = Buffer.alloc(20); header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(20 + padded.length + remainder.length, 8); header.writeUInt32LE(padded.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
writeFileSync(destination, Buffer.concat([header, padded, remainder]));
console.log(JSON.stringify({ sourceSha256: sha256, output: destination, bytes: 20 + padded.length + remainder.length, binaryPreserved: true }));
