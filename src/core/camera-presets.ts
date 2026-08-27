import type { CameraPresetId } from '@/types/twin';
import { wardInteriorSceneConfig } from '../config/ward-interior-scene.ts';

export interface CameraPreset {
  id: CameraPresetId;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
}

export const CAMERA_PRESETS: CameraPreset[] = wardInteriorSceneConfig.camera.presets.map(preset => ({
  ...preset,
  position: [...preset.position],
  target: [...preset.target],
}));

export function getCameraPreset(id: CameraPresetId): CameraPreset {
  return CAMERA_PRESETS.find(p => p.id === id) ?? CAMERA_PRESETS[0];
}

export function resolveWardCameraViewportScale(aspect: number): number {
  if (!Number.isFinite(aspect) || aspect <= 0)
    return 1;
  const viewportScale = wardInteriorSceneConfig.camera.viewportScale;
  return Math.min(viewportScale.max, Math.max(viewportScale.min, viewportScale.referenceAspect / aspect));
}
