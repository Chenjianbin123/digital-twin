import type { CameraPresetId } from '@/types/twin';

export interface WardInteriorSceneConfig {
  model: {
    url: string;
    baseSize: { width: number; height: number; depth: number };
    canvasTextureFlipY: boolean;
  };
  room: { height: number };
  camera: {
    perspective: { fov: number; near: number; far: number };
    initial: {
      position: readonly [number, number, number];
      target: readonly [number, number, number];
    };
    presets: readonly {
      id: CameraPresetId;
      label: string;
      position: readonly [number, number, number];
      target: readonly [number, number, number];
    }[];
    viewportScale: { referenceAspect: number; min: number; max: number };
    presetTransitionDuration: number;
    bedFocusTransitionDuration: number;
  };
  controls: {
    dampingFactor: number;
    zoomSpeed: number;
    rotateSpeed: number;
    minPolarAngle: number;
    maxPolarAngle: number;
    minAzimuthAngle: number;
    maxAzimuthAngle: number;
    minDistance: number;
    maxDistanceBase: number;
    maxDistanceSpanFactor: number;
  };
  appearance: {
    background: number;
    exposure: number;
    baseFogDensity: number;
    fogSpanFactor: number;
    envMapIntensity: number;
    environmentIntensity: number;
    /** Cap glTF metalness so bright plastics/whites don't go black without a studio HDRI. */
    maxMetalness: number;
  };
  modelBedLayout: {
    baseWidth: number;
    backOffset: number;
    horizontalMargin: number;
    minScale: number;
    maxScale: number;
    maxBeds: number;
  };
}

/** 病房内部模型、镜头、交互和床位排布参数。业务数据与模型节点校验不在此配置。 */
export const wardInteriorSceneConfig: WardInteriorSceneConfig = {
  model: {
    url: '/models/smart-ward-interior/room-v1.glb?v=20260901-room-v1-native',
    baseSize: { width: 12, height: 3.92, depth: 9 },
    canvasTextureFlipY: false,
  },
  room: { height: 4.2 },
  camera: {
    perspective: { fov: 45, near: 0.1, far: 100 },
    initial: { position: [0.819, 1.313, 5.265], target: [0, 1, -0.8] },
    presets: [
      { id: 'free', label: '自由视角', position: [0.819, 1.313, 5.265], target: [0, 1, -0.8] },
      { id: 'door', label: '门口视角', position: [0.819, 1.313, 5.265], target: [0, 1, -0.8] },
      { id: 'nurse', label: '巡视视角', position: [8.8, 5.8, 6.8], target: [0, 0.9, -1.6] },
      { id: 'top', label: '俯视视角', position: [0, 18, 0.01], target: [0, 0, 0] },
    ],
    viewportScale: { referenceAspect: 0.92, min: 1, max: 2 },
    presetTransitionDuration: 0.75,
    bedFocusTransitionDuration: 0.62,
  },
  controls: {
    dampingFactor: 0.06,
    zoomSpeed: 1.2,
    rotateSpeed: 0.85,
    minPolarAngle: 0.05,
    maxPolarAngle: Math.PI - 0.05,
    minAzimuthAngle: -Infinity,
    maxAzimuthAngle: Infinity,
    minDistance: 1.1,
    maxDistanceBase: 48,
    maxDistanceSpanFactor: 2.5,
  },
  appearance: {
    background: 0xd8d2c8,
    exposure: 1.12,
    baseFogDensity: 0,
    fogSpanFactor: 0,
    envMapIntensity: 0.3,
    environmentIntensity: 0.36,
    maxMetalness: 0.78,
  },
  modelBedLayout: {
    baseWidth: 3.92,
    backOffset: 2.71,
    horizontalMargin: 1,
    minScale: 0.7,
    maxScale: 1,
    maxBeds: 6,
  },
};

