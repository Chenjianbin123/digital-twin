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
