export interface NurseStationSceneConfig {
  model: {
    url: string;
    maxSize: { x: number; y: number; z: number };
  };
  position: { x: number; z: number };
  appearance: {
    background: number;
    deskFov: number;
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
    url: '/models/smart-ward-nurse-station/high_fidelity_nurse_station_v3.glb?v=20260820-latest-blender-v3-export-v20',
    maxSize: { x: 11.04, y: 2.3895, z: 5.102 },
  },
  position: { x: 0, z: 14 },
  appearance: {
    background: 0xdde7e3,
    /** 首屏视野角：数值越小，模型越大；数值越大，看到的环境越多。 */
    deskFov: 30,
  },
  camera: {
    /**
     * 首屏观察中心（决定模型在画面里的位置）：
     * - x：正值向右移观察中心，负值向左移。
     * - y：减小后模型整体更靠画面上方，增大后更靠下方。
     * - z：调整前后纵深，通常保持不动。
     */
    target: { x: 1, y: 0.55, z: -0.05 },
    /** 首屏相机距离：减小会放大模型，增大会缩小模型；建议每次改 0.2。 */
    initialDistance: 1.8,
    /** 水平角正值从右侧看、负值从左侧看；垂直角正值抬高机位、负值降低机位。 */
    initialAngle: { azimuthDeg: 0, elevationDeg: 0 },
    /** 交互平移边界；yMin 要低于 target.y，否则初始目标会被自动抬高。 */
    pan: { xLimit: 0.42, yMin: 0.42, yMax: 1.35 },
    distance: { min: 2.55, max: 6.25 },
    azimuthLimit: Math.PI / 8,
    polar: { min: Math.PI / 2.42, max: Math.PI / 1.92 },
    ceilingY: 2.95,
    ceilingCameraMargin: 0.12,
    ceilingTargetMargin: 0.48,
    floorCameraMargin: 0.18,
  },
  shell: {
    backZ: 5.45,
    halfWidth: 5.55,
    halfDepth: 4.85,
  },
};
