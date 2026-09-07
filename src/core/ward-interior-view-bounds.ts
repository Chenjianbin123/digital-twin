import * as THREE from 'three';
import { wardInteriorSceneConfig } from '../config/ward-interior-scene.ts';

export interface WardInteriorBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

/** Raw shell/light boxes before config margins. */
export interface WardInteriorRawBoundMeshes {
  shellMinX: number;
  shellMaxX: number;
  shellMinY: number;
  shellMaxY: number;
  shellMinZ: number;
  shellMaxZ: number;
  /** Bottom of the ceiling light mesh; camera must stay below this. */
  lightMinY: number;
}

/**
 * Read 外壳 + 灯 into a raw interior volume.
 * Call after the ward interior model transform is applied.
 */
export function captureWardInteriorBoundMeshes(
  model: THREE.Object3D,
  names = wardInteriorSceneConfig.camera.viewBounds,
): WardInteriorRawBoundMeshes | null {
  model.updateMatrixWorld(true);
  const shell = model.getObjectByName(names.shellMesh);
  const light = model.getObjectByName(names.lightMesh);
  if (!shell || !light)
    return null;

  const shellBox = new THREE.Box3().setFromObject(shell);
  const lightBox = new THREE.Box3().setFromObject(light);
  if (shellBox.isEmpty() || lightBox.isEmpty())
    return null;
  if (!(shellBox.min.x < shellBox.max.x) || !(shellBox.min.y < shellBox.max.y) || !(shellBox.min.z < shellBox.max.z))
    return null;

  return {
    shellMinX: shellBox.min.x,
    shellMaxX: shellBox.max.x,
    shellMinY: shellBox.min.y,
    shellMaxY: shellBox.max.y,
    shellMinZ: shellBox.min.z,
    shellMaxZ: shellBox.max.z,
    lightMinY: lightBox.min.y,
  };
}

/** Apply config margins to produce the camera-movable AABB. */
export function getWardInteriorPaddedBounds(
  raw: WardInteriorRawBoundMeshes,
  margins = wardInteriorSceneConfig.camera.viewBounds.margins,
): WardInteriorBounds | null {
  const { floor, ceiling, wall, depth } = margins;
  const minX = raw.shellMinX + wall;
  const maxX = raw.shellMaxX - wall;
  const minZ = raw.shellMinZ + depth;
  const maxZ = raw.shellMaxZ - depth;
  const minY = raw.shellMinY + floor;
  const maxY = Math.min(raw.shellMaxY, raw.lightMinY) - ceiling;

  if (!(minX < maxX) || !(minY < maxY) || !(minZ < maxZ))
    return null;

  return { minX, maxX, minY, maxY, minZ, maxZ };
}

export function clampPointToWardInteriorBounds(
  point: THREE.Vector3,
  bounds: WardInteriorBounds,
): THREE.Vector3 {
  point.x = THREE.MathUtils.clamp(point.x, bounds.minX, bounds.maxX);
  point.y = THREE.MathUtils.clamp(point.y, bounds.minY, bounds.maxY);
  point.z = THREE.MathUtils.clamp(point.z, bounds.minZ, bounds.maxZ);
  return point;
}
