import type { CameraPresetId } from '@/types/twin';

export interface WardInteriorSceneConfig {
  modular: {
    unitUrl: string;
    slots: readonly { position: readonly [number, number, number]; rotationY: number }[];
    hiddenRoomNodes: readonly string[];
    sharedEquipmentOffset: readonly [number, number, number];
  };
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
    /**
     * 视角硬边界取自 GLB 网格：
     * 水平/地面/纵深=外壳包围盒，顶部=灯底部（与外壳取较低者）。
     */
    viewBounds: {
      shellMesh: string;
      lightMesh: string;
      margins: {
        floor: number;
        ceiling: number;
        wall: number;
        depth: number;
      };
    };
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
    pan: {
      xSpanFactor: number;
      zSpanFactor: number;
      yMin: number;
      yMax: number;
    };
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
  modular: {
    unitUrl: '/models/smart-ward-interior/bed-refined-v1.glb?v=20260915',
    // Validated native double-room slots. Additional occupants extend the room while keeping these native bed proportions.
    slots: [
      { position: [-1.670222, 0.903284, -0.070125], rotationY: Math.PI / 2 },
      { position: [-1.670222, 0.903284, 2.301], rotationY: Math.PI / 2 },
    ],
    hiddenRoomNodes: ['Medicinal_Props.020_Medical_Props_0.005', 'Medicinal_Props.020_Medical_Props_0.002'],
    sharedEquipmentOffset: [2, 0, 2.4],
  },
  model: {
    url: '/models/smart-ward-interior/room-refined-v1.glb?v=20260917',
    baseSize: { width: 12, height: 3.92, depth: 9 },
    canvasTextureFlipY: false,
  },
  room: { height: 4.2 },
  camera: {
    perspective: { fov: 67, near: 0.1, far: 100 },
    initial: { position: [0.5, 2.4, 3.95], target: [-1.3, 1.4, 0.25] },
    presets: [
      { id: 'free', label: '自由视角', position: [0.5, 2.4, 3.95], target: [-1.3, 1.4, 0.25] },
      { id: 'door', label: '门口视角', position: [0.5, 2.4, 3.95], target: [-1.3, 1.4, 0.25] },
      { id: 'nurse', label: '巡视视角', position: [0.5, 2.3, 2.8], target: [-1.75, 1.3, 1] },
      { id: 'top', label: '俯视视角', position: [-0.8, 2.7, 1.05], target: [-1, 1, 1] },
    ],
    viewportScale: { referenceAspect: 0.92, min: 1, max: 2 },
    presetTransitionDuration: 0.75,
    bedFocusTransitionDuration: 0.62,
    viewBounds: {
      shellMesh: '外壳',
      lightMesh: '灯',
      margins: {
        floor: 0.2,
        ceiling: 0.18,
        wall: 0.2,
        depth: 0.2,
      },
    },
  },
  controls: {
    dampingFactor: 0.06,
    zoomSpeed: 1.2,
    rotateSpeed: 0.85,

    minPolarAngle: 0,
    maxPolarAngle: Math.PI / 2 + 0.01,

    minAzimuthAngle: 0,
    maxAzimuthAngle: 0.5,

    minDistance: 3.6,
    maxDistanceBase: 20,
    maxDistanceSpanFactor: 0.48,
    pan: { xSpanFactor: 0.32, zSpanFactor: 0.3, yMin: 0.35, yMax: 1.65 },
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
    maxBeds: 7,
  },
};
