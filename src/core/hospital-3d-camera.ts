import * as THREE from 'three';

/** Fit projected world bounds instead of using an arbitrary distance shared by both models. */
export function hospitalCameraFrame(bounds: THREE.Box3, direction: THREE.Vector3, aspect: number) {
  const target = bounds.getCenter(new THREE.Vector3());
  const forward = direction.clone().normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();
  const up = new THREE.Vector3().crossVectors(forward, right).normalize();
  let halfWidth = 0, halfHeight = 0;
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const point = new THREE.Vector3(x, y, z).sub(target);
    halfWidth = Math.max(halfWidth, Math.abs(point.dot(right)));
    halfHeight = Math.max(halfHeight, Math.abs(point.dot(up)));
  }
  const height = Math.max(halfHeight * 2, halfWidth * 2 / Math.max(aspect, .1)) / .95;
  const distance = Math.max(10, bounds.getSize(new THREE.Vector3()).length() * 2);
  return { target, position: target.clone().addScaledVector(forward, distance), height };
}
