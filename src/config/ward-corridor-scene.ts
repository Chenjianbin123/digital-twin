export interface WardCorridorSceneConfig {
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
    background: number;
    fov: number;
    /** 与护士站统一的 ACES 曝光。 */
    exposure: number;
    /** 与护士站统一的 PBR 环境反射强度。 */
    envMapIntensity: number;
    /** 与护士站统一的场景环境光强度。 */
    environmentIntensity: number;
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

/** 病房走廊模型、镜头和备用几何参数。六门节点顺序同时决定病房绑定顺序。 */
export const wardCorridorSceneConfig: WardCorridorSceneConfig = {
  model: {
    url: '/models/hospital-corridor/3-v-1.glb?v=20260827-3v1-model-v1',
    rotationX: 0,
    slotCount: 10,
    doorNodeNames: ['门1', '门2', '门3', '门4', '门5', '门6', '门7', '门8', '门9', '门10'],
    entranceDeviceNodeNames: ['门口机1', '门口机2', '门口机3', '门口机4', '门口机5', '门口机6', '门口机7', '门口机8', '门口机9', '门口机10'],
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
    fov: 52,
    exposure: 1.18,
    envMapIntensity: 0.42,
    environmentIntensity: 0.4,
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
