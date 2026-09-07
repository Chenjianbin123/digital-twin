import * as THREE from 'three';
import { wardCorridorSceneConfig } from '../config/ward-corridor-scene.ts';

export interface WardCorridorBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface WardCorridorCameraView {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
}

/** Raw interior shell from named meshes, before config margins. */
export interface WardCorridorRawBoundMeshes {
  floorMaxY: number;
  ceilingMinY: number;
  /** Inner wall faces on the corridor width axis. */
  wallMin: number;
  wallMax: number;
  /** Floor extent on the corridor length axis. */
  lengthMin: number;
  lengthMax: number;
  /** Which world axis the two side walls face across. */
  widthAxis: 'x' | 'z';
}

export function getWardCorridorCameraView(bounds: WardCorridorBounds): WardCorridorCameraView {
  const viewConfig = wardCorridorSceneConfig.camera.modelBoundsView;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const corridorWidth = bounds.maxX - bounds.minX;
  const corridorLength = bounds.maxZ - bounds.minZ;
  const cameraInset = Math.min(4.2, Math.max(2.4, corridorLength * 0.07));
  const targetInset = Math.min(18, Math.max(10, corridorLength * 0.32));
  return {
    position: {
      x: centerX + Math.min(4.2, Math.max(2.2, corridorWidth * 0.1)),
      y: Math.min(bounds.maxY - viewConfig.y.topOffset, Math.max(bounds.minY + viewConfig.y.floorOffset, viewConfig.y.min)),
      z: bounds.maxZ - cameraInset,
    },
    target: {
      x: centerX,
      y: Math.min(bounds.maxY - viewConfig.targetY.topOffset, viewConfig.targetY.max),
      z: bounds.maxZ - targetInset,
    },
  };
}

/**
 * Read 地板 / 天花板 / 墙壁 / 墙壁2 into a raw interior volume.
 * World-space boxes, so call after the corridor model transform is applied.
 */
export function captureWardCorridorBoundMeshes(
  model: THREE.Object3D,
  names = wardCorridorSceneConfig.camera.viewBounds,
): WardCorridorRawBoundMeshes | null {
  model.updateMatrixWorld(true);
  const floor = model.getObjectByName(names.floorMesh);
  const ceiling = model.getObjectByName(names.ceilingMesh);
  const wallA = model.getObjectByName(names.wallMeshes[0]);
  const wallB = model.getObjectByName(names.wallMeshes[1]);
  if (!floor || !ceiling || !wallA || !wallB)
    return null;

  const floorBox = new THREE.Box3().setFromObject(floor);
  const ceilingBox = new THREE.Box3().setFromObject(ceiling);
  const boxA = new THREE.Box3().setFromObject(wallA);
  const boxB = new THREE.Box3().setFromObject(wallB);
  const centerA = boxA.getCenter(new THREE.Vector3());
  const centerB = boxB.getCenter(new THREE.Vector3());

  const floorMaxY = floorBox.max.y;
  const ceilingMinY = ceilingBox.min.y;
  if (!(floorMaxY < ceilingMinY))
    return null;

  const widthAxis: 'x' | 'z' = Math.abs(centerA.x - centerB.x) >= Math.abs(centerA.z - centerB.z)
    ? 'x'
    : 'z';

  let wallMin: number;
  let wallMax: number;
  let lengthMin: number;
  let lengthMax: number;

  if (widthAxis === 'x') {
    const left = centerA.x < centerB.x ? boxA : boxB;
    const right = centerA.x < centerB.x ? boxB : boxA;
    wallMin = left.max.x;
    wallMax = right.min.x;
    lengthMin = floorBox.min.z;
    lengthMax = floorBox.max.z;
  }
  else {
    const near = centerA.z < centerB.z ? boxA : boxB;
    const far = centerA.z < centerB.z ? boxB : boxA;
    wallMin = near.max.z;
    wallMax = far.min.z;
    lengthMin = floorBox.min.x;
    lengthMax = floorBox.max.x;
  }

  if (!(wallMin < wallMax) || !(lengthMin < lengthMax))
    return null;

  return {
    floorMaxY,
    ceilingMinY,
    wallMin,
    wallMax,
    lengthMin,
    lengthMax,
    widthAxis,
  };
}

/** Apply config margins to produce the camera-movable AABB. */
export function getWardCorridorPaddedBounds(
  raw: WardCorridorRawBoundMeshes,
  margins = wardCorridorSceneConfig.camera.viewBounds.margins,
): WardCorridorBounds | null {
  const { floor, ceiling, wall, depth } = margins;
  const minY = raw.floorMaxY + floor;
  const maxY = raw.ceilingMinY - ceiling;
  const wallMin = raw.wallMin + wall;
  const wallMax = raw.wallMax - wall;
  const lengthMin = raw.lengthMin + depth;
  const lengthMax = raw.lengthMax - depth;

  if (!(minY < maxY) || !(wallMin < wallMax) || !(lengthMin < lengthMax))
    return null;

  if (raw.widthAxis === 'x') {
    return {
      minX: wallMin,
      maxX: wallMax,
      minY,
      maxY,
      minZ: lengthMin,
      maxZ: lengthMax,
    };
  }

  return {
    minX: lengthMin,
    maxX: lengthMax,
    minY,
    maxY,
    minZ: wallMin,
    maxZ: wallMax,
  };
}

export function clampPointToWardCorridorBounds(
  point: THREE.Vector3,
  bounds: WardCorridorBounds,
): THREE.Vector3 {
  point.x = THREE.MathUtils.clamp(point.x, bounds.minX, bounds.maxX);
  point.y = THREE.MathUtils.clamp(point.y, bounds.minY, bounds.maxY);
  point.z = THREE.MathUtils.clamp(point.z, bounds.minZ, bounds.maxZ);
  return point;
}
