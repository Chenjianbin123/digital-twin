import * as THREE from 'three';
import { ExteriorGeometry, addArchitecturalSign } from './hospital-exterior-geometry';
import { seededRandom, type ExteriorMaterials } from './hospital-exterior-materials';

export function addExteriorLandscape(builder: ExteriorGeometry, m: ExteriorMaterials) {
  const box = builder.box.bind(builder);
  const random = seededRandom(923);
  const leafMatrices: THREE.Matrix4[] = [];
  const branchMatrices: THREE.Matrix4[] = [];
  const transform = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1, 0);
  function branch(a: THREE.Vector3, b: THREE.Vector3, radius: number) {
    transform.position.copy(a).add(b).multiplyScalar(.5);
    transform.scale.set(radius, a.distanceTo(b), radius);
    transform.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize());
    transform.updateMatrix(); branchMatrices.push(transform.matrix.clone());
  }
  function foliage(x: number, y: number, z: number, sx: number, sy: number, sz: number, count: number) {
    for (let i = 0; i < count; i++) {
      const a = random() * Math.PI * 2, u = random() * 2 - 1, r = Math.cbrt(random());
      const ring = Math.sqrt(1 - u * u);
      transform.position.set(x + Math.cos(a) * ring * r * sx, y + u * r * sy, z + Math.sin(a) * ring * r * sz);
      transform.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
      const s = .7 + random() * .65; transform.scale.set(s, s, s);
      transform.updateMatrix(); leafMatrices.push(transform.matrix.clone());
    }
  }
  function tree(x: number, z: number, height: number) {
    const base = new THREE.Vector3(x, .1, z), fork = new THREE.Vector3(x + .12, height * .52, z);
    branch(base, fork, .18);
    for (let i = 0; i < 5; i++) {
      const angle = i * 2.4;
      const tip = new THREE.Vector3(x + Math.sin(angle) * height * .25, height * (.68 + random() * .2), z + Math.cos(angle) * height * .23);
      branch(fork, tip, .06);
      foliage(tip.x, tip.y, tip.z, height * .24, height * .21, height * .24, 48);
    }
    // Tree grates and a pale edging make each tree part of the designed plaza.
    box(1.3, .035, 1.3, x, .17, z, m.dark);
    for (let i = -4; i <= 4; i++) box(.045, .04, 1.2, x + i * .13, .2, z, m.bronze);
  }
  box(420, .25, 420, 0, -.6, 0, m.grass);
  box(110, .32, 64, 0, -.13, 0, m.paving);
  box(150, .07, 11.8, 0, -.1, 38, m.asphalt);
  for (const z of [31.7, 44.3]) box(145, .18, .32, 0, .01, z, m.paleStone);
  for (let x = -70; x < 70; x += 7) box(3, .016, .1, x, -.055, 38, m.white);
  for (let x = -4; x <= 4; x += 1.25) box(.65, .02, 9, x, -.05, 38, m.white);
  for (const z of [32.5, 43.5]) for (let x = -4; x <= 4; x += .4) box(.22, .04, .6, x, .06, z, m.bronze);
  // Long paved approach; repeating seams remain visible during the final close shot.
  for (const side of [-1, 1]) {
    box(21, .48, 8.4, side * 25, .13, 24.8, m.limestone);
    box(20.5, .08, 7.9, side * 25, .4, 24.8, m.soil);
    box(19.8, .12, 7.1, side * 25, .44, 24.8, m.grass);
    for (let i = 0; i < 4; i++) tree(side * (18 + i * 4.5), 25.2, 5.8 + random() * 1.6);
    for (let i = 0; i < 6; i++) foliage(side * (16.5 + i * 3.3), .85, 21.8, 1.7, .45, .65, 24);
    for (let i = 0; i < 4; i++) tree(side * 42, -19 + i * 11, 6.5 + random());
    box(24, .23, 7, side * 24, -.18, 49, m.limestone);
    box(23.5, .18, 6.5, side * 24, -.06, 49, m.grass);
    for (let i = 0; i < 3; i++) tree(side * (16 + i * 8), 49.5, 6.2);
    for (const z of [17, 30]) {
      box(3.6, .13, .8, side * 12, .58, z, m.wood);
      for (const dx of [-1.4, 1.4]) box(.12, .5, .65, side * 12 + dx, .3, z, m.dark);
      for (let dx = -1.5; dx <= 1.5; dx += .22) box(.04, .018, .82, side * 12 + dx, .66, z, m.dark);
    }
  }
  const branches = new THREE.InstancedMesh(new THREE.CylinderGeometry(.65, 1, 1, 8), m.bark, branchMatrices.length);
  branchMatrices.forEach((matrix, i) => branches.setMatrixAt(i, matrix));
  branches.castShadow = true; branches.receiveShadow = true; builder.root.add(branches);
  const leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), m.leaf, leafMatrices.length);
  leafMatrices.forEach((matrix, i) => { leaves.setMatrixAt(i, matrix); leaves.setColorAt(i, new THREE.Color().setHSL(.22 + random() * .025, .16, .68 + random() * .25)); });
  leaves.castShadow = true; leaves.receiveShadow = true; builder.root.add(leaves);
  for (const x of [-37, -13, 13, 37]) {
    box(.16, 4.5, .16, x, 2.2, 30, m.dark);
    box(1.35, .12, .4, x + .55, 4.45, 30, m.dark);
    box(1.12, .035, .28, x + .55, 4.37, 30, m.light);
  }
  for (const x of [-9, -6, 6, 9]) { box(.16, .85, .16, x, .4, 22.5, m.steel); box(.18, .1, .18, x, .7, 22.5, m.light); }
  // Monument signage is on the camera-facing side of the campus.
  box(3.1, 4.5, .65, 33, 2.2, 29, m.dark);
  addArchitecturalSign(builder.root, '仁和医院', 'RENHE MEDICAL CENTER', 2.9, .7, 33, 3.55, 29.34, true);
  for (const [label, y] of [['门诊  →', 2.5], ['住院  →', 1.8], ['停车  →', 1.1]] as const)
    addArchitecturalSign(builder.root, label, '', 2.4, .48, 33, y, 29.34, true);

  // Small vehicles use shaped bodywork, cylindrical tyres and inset glazing.
  const wheelGeometry = new THREE.CylinderGeometry(.35, .35, .2, 20);
  const hubGeometry = new THREE.CylinderGeometry(.2, .2, .22, 16);
  function car(x: number, z: number, color: number) {
    const paint = new THREE.MeshPhysicalMaterial({ color, metalness: .48, roughness: .24, clearcoat: 1 });
    const outline = new THREE.Shape(); outline.moveTo(-2.2, .38); outline.lineTo(-2.15, .85);
    outline.quadraticCurveTo(-2, 1, -1.25, 1.04); outline.lineTo(-.7, 1.55); outline.quadraticCurveTo(.3, 1.7, .9, 1.42);
    outline.lineTo(1.4, 1.05); outline.lineTo(2.1, .95); outline.lineTo(2.2, .4); outline.closePath();
    const geometry = new THREE.ExtrudeGeometry(outline, { depth: 1.75, bevelEnabled: true, bevelSize: .09, bevelThickness: .09, bevelSegments: 2, steps: 1, curveSegments: 6 });
    const body = new THREE.Mesh(geometry, paint); body.rotation.y = Math.PI / 2; body.position.set(x - .875, 0, z); body.castShadow = true; builder.root.add(body);
    box(1.55, .46, 1.8, x, 1.28, z, m.glass);
    box(1.58, .12, 1.55, x, 1.62, z, paint);
    for (const side of [-1, 1]) {
      box(.035, .4, 1.7, x + side * .98, 1.28, z, m.glass);
      box(.05, .44, .065, x + side * 1.0, 1.28, z, m.aluminium);
      for (const dz of [-1.4, 1.35]) {
        for (const [geo, mat] of [[wheelGeometry, m.rubber], [hubGeometry, m.steel]] as const) {
          const wheel = new THREE.Mesh(geo, mat); wheel.rotation.z = Math.PI / 2; wheel.position.set(x + side * .96, .38, z + dz); wheel.castShadow = true; builder.root.add(wheel);
        }
      }
      box(.45, .13, .1, x + side * .55, .79, z + 2.17, m.light);
    }
  }
  car(-38, 15, 0xd6d9d7); car(-38, 21, 0x36525c); car(39, 17, 0xb1b6b5);
  for (let i = 0; i < 5; i++) {
    for (const x of [-38, 39]) box(3.3, .016, .08, x, .05, 10 + i * 5.5, m.white);
  }
}
