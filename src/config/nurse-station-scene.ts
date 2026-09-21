export interface NurseStationSceneConfig {
  model: {
    url: string;
    layout: "legacy" | "reference-v2";
    /** 仅 legacy 布局按包围盒缩放；reference-v2 保留建模单位。 */
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
    /** 护士站旋转、平移、缩放限制开关；true 表示按安全范围限制视角。 */
    limitsEnabled: boolean;
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
      /** 远离柜台的大厅端墙；用于限制滚轮后退，避免穿出房间。 */
      farWallMesh?: string;
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
    url: "/models/smart-ward-nurse-station/nurse-station.glb?v=20260921",
    /**
     * 新模型含未应用变换/混合中英节点，需按包围盒缩放到 maxSize；
     * 主屏/时钟已适配为 Screen_Main + Clock_Display，工作台屏暂无独立节点。
     */
    layout: "legacy",
    maxSize: { x: 11.04, y: 2.3895, z: 5.102 },
  },
  position: { x: 0, z: 14 },
  appearance: {
    /** 暖纸底略提亮，避免天花/地面发闷。 */
    background: 0xf8f0e4,
    /** 首屏视野角：数值越小，模型越大；数值越大，看到的环境越多。 */
    deskFov: 38,
    /** 比走廊略提曝光，病房白天亮度，阴影仍能落下来。 */
    exposure: 1.34,
    /**
     * 仅 legacy 布局会覆盖材质 envMapIntensity。
     * reference-v2/v3 保留 glTF 作者值，避免整体发灰发亮。
     */
    envMapIntensity: 0.46,
    /** 环境贴图回一点亮度，墙地暖色仍压住冷灰。 */
    environmentIntensity: 0.4,
  },
  camera: {
    /**
     * 首屏观察中心（决定模型在画面里的位置）：
     * - x：正值向右移观察中心，负值向左移。
     * - y：减小后模型整体更靠画面上方，增大后更靠下方。
     * - z：调整前后纵深，通常保持不动。
     */
    target: { x: 0.752, y: 0.455, z: 0.764 },
    initialDistance: 2.507,
    initialAngle: { azimuthDeg: -80.8, elevationDeg: 0.35 },
    /** 换模调试阶段先关闭，便于自由看清内部；构图定稿后再打开。 */
    limitsEnabled: false,
    pan: { xLimit: 0.42, yMin: 0.42, yMax: 1.35 },
    distance: { min: 0.6, max: 12 },
    azimuthLimit: Math.PI / 12,
    polar: { min: Math.PI / 6, max: Math.PI / 1.8 },
    ceilingY: 3.34,
    ceilingCameraMargin: 0.12,
    ceilingTargetMargin: 0.48,
    floorCameraMargin: 0.18,
    viewBounds: {
      floorMesh: "地板",
      ceilingMesh: "Ceiling",
      wallMeshes: ["墙壁", "墙壁2"],
      margins: {
        floor: 0.28,
        ceiling: 0.7,
        wall: 0.28,
        depth: 0.45,
      },
    },
  },
  shell: {
    backZ: 5.45,
    halfWidth: 5.55,
    halfDepth: 4.85,
  },
};
