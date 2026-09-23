import type { CorridorRoomBinding } from '../core/ward-corridor-layout.ts';

export interface WardCorridorSceneConfig {
  /** Keyed by selected area ID. Missing entry means a schematic, not a surveyed floor plan. */
  areaLayouts: Record<string, readonly CorridorRoomBinding[]>;
  model: {
    url: string;
    rotationX: number;
    slotCount: number;
    doorNodeNames: readonly string[];
    entranceDeviceNodeNames: readonly string[];
    canvasTextureFlipY: boolean;
  };
  camera: {
    initial: {
      target: { x: number; y: number; z: number };
      initialDistance: number;
      initialAngle: { azimuthDeg: number; elevationDeg: number };
    };
    overviewFov: {
      upToTwoRooms: number;
      upToFourRooms: number;
      upToSixRooms: number;
      moreRooms: number;
    };
    modelBoundsView: {
      xOffset: { min: number; max: number; widthFactor: number };
      y: { topOffset: number; floorOffset: number; min: number };
      zInset: { min: number; max: number; lengthFactor: number };
      targetY: { topOffset: number; max: number };
      targetZLengthFactor: number;
    };
    /**
     * 视角硬边界取自 GLB 网格：
     * 地面=地板上表面，顶部=天花板下表面，左右=两堵墙内侧面；纵深取地板前后沿。
     */
    viewBounds: {
      floorMesh: string;
      ceilingMesh: string;
      wallMeshes: [string, string];
      margins: {
        floor: number;
        ceiling: number;
        wall: number;
        depth: number;
      };
    };
  };
  controls: {
    minPolarAngle: number;
    maxPolarAngle: number;
    minAzimuthAngle: number;
    maxAzimuthAngle: number;
    minDistance: number;
    maxDistanceBase: number;
    maxDistanceLengthFactor: number;
    zoomSpeed: number;
    rotateSpeed: number;
  };
  appearance: {
    /** 深色主题场景背景。 */
    background: number;
    /** 浅色主题场景背景（对齐护士站）。 */
    lightBackground: number;
    fov: number;
    /** 走廊 ACES 曝光；低于护士站，避免长通道墙面发亮。 */
    exposure: number;
    /** 走廊 PBR 环境反射；压低以免瓷砖/墙漆发塑料光。 */
    envMapIntensity: number;
    /** 走廊场景环境光强度。 */
    environmentIntensity: number;
    /** 走廊地板网格名（含红/绿/橙导向带）。 */
    floorMeshName: string;
    /** 仅压暗地板上高饱和色带，白地砖不改（主题色带未命中时兜底）。 */
    floorStripeColorScale: number;
    /**
     * 与护士站浅色主题对齐的走廊材质色：门板/座椅青灰、墙面去蓝、导向带降饱和。
     * key = GLB 材质名。
     */
    themeMaterials: {
      light: Record<string, number>;
      dark: Record<string, number>;
    };
  };
  fallbackGeometry: {
    ceilingHeight: number;
    halfWidth: number;
    wallThickness: number;
    doorWidth: number;
    doorHeight: number;
    facadeDepth: number;
  };
}

/** 十门模型契约。实际房号由病区配置或会话内稳定展示槽位绑定。 */
export const wardCorridorSceneConfig: WardCorridorSceneConfig = {
  areaLayouts: {},
  model: {
    url: "/models/hospital-corridor/3-v4.glb?v=20260827-3v1-model-v1",
    rotationX: 0,
    slotCount: 10,
    doorNodeNames: [
      "门1",
      "门2",
      "门3",
      "门4",
      "门5",
      "门6",
      "门7",
      "门8",
      "门9",
      "门10",
    ],
    entranceDeviceNodeNames: [
      "门口机1",
      "门口机2",
      "门口机3",
      "门口机4",
      "门口机5",
      "门口机6",
      "门口机7",
      "门口机8",
      "门口机9",
      "门口机10",
    ],
    canvasTextureFlipY: false,
  },
  camera: {
    initial: {
      target: { x: -216.8, y: 1.302, z: -271.74 },
      initialDistance: 14.209,
      initialAngle: { azimuthDeg: -4.98, elevationDeg: 1.07 },
    },
    overviewFov: {
      upToTwoRooms: 38,
      upToFourRooms: 42,
      upToSixRooms: 46,
      moreRooms: 52,
    },
    modelBoundsView: {
      xOffset: { min: 0.3, max: 0.85, widthFactor: 0.16 },
      y: { topOffset: 0.38, floorOffset: 2.05, min: 2.16 },
      zInset: { min: 1.25, max: 2.85, lengthFactor: 0.06 },
      targetY: { topOffset: 0.72, max: 1.55 },
      targetZLengthFactor: 0.15,
    },
    viewBounds: {
      floorMesh: "地板",
      ceilingMesh: "天花板",
      wallMeshes: ["墙壁", "墙壁2"],
      margins: {
        floor: 0.22,
        ceiling: 0.28,
        wall: 0.22,
        depth: 0.35,
      },
    },
  },
  controls: {
    minPolarAngle: 0.05,
    maxPolarAngle: Math.PI - 0.05,
    minAzimuthAngle: -Infinity,
    maxAzimuthAngle: Infinity,
    minDistance: 1.2,
    maxDistanceBase: 140,
    maxDistanceLengthFactor: 2.4,
    zoomSpeed: 1.2,
    rotateSpeed: 0.85,
  },
  appearance: {
    background: 0x0a1218,
    /** 暖日光底，避免走廊整幅发冷灰。 */
    lightBackground: 0xf7f3ec,
    fov: 52,
    /** 微调提亮，保留导向带饱和度。 */
    exposure: 1.2,
    envMapIntensity: 0.7,
    environmentIntensity: 0.36,
    floorMeshName: "地板",
    floorStripeColorScale: 0.42,
    themeMaterials: {
      light: {
        "灰白": 0xf8f5f0,
        "椅子.003": 0x7cbdee,
        "椅子.001": 0x7cbdee,
        /** 护士站门扇比走廊椅面略深，避免和门套洗成一块平面。 */
        "深蓝": 0x3a7eaa,
        "门周": 0x679ac1,
        "窗": 0x679ac1,
        "材质.008": 0xff9a14,
        "材质.020": 0xf23d52,
        "材质.018": 0x1ecf62,
      },
      dark: {
        "灰白": 0x8ab4c4,
        "椅子.003": 0x4a7290,
        "椅子.001": 0x4a7290,
        "深蓝": 0x355f78,
        "门周": 0x3d6480,
        "窗": 0x457890,
        "材质.008": 0xe89818,
        "材质.020": 0xd64050,
        "材质.018": 0x24a858,
      },
    },
  },
  fallbackGeometry: {
    ceilingHeight: 2.85,
    halfWidth: 3.2,
    wallThickness: 0.12,
    doorWidth: 2.1,
    doorHeight: 2.5,
    facadeDepth: 0.48,
  },
};
