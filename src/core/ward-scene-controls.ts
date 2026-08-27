import { wardInteriorSceneConfig } from '../config/ward-interior-scene.ts';

export interface WardSceneControlLimits {
  minPolarAngle: number;
  maxPolarAngle: number;
  minAzimuthAngle: number;
  maxAzimuthAngle: number;
  minDistance: number;
  maxDistance: number;
}

export function resolveWardSceneControlLimits(
  roomWidth: number,
  roomDepth: number,
): WardSceneControlLimits {
  const span = Math.max(roomWidth, roomDepth);
  const controls = wardInteriorSceneConfig.controls;
  return {
    minPolarAngle: controls.minPolarAngle,
    maxPolarAngle: controls.maxPolarAngle,
    minAzimuthAngle: controls.minAzimuthAngle,
    maxAzimuthAngle: controls.maxAzimuthAngle,
    minDistance: controls.minDistance,
    maxDistance: Math.max(controls.maxDistanceBase, span * controls.maxDistanceSpanFactor),
  };
}
