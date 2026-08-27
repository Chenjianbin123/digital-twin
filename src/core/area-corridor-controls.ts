import { wardCorridorSceneConfig } from '../config/ward-corridor-scene.ts';

export interface AreaCorridorControlLimits {
  minPolarAngle: number;
  maxPolarAngle: number;
  minAzimuthAngle: number;
  maxAzimuthAngle: number;
  minDistance: number;
  maxDistance: number;
}

export function resolveAreaCorridorControlLimits(corridorLength: number): AreaCorridorControlLimits {
  const controls = wardCorridorSceneConfig.controls;
  return {
    minPolarAngle: controls.minPolarAngle,
    maxPolarAngle: controls.maxPolarAngle,
    minAzimuthAngle: controls.minAzimuthAngle,
    maxAzimuthAngle: controls.maxAzimuthAngle,
    minDistance: controls.minDistance,
    maxDistance: Math.max(controls.maxDistanceBase, corridorLength * controls.maxDistanceLengthFactor),
  };
}
