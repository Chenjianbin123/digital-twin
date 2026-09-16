import * as THREE from 'three';
import type { WardInteriorBounds } from './ward-interior-view-bounds.ts';
import { clampPointToWardInteriorBounds } from './ward-interior-view-bounds.ts';

/** Fit within the existing room; never move outside walls to obtain a wider shot. */
export function frameWardSubjects(subject: THREE.Box3, room: WardInteriorBounds, aspect: number, focus = false) {
  const center = subject.getCenter(new THREE.Vector3());
  const corners: THREE.Vector3[] = [];
  for (const x of [subject.min.x, subject.max.x])
    for (const y of [subject.min.y, subject.max.y])
      for (const z of [subject.min.z, subject.max.z]) corners.push(new THREE.Vector3(x, y, z));
  const safeAspect = Math.max(0.2, aspect);
  const positions = focus
    ? [1.6, -1.6, 2.2, -2.2].map(dz => new THREE.Vector3(room.maxX - 0.08, Math.min(room.maxY - 0.05, center.y + 1), center.z + dz))
    : [room.maxZ - 0.08, room.minZ + 0.08].map(z => new THREE.Vector3(room.maxX - 0.08, room.maxY - 0.35, z));
  let best: { position: THREE.Vector3; target: THREE.Vector3; fov: number; requiredFov: number; score: number } | null = null;
  for (const position of positions) {
    clampPointToWardInteriorBounds(position, room);
    for (const fraction of focus ? [0.5] : [0.25, 0.4, 0.5, 0.6, 0.75]) {
      const target = center.clone();
      if (!focus) target.y -= 0.18;
      target.z = THREE.MathUtils.lerp(subject.min.z, subject.max.z, fraction);
      clampPointToWardInteriorBounds(target, room);
      const view = new THREE.PerspectiveCamera(67, safeAspect, 0.1, 200);
      view.position.copy(position); view.lookAt(target); view.updateMatrixWorld();
      let tangent = 0;
      for (const corner of corners) {
        const local = corner.clone().applyMatrix4(view.matrixWorldInverse);
        const depth = Math.max(0.05, -local.z);
        tangent = Math.max(tangent, Math.abs(local.y) / depth, Math.abs(local.x) / (depth * safeAspect));
      }
      const requiredFov = THREE.MathUtils.radToDeg(2 * Math.atan(tangent * 1.12));
      // Prefer the entrance end when both fit equally well, to keep orientation familiar.
      const score = requiredFov + (!focus && position.z < center.z ? 3 : 0);
      if (!best || score < best.score) best = {
        position: position.clone(), target, requiredFov, score,
        fov: THREE.MathUtils.clamp(requiredFov, focus ? 52 : 60, 95),
      };
    }
  }
  return best!;
}
