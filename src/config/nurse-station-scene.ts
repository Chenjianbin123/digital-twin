export interface NurseStationSceneConfig {
  model: {
    url: string;
    maxSize: { x: number; y: number; z: number };
  };
  position: { x: number; z: number };
  appearance: {
    background: number;
    deskFov: number;
    exposure: number;
    envMapIntensity: number;
    environmentIntensity: number;
  };
  camera: {
    /** 画面中心点：y 越小，模型在首屏中越靠上；z 调整前后纵深。 */
    target: { x: number; y: number; z: number };
    /** 首屏视距：数值越小，模型越大；建议每次只调整 0.2-0.4。 */
    initialDistance: number;
    /** 首屏机位角度：azimuth 正值从右侧看，elevation 正值提高机位。单位：度。 */
    initialAngle: { azimuthDeg: number; elevationDeg: number };
    pan: {
      xLimit: number;
      yMin: number;
      yMax: number;
    };
    distance: {
      min: number;
      max: number;
    };
    azimuthLimit: number;
    polar: {
      min: number;
      max: number;
    };
    ceilingY: number;
    ceilingCameraMargin: number;
    ceilingTargetMargin: number;
    floorCameraMargin: number;

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
  shell: {
    backZ: number;
    halfWidth: number;
    halfDepth: number;
  };
}

/** 护士站模型、构图和交互限制。调整护士站外观时优先修改这里。 */
export const nurseStationSceneConfig: NurseStationSceneConfig = {
  model: {
    url: "/models/smart-ward-nurse-station/1-1.glb?v=20260831-nurse-station-1-1",
    maxSize: { x: 11.04, y: 2.3895, z: 5.102 },
  },
  position: { x: 0, z: 14 },
  appearance: {
    background: 0xcfdad4,
    /** 首屏视野角：数值越小，模型越大；数值越大，看到的环境越多。 */
    deskFov: 30,

    exposure: 1.18,
    envMapIntensity: 0.42,
    environmentIntensity: 0.4,
  },
  camera: {
    /**
     * 首屏观察中心（决定模型在画面里的位置）：
     * - x：正值向右移观察中心，负值向左移。
     * - y：减小后模型整体更靠画面上方，增大后更靠下方。
     * - z：调整前后纵深，通常保持不动。
     */
    target: { x: 1.068, y: 0.631, z: 0.369 },
    initialDistance: 3.6,
    initialAngle: { azimuthDeg: -82.69, elevationDeg: 4.65 },
    pan: { xLimit: 0.42, yMin: 0.42, yMax: 1.35 },
    distance: { min: 1.6, max: 8 },
    azimuthLimit: Math.PI / 12,
    polar: { min: Math.PI / 2.12, max: Math.PI / 2.05 },
    ceilingY: 2.95,
    ceilingCameraMargin: 0.12,
    ceilingTargetMargin: 0.48,
    floorCameraMargin: 0.18,
    viewBounds: {
      floorMesh: "地板",
      ceilingMesh: "顶支架.002",
      wallMeshes: ["墙壁", "墙壁2"],
      margins: {
        floor: 0.28,
        ceiling: 0.7,
        wall: 0.28,
        depth: 0.25,
      },
    },
  },
  shell: {
    backZ: 5.45,
    halfWidth: 5.55,
    halfDepth: 4.85,
  },
};
