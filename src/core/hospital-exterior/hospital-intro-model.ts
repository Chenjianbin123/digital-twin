import * as THREE from 'three';
import { ExteriorGeometry, addArchitecturalSign } from './hospital-exterior-geometry';
import { createExteriorMaterials } from './hospital-exterior-materials';
import { addExteriorLandscape } from './hospital-exterior-landscape';

/** Shared exterior model for the login introduction and its standalone preview. */
export function createHospitalExterior() {
  const builder = new ExteriorGeometry();
  const m = createExteriorMaterials();
  const box = builder.box.bind(builder);

  function tower(x: number, z: number, w: number, d: number, floors: number) {
    const height = floors * 3.1;
    box(w, height, d, x, height / 2, z, m.stone);
    // Recessed glazing sits between solid end piers; both visible sides get full detail.
    for (const side of [-1, 1]) {
      const faceZ = z + side * (d / 2 + .035);
      for (let floor = 0; floor < floors; floor++) {
        const base = floor * 3.1;
        box(w - 3.4, .58, .13, x, base + .35, faceZ, m.spandrel);
        box(w - 3.3, .12, .26, x, base + .68, faceZ + side * .07, m.aluminium);
        box(w - 3.3, .08, .25, x, base + 3.02, faceZ + side * .07, m.aluminium);
        const bays = Math.floor((w - 3.6) / 1.5), bayWidth = (w - 3.6) / bays;
        for (let bay = 0; bay < bays; bay++) {
          const wx = x - (w - 3.6) / 2 + (bay + .5) * bayWidth;
          box(bayWidth - .07, 2.22, .1, wx, base + 1.85, faceZ, m.glass);
          box(.065, 2.4, .24, wx - bayWidth / 2, base + 1.82, faceZ + side * .08, m.aluminium);
          box(bayWidth, .055, .17, wx, base + 2.47, faceZ + side * .095, m.aluminium);
          if ((bay + floor * 3) % 8 === 0) {
            // Thin internal blind silhouettes add variation without random glass colours.
            for (let slat = 0; slat < 5; slat++) box(bayWidth - .12, .022, .025, wx, base + 1.12 + slat * .16, faceZ + side * .065, m.bronze);
          }
        }
        box(w + .18, .16, .36, x, base + .04, faceZ, m.paleStone);
        for (const edge of [-1, 1]) for (let panel = 0; panel < 3; panel++)
          box(1.62, .016, .018, x + edge * (w / 2 - .83), base + panel * 1.03, faceZ + side * .005, m.joint);
      }
      for (let rib = -w / 2 + 1.7; rib <= w / 2 - 1.5; rib += 6.5) {
        box(.18, height, .52, x + rib, height / 2, faceZ + side * .15, m.paleStone);
        box(.045, height, .55, x + rib + .11, height / 2, faceZ + side * .15, m.bronze);
      }
      const faceX = x + side * (w / 2 + .04);
      for (let floor = 0; floor < floors; floor++) {
        const base = floor * 3.1;
        for (let wz = -d / 2 + 1.5; wz < d / 2 - .8; wz += 2.4) {
          box(.16, 2.37, 1.96, faceX, base + 1.72, z + wz, m.aluminium);
          box(.18, 2.16, 1.74, faceX + side * .025, base + 1.72, z + wz, m.glass);
          box(.24, 2.25, .05, faceX + side * .04, base + 1.72, z + wz, m.aluminium);
          box(.25, .055, 1.82, faceX + side * .05, base + 2.22, z + wz, m.aluminium);
          box(.5, .12, 2.16, faceX, base + .52, z + wz, m.paleStone);
        }
        box(.03, .018, d, faceX, base + .06, z, m.joint);
      }
      for (let seam = -d / 2 + 1; seam < d / 2; seam += 1.2)
        box(.025, height, .012, faceX, height / 2, z + seam, m.joint);
    }
    // Layered roof parapet hides plant-room equipment from the approach.
    box(w + .5, .25, d + .5, x, height + .03, z, m.paleStone);
    box(w - 1, .12, d - 1, x, height + .19, z, m.joint);
    for (const side of [-1, 1]) {
      box(w, .7, .24, x, height + .5, z + side * (d / 2 - .14), m.paleStone);
      box(.24, .7, d, x + side * (w / 2 - .14), height + .5, z, m.paleStone);
    }
    box(w * .58, 1.5, d * .45, x, height + .95, z - 1, m.limestone);
    for (let louver = 0; louver < 8; louver++) box(w * .58 + .1, .05, .07, x, height + .35 + louver * .16, z - 1 + d * .225, m.aluminium);
  }

  tower(-7, -7, 36, 15, 10);
  tower(20, -3, 14, 23, 8);
  tower(-27, -2, 11, 20, 6);

  // A double-height outpatient podium, with warm stone wings and a glazed central hall.
  box(54, 6.9, 13.9, 0, 3.45, 7, m.stone);
  box(54.7, .3, 14.6, 0, 7.04, 7, m.paleStone);
  box(54.1, .15, .28, 0, 6.6, 14.1, m.bronze);
  for (const side of [-1, 1]) {
    box(54.4, .28, .18, 0, 7.31, 7 + side * 7.05, m.paleStone);
    box(.18, .28, 14.2, side * 27.15, 7.31, 7, m.paleStone);
    box(11, .18, 2.8, side * 18, 7.3, 11, m.limestone);
    box(10.6, .15, 2.4, side * 18, 7.46, 11, m.grass);
    for (let x = 14; x < 22; x += .4) box(.055, .03, 1.8, side * x, 7.23, 6, m.aluminium);
  }
  for (const side of [-1, 1]) {
    for (let x = 13; x < 27; x += 2.6) {
      box(2.3, 4.1, .18, side * x, 2.7, 14.04, m.aluminium);
      box(2.12, 3.9, .2, side * x, 2.7, 14.09, m.glass);
      box(.07, 3.95, .25, side * x, 2.7, 14.16, m.aluminium);
      box(2.3, .07, .25, side * x, 3.45, 14.16, m.aluminium);
    }
    for (let seam = .8; seam <= 6.5; seam += .85) box(15, .018, .025, side * 19.5, seam, 14.02, m.joint);
    for (let x = 12; x <= 27; x += 1.3) box(.016, 6.8, .025, side * x, 3.4, 14.02, m.joint);
    for (let x = 22; x < 27; x += .45) box(.065, 5.4, .55, side * x, 3.2, 14.3, m.bronze);
  }
  box(23.4, 5.85, .24, 0, 3.04, 14.15, m.glass);
  for (let x = -11.5; x <= 11.5; x += 1.44) box(.08, 6.1, .4, x, 3.05, 14.38, m.aluminium);
  for (const y of [1, 3.1, 5.6]) box(23.4, .08, .4, 0, y, 14.38, m.aluminium);
  // Entrance portals, handles and safety bands remain legible in the final camera shot.
  for (const x of [-4.4, 0, 4.4]) {
    box(3.8, 3.65, .55, x, 1.82, 14.5, m.dark);
    box(3.55, 3.38, .2, x, 1.74, 14.81, m.glass);
    box(.075, 3.4, .2, x, 1.74, 14.94, m.steel);
    box(3.5, .095, .025, x, 1.3, 14.94, m.white);
    for (const dx of [-.18, .18]) box(.035, .52, .11, x + dx, 1.2, 15.02, m.steel);
  }
  box(24.4, .24, 8.2, 0, 5.35, 18, m.aluminium);
  box(23.8, .12, 7.6, 0, 5.5, 18, m.glass);
  box(24.6, .42, .24, 0, 5.33, 22.12, m.bronze);
  for (const side of [-1, 1]) box(.22, .4, 8.3, side * 12.2, 5.33, 18, m.bronze);
  for (let x = -11; x <= 11; x += 2.2) {
    box(.12, .36, 7.8, x, 5.1, 18, m.dark);
    box(.035, .035, 6.4, x + .14, 4.9, 18, m.light);
  }
  for (const x of [-10.8, 10.8]) {
    box(.28, 5, .28, x, 2.5, 20.8, m.steel);
    box(.58, .18, .58, x, .16, 20.8, m.limestone);
  }
  box(26, .15, 9, 0, .02, 18.5, m.paving);
  box(26, .08, .22, 0, .045, 23, m.dark);
  for (let x = -12.5; x <= 12.5; x += .14) box(.04, .025, .24, x, .1, 23, m.steel);
  addArchitecturalSign(builder.root, '门诊 · 住院服务中心', 'OUTPATIENT & INPATIENT SERVICES', 18.5, 1.15, 0, 6.17, 14.75);

  // Solid sign tower breaks the repetitive facade and gives the hospital an identity.
  box(3.6, 27, .44, -22.5, 17.5, 1.0, m.paleStone);
  for (let y = 4; y < 31; y += 1.1) box(3.6, .015, .035, -22.5, y, 1.235, m.joint);
  addArchitecturalSign(builder.root, '仁和医院', 'RENHE MEDICAL CENTER', 12.8, 2.05, -5.5, 29.5, .84);
  for (const [letter, y] of [['住', 25], ['院', 22.3], ['部', 19.6]] as const)
    addArchitecturalSign(builder.root, letter, '', 1.55, 1.4, -22.5, y, 1.24);
  box(2.35, 2.35, .22, 20, 21.25, 8.72, m.paleStone);
  box(.36, 1.65, .28, 20, 21.25, 8.9, m.teal); box(1.65, .36, .28, 20, 21.25, 8.9, m.teal);

  addExteriorLandscape(builder, m);
  const context = new THREE.MeshStandardMaterial({ color: 0xc3ccca, roughness: .9 });
  const contextWindows = new THREE.MeshStandardMaterial({ color: 0xa6b4b5, roughness: .65 });
  for (let i = 0; i < 7; i++) {
    const x = -80 + i * 25, z = -90 - i % 2 * 12, h = 10 + i % 4 * 5;
    box(15, h, 14, x, h / 2, z, context);
    for (let y = 2; y < h - 1; y += 3) box(13, 1.45, .05, x, y, z + 7.04, contextWindows);
  }
  return builder.finish();
}
