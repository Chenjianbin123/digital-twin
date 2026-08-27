import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { summarizeArea, summarizeRoom, type RoomSummary } from '@/core/area-summary';
import { buildRoomStructureSignature } from '@/core/area-scene-identity';
import { resolveBedStatus } from '@/core/bed-status';
import { buildNurseStationLiveData } from '@/core/nurse-station-live-data';
import { easeOutCubic } from '@/core/camera-easing';
import {
  getDoorMeshScreenSize,
  isDoorHorizontal,
  resolveDoorDirector,
} from '@/core/template/door-screen-orientation';
import {
  createDoorTemplateStatusTexture,
  createFallbackDoorTerminalTexture,
  getDoorTerminalScreenLayout,
  renderDoorTerminalTexture,
} from '@/core/template/door-terminal-texture';
import {
  addCeilingGrid,
  addCorridorWallFinish,
  buildCorridorHandrails,
  buildCorridorCeilingDisplay,
  buildDoorPriorityLintel,
  buildHospitalDoorTerminal,
  buildHospitalWardDoor,
  createCorridorScreenTexture,
  createHospitalFloorTexture,
  createHospitalWallTexture,
  createCorridorBladeTexture,
  buildWardDoorDisplayBoard,
  computeWardDoorDisplayMount,
  type CorridorDisplayData,
  type NurseStationDisplayInfo,
} from '@/core/hospital-scene-details';
import { loadParsedTemplate } from '@/core/template/template-cache';
import {
  buildWardCorridorSlots,
  buildWardCorridorBindingSignature,
  configureWardCorridorCanvasTexture,
  getHospitalCorridorDoorOrder,
  getHospitalCorridorEntranceDeviceOrder,
  getHospitalCorridorEntranceScreenOrder,
  getHospitalCorridorEntranceScreenMaterialIndex,
  getHospitalCorridorEntranceScreenAspect,
  getHospitalCorridorEntranceScreenBounds,
  fitHospitalCorridorEntranceScreenGeometry,
  shouldDepthTestHospitalCorridorScreen,
  getWardCorridorScreenPresentation,
  normalizeHospitalCorridorModelTransform,
  shouldUseWardCorridorModel,
  WARD_CORRIDOR_MODEL_URL,
  type WardCorridorSlot,
} from '@/core/ward-corridor-model';
import { resolveAreaCorridorControlLimits } from '@/core/area-corridor-controls';
import { nurseStationSceneConfig } from '@/config/nurse-station-scene';
import { wardCorridorSceneConfig } from '@/config/ward-corridor-scene';
import type { AreaViewPhase, TwinAreaEntity, TwinWardEntity } from '@/types/twin';
import { getWardRoomSize } from '@/types/twin';

interface CameraTransition {
  elapsed: number;
  duration: number;
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  onComplete?: () => void;
}

export interface AreaSceneOptions {
  container: HTMLElement;
  onRoomClick?: (roomIndex: number) => void;
  onNodePick?: (info: AreaNodePickInfo) => void;
  onModelState?: (state: AreaModelState) => void;
  onCorridorState?: (state: AreaModelState) => void;
  onCameraState?: (state: AreaCameraDebugState) => void;
}

export interface AreaNodePickInfo {
  name: string;
  type: string;
  parentName: string;
  worldPosition: { x: number; y: number; z: number };
  materialNames: string[];
}

export type AreaModelState = 'loading' | 'ready' | 'fallback';

export interface AreaCameraDebugState {
  phase: AreaViewPhase;
  target: { x: number; y: number; z: number };
  initialDistance: number;
  initialAngle: { azimuthDeg: number; elevationDeg: number };
  distance: number;
  fov: number;
}

interface RoomMeshGroup {
  roomIndex: number;
  structureSignature: string;
  group: THREE.Group;
  hitBox: THREE.Mesh;
  wallMat: THREE.MeshStandardMaterial;
  bedMattresses: THREE.Mesh[];
  roomW: number;
  roomD: number;
  corridorSide: -1 | 1;
  doorTerminal?: THREE.Group;
  doorScreen?: THREE.Mesh;
  doorScreenTexture?: THREE.CanvasTexture;
  doorLed?: THREE.Mesh;
  doorGlow?: THREE.Mesh;
  doorFrameLed?: THREE.Mesh;
  doorLintel?: THREE.Mesh;
  doorIsHorizontal?: boolean;
  doorDisplay?: THREE.Group;
  doorDisplayBlade?: THREE.Mesh;
  doorDisplayBladeTexture?: THREE.CanvasTexture;
}

interface WardCorridorModelBinding {
  slot: WardCorridorSlot;
  door?: THREE.Mesh;
  screenShell?: THREE.Mesh;
  screen?: THREE.Mesh;
  screenMaterialIndex?: number;
  screenAspect?: number;
  label?: THREE.Mesh;
  screenTexture?: THREE.CanvasTexture;
  labelTexture?: THREE.CanvasTexture;
}

type NurseStationBoardKind = 'dashboard' | 'whiteboard' | 'roomStatus' | 'education' | 'queue' | 'kiosk' | 'workLeft' | 'workRight' | 'taskQueue' | 'wardStatus' | 'bedMonitor' | 'deviceHealth' | 'clock';

interface NurseStationBoardDisplay {
  kind: NurseStationBoardKind;
  screen: THREE.Mesh;
  texture: THREE.Texture;
  video?: HTMLVideoElement;
}

interface CorridorModelDisplay {
  screen: THREE.Mesh;
  overlay: THREE.Mesh;
  texture: THREE.CanvasTexture;
  mode: 'area' | 'clock';
}

const NURSE_STATION = nurseStationSceneConfig.position;
const CORRIDOR_GEOMETRY = wardCorridorSceneConfig.fallbackGeometry;
const CORRIDOR_CEILING_H = CORRIDOR_GEOMETRY.ceilingHeight;
const NURSE_STATION_MODEL_URL = nurseStationSceneConfig.model.url;
const HEALTH_EDUCATION_VIDEO_URL = '/videos/hospital-handwashing-education.mp4';
const NURSE_STATION_MODEL_MAX_SIZE = new THREE.Vector3(
  nurseStationSceneConfig.model.maxSize.x,
  nurseStationSceneConfig.model.maxSize.y,
  nurseStationSceneConfig.model.maxSize.z,
);
const NURSE_STATION_BG = nurseStationSceneConfig.appearance.background;

// =============================================================================
// 病区总览 3D 可调参数（文件：src/core/area-scene.ts）
// 改完保存 → 浏览器 Ctrl+F5 强制刷新
// =============================================================================

// --- A. 场景布局（走廊 + 病房排布）---
const WALL_THICK = 0.14;
const DOOR_W = CORRIDOR_GEOMETRY.doorWidth;
const DOOR_H = CORRIDOR_GEOMETRY.doorHeight;
const CORRIDOR_HALF_W = CORRIDOR_GEOMETRY.halfWidth;
const CORRIDOR_WALL_THICK = CORRIDOR_GEOMETRY.wallThickness;
const ROOM_FIRST_ROW_Z = 6;        // 第一排病房距护士站的 Z 距离
const AREA_ROOM_SCALE = 0.54;      // 病房外立面宽度缩放
const AREA_FACADE_DEPTH = CORRIDOR_GEOMETRY.facadeDepth;

// 病房行距：在 getRoomLayoutMetrics() 内按 rows 分段（17 / 10 / 7 / 5.5）

// --- B2. 护士站工作台初始视角（坐席看排班屏 + 柜台）---
const STATION_DESK_FOV = nurseStationSceneConfig.appearance.deskFov;
const STATION_TARGET_LOCAL = new THREE.Vector3(
  nurseStationSceneConfig.camera.target.x,
  nurseStationSceneConfig.camera.target.y,
  nurseStationSceneConfig.camera.target.z,
);
const STATION_TARGET_Z = STATION_TARGET_LOCAL.z;
const STATION_PAN_X_LIMIT = nurseStationSceneConfig.camera.pan.xLimit;
const STATION_PAN_Y_MIN = nurseStationSceneConfig.camera.pan.yMin;
const STATION_PAN_Y_MAX = nurseStationSceneConfig.camera.pan.yMax;
/** 初始视距（越大画面越小、看得越多）；实际数值见 nurse-station-scene.ts。 */
const STATION_INIT_DISTANCE = nurseStationSceneConfig.camera.initialDistance;
/**
 * 首屏机位方向由配置中的角度转换而来，方便非程序人员直接用度数微调：
 * - azimuthDeg：水平角，正值从模型右侧看，负值从左侧看。
 * - elevationDeg：垂直角，正值提高机位，负值降低机位。
 */
const STATION_INITIAL_AZIMUTH = THREE.MathUtils.degToRad(nurseStationSceneConfig.camera.initialAngle.azimuthDeg);
const STATION_INITIAL_ELEVATION = THREE.MathUtils.degToRad(nurseStationSceneConfig.camera.initialAngle.elevationDeg);
const STATION_CAM_DIR = new THREE.Vector3(
  Math.sin(STATION_INITIAL_AZIMUTH) * Math.cos(STATION_INITIAL_ELEVATION),
  Math.sin(STATION_INITIAL_ELEVATION),
  Math.cos(STATION_INITIAL_AZIMUTH) * Math.cos(STATION_INITIAL_ELEVATION),
).normalize();
const STATION_CAM_LOCAL = STATION_TARGET_LOCAL.clone().add(
  STATION_CAM_DIR.clone().multiplyScalar(STATION_INIT_DISTANCE),
);
/** 半封闭外壳：背板 Z（须大于 Orbit 最远点，避免缩放穿模后空白） */
const STATION_SHELL_BACK_Z = nurseStationSceneConfig.shell.backZ;
const STATION_SHELL_HALF_W = nurseStationSceneConfig.shell.halfWidth;
const STATION_SHELL_HALF_D = nurseStationSceneConfig.shell.halfDepth;
const STATION_MIN_DISTANCE = nurseStationSceneConfig.camera.distance.min;
const STATION_MAX_DISTANCE = nurseStationSceneConfig.camera.distance.max;
const STATION_AZIMUTH_LIMIT = nurseStationSceneConfig.camera.azimuthLimit;
const STATION_MIN_POLAR_ANGLE = nurseStationSceneConfig.camera.polar.min;
const STATION_MAX_POLAR_ANGLE = nurseStationSceneConfig.camera.polar.max;
/** 护士站室内天花板下沿（护士 group 本地 Y），相机不得高于此 */
const STATION_CEILING_Y = nurseStationSceneConfig.camera.ceilingY;
const STATION_CEILING_CAM_MARGIN = nurseStationSceneConfig.camera.ceilingCameraMargin;
const STATION_CEILING_TARGET_MARGIN = nurseStationSceneConfig.camera.ceilingTargetMargin;
const STATION_FLOOR_CAM_MARGIN = nurseStationSceneConfig.camera.floorCameraMargin;

// --- B. 相机初始视角（走廊总览，expand 后使用）---
// 视线落点高度：↑ 看门楣/天花板  ↓ 看地板（太低只剩灰地面）
const NURSE_CAMERA_TARGET_Y = 2.05;
// 走廊总览使用侧上方 3/4 视角，避免正对地板造成大面积白面
const NURSE_CAMERA_X_OFFSET = 6.8;
// 构造函数占位高度（loadArea 后会被 fitCameraToScene 覆盖）
const NURSE_CAMERA_HEIGHT = 1.68;

// getNurseStationCameraView() 内公式系数：
const OVERVIEW_ELEVATION_BASE = 7.2;   // 相机高度基数（越大越高）
const OVERVIEW_ELEVATION_PER_ROW = 0.72; // 每多一行病房，高度 +此值
const OVERVIEW_ELEVATION_ROW_CAP = 4.2;  // 高度增量上限
const OVERVIEW_CAM_X_PER_ROW = 0.62;    // 每行 X 偏移增量
const OVERVIEW_CAM_X_MAX = 9.6;          // X 偏移上限
const OVERVIEW_CAM_Z_BACK_BASE = 8.5;  // 相机沿走廊后退基数
const OVERVIEW_CAM_Z_LEN_FACTOR = 0.065; // 走廊越长，相机越靠护士站外侧
const OVERVIEW_CAM_Z_BACK_MAX = 12.8;   // 后退距离上限

// --- C. 视野与交互（OrbitControls）---
const AREA_CAMERA_FOV = wardCorridorSceneConfig.camera.overviewFov.upToTwoRooms;
// fitCameraToScene 内：minPolarAngle = PI/6（约 30°，限制贴地）
// fitCameraToScene 内：maxPolarAngle = PI/2.08（限制仰角）

// --- D. 画面外观 ---
const SCENE_BG = wardCorridorSceneConfig.appearance.background;
// renderer.toneMappingExposure = 1.05  （在 constructor 内，越大越亮）

const CORRIDOR_SAFETY_SIGNS: Array<{
  title: string;
  subtitle: string;
  bg: string;
  fg: string;
  accent: string;
  variant: 'direction' | 'safety';
}> = [
  { title: '安全出口', subtitle: 'EXIT', bg: '#e8f5e9', fg: '#1b5e20', accent: '#4caf50', variant: 'safety' },
  { title: '禁止吸烟', subtitle: 'No Smoking', bg: '#ffebee', fg: '#b71c1c', accent: '#f44336', variant: 'safety' },
  { title: '灭火器', subtitle: 'Fire Extinguisher', bg: '#fff3e0', fg: '#e65100', accent: '#ff9800', variant: 'safety' },
  { title: '消防栓', subtitle: 'Fire Hydrant', bg: '#fff3e0', fg: '#bf360c', accent: '#ff5722', variant: 'safety' },
  { title: '病房区', subtitle: 'Ward Area', bg: '#e8f5e9', fg: '#1b5e20', accent: '#43a047', variant: 'direction' },
  { title: '护士站', subtitle: 'Nurse Station', bg: '#e3f2fd', fg: '#0d47a1', accent: '#1565c0', variant: 'direction' },
];

export class AreaScene {
  private renderer: THREE.WebGLRenderer;
  private labelRenderer: CSS2DRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private animationId = 0;
  private timer = new THREE.Timer();
  private roomMeshes = new Map<number, RoomMeshGroup>();
  private area: TwinAreaEntity | null = null;
  private summaries: RoomSummary[] = [];
  private onRoomClick?: (roomIndex: number) => void;
  private onNodePick?: (info: AreaNodePickInfo) => void;
  private onModelState?: (state: AreaModelState) => void;
  private onCorridorState?: (state: AreaModelState) => void;
  private onCameraState?: (state: AreaCameraDebugState) => void;
  private resizeObserver: ResizeObserver | null = null;
  private container: HTMLElement;
  private envGroup: THREE.Group | null = null;
  private gridHelper: THREE.GridHelper | null = null;
  private nurseGroup: THREE.Group | null = null;
  private nurseStationModel: THREE.Object3D | null = null;
  private nurseStationModelLoadToken = 0;
  private hasLoadedNurseStationModel = false;
  private lastRoomCount = 0;
  private focusedRoomIndex = -1;
  private cameraTransition: CameraTransition | null = null;
  private suppressRoomClick = false;
  private doorRefreshToken = new Map<number, number>();
  private floorTileTexture: THREE.CanvasTexture | null = null;
  private wallPanelTexture: THREE.CanvasTexture | null = null;
  private corridorGroup: THREE.Group | null = null;
  private wardCorridorModel: THREE.Object3D | null = null;
  private wardCorridorModelLoaded = false;
  private wardCorridorModelFailed = false;
  private wardCorridorModelLoadToken = 0;
  private wardCorridorBindings: WardCorridorModelBinding[] = [];
  private wardCorridorOverlayGroup: THREE.Group | null = null;
  private wardCorridorBindingSignature = '';
  private wardCorridorRefreshToken = 0;
  private corridorDisplays: Array<{
    screen: THREE.Mesh;
    texture: THREE.CanvasTexture;
  }> = [];
  private corridorModelDisplays: CorridorModelDisplay[] = [];
  private corridorTimeRefreshAt = 0;
  private nurseStationBoardDisplays: NurseStationBoardDisplay[] = [];
  private nurseStationBoardRefreshAt = 0;
  private viewPhase: AreaViewPhase = 'station';
  private stationShell?: THREE.Group;
  private css2dLookDir = new THREE.Vector3();
  private css2dToLabel = new THREE.Vector3();
  private pageHidden = document.hidden;

  constructor(options: AreaSceneOptions) {
    const { container, onRoomClick, onNodePick, onModelState, onCorridorState, onCameraState } = options;
    this.container = container;
    this.onRoomClick = onRoomClick;
    this.onNodePick = onNodePick;
    this.onModelState = onModelState;
    this.onCorridorState = onCorridorState;
    this.onCameraState = onCameraState;

    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(NURSE_STATION_BG);
    // 不使用雾效，避免短走廊被背景色洗白
    this.scene.fog = null;

    this.camera = new THREE.PerspectiveCamera(AREA_CAMERA_FOV, width / height, 0.1, 500);
    this.camera.position.set(NURSE_CAMERA_X_OFFSET, NURSE_CAMERA_HEIGHT, NURSE_STATION.z - 1.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.styleRendererLayers();

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(width, height);
    this.styleLabelLayer();
    container.appendChild(this.renderer.domElement);
    container.appendChild(this.labelRenderer.domElement);

    // 仅 canvas 响应拖拽/缩放，避免 CSS2D 标签上的按钮被 OrbitControls 吞掉
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = false;
    this.controls.enableRotate = true;
    this.controls.enableZoom = true;
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = true;
    this.controls.minPolarAngle = Math.PI / 6;
    this.controls.maxPolarAngle = Math.PI / 2.08;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 120;
    this.controls.zoomSpeed = wardCorridorSceneConfig.controls.zoomSpeed;
    this.controls.rotateSpeed = wardCorridorSceneConfig.controls.rotateSpeed;
    this.controls.target.set(0, NURSE_CAMERA_TARGET_Y, 0);
    this.controls.addEventListener('start', this.onControlsStart);
    this.controls.addEventListener('change', this.onControlsChange);

    this.setupLights();
    this.envGroup = new THREE.Group();
    this.scene.add(this.envGroup);
    this.buildNurseStation();
    this.buildStationBackdrop();
    this.loadWardCorridorModel();

    this.timer.connect(document);

    this.container.addEventListener('click', this.handleClick);
    this.container.addEventListener('wheel', this.cancelCameraTransition, { passive: true });
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    this.animate();
  }

  private styleRendererLayers() {
    const canvas = this.renderer.domElement;
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.zIndex = '1';
    canvas.style.pointerEvents = 'auto';
    canvas.style.touchAction = 'none';
    canvas.style.cursor = 'grab';
    canvas.style.outline = 'none';
  }

  private styleLabelLayer() {
    const root = this.labelRenderer.domElement;
    root.style.position = 'absolute';
    root.style.inset = '0';
    root.style.width = '100%';
    root.style.height = '100%';
    root.style.pointerEvents = 'none';
    root.style.zIndex = '2';
    root.style.overflow = 'visible';
    root.style.background = 'transparent';
  }

  private cancelCameraTransition = () => {
    this.cameraTransition = null;
    this.controls.enabled = true;
  };

  private onControlsStart = () => {
    this.cancelCameraTransition();
    this.suppressRoomClick = false;
  };

  private onControlsChange = () => {
    this.suppressRoomClick = true;
    this.applyStationOrbitCeilingConstraint();
    this.emitCameraDebugState();
  };

  /** 输出可直接回填 nurse-station-scene.ts 的护士站相机参数。 */
  private emitCameraDebugState() {
    if (!this.onCameraState || (this.viewPhase !== 'station' && this.viewPhase !== 'corridor'))
      return;

    const target = this.viewPhase === 'station' && this.nurseGroup
      ? this.nurseGroup.worldToLocal(this.controls.target.clone())
      : this.controls.target.clone();
    const position = this.viewPhase === 'station' && this.nurseGroup
      ? this.nurseGroup.worldToLocal(this.camera.position.clone())
      : this.camera.position.clone();
    const direction = position.clone().sub(target);
    const horizontalDistance = Math.hypot(direction.x, direction.z);
    this.onCameraState({
      phase: this.viewPhase,
      target: {
        x: Number(target.x.toFixed(3)),
        y: Number(target.y.toFixed(3)),
        z: Number(target.z.toFixed(3)),
      },
      initialDistance: Number(direction.length().toFixed(3)),
      initialAngle: {
        azimuthDeg: Number(THREE.MathUtils.radToDeg(Math.atan2(direction.x, direction.z)).toFixed(2)),
        elevationDeg: Number(THREE.MathUtils.radToDeg(Math.atan2(direction.y, horizontalDistance)).toFixed(2)),
      },
      distance: Number(this.camera.position.distanceTo(this.controls.target).toFixed(3)),
      fov: Number(this.camera.fov.toFixed(2)),
    });
  }

  private handleVisibilityChange = () => {
    this.pageHidden = document.hidden;
    if (!this.pageHidden)
      this.timer.getDelta();
  };

  private setupLights() {
    this.scene.add(new THREE.AmbientLight(0xf4faf6, 0.78));
    this.scene.add(new THREE.HemisphereLight(0xf0f8f4, 0x96aaa0, 0.55));

    const key = new THREE.DirectionalLight(0xfffef8, 0.86);
    key.position.set(8, 26, 16);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 120;
    key.shadow.camera.left = -50;
    key.shadow.camera.right = 50;
    key.shadow.camera.top = 50;
    key.shadow.camera.bottom = -50;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xe8f5e9, 0.3);
    fill.position.set(-14, 14, 6);
    this.scene.add(fill);

    const corridor = new THREE.DirectionalLight(0xffffff, 0.2);
    corridor.position.set(0, 18, -18);
    this.scene.add(corridor);

    this.setupNurseStationAtmosphereLights();
  }

  private setupNurseStationAtmosphereLights() {
    const counterGlow = new THREE.RectAreaLight(0x9eefff, 0.85, 5.8, 1.2);
    counterGlow.name = 'nurse-station-counter-softbox';
    counterGlow.position.set(0, 2.25, NURSE_STATION.z + 0.45);
    counterGlow.rotation.x = -Math.PI / 2.55;
    this.scene.add(counterGlow);

    const screenFill = new THREE.PointLight(0x67d9ff, 0.55, 8.2, 1.7);
    screenFill.name = 'nurse-station-screen-fill';
    screenFill.position.set(0, 1.75, NURSE_STATION.z - 0.85);
    this.scene.add(screenFill);
  }

  private getFloorTileTexture() {
    if (this.floorTileTexture)
      return this.floorTileTexture;
    this.floorTileTexture = createHospitalFloorTexture(4, 4);
    return this.floorTileTexture;
  }

  private getWallPanelTexture() {
    if (this.wallPanelTexture)
      return this.wallPanelTexture;
    this.wallPanelTexture = createHospitalWallTexture();
    return this.wallPanelTexture;
  }

  private getAreaRoomSize(bedCount: number) {
    const base = getWardRoomSize(bedCount);
    return {
      w: Math.max(8, base.w * AREA_ROOM_SCALE),
      d: Math.max(6.8, base.d * AREA_ROOM_SCALE),
    };
  }

  /** 按病房数量自适应行距，避免 8 间及以上病房被排到过远而标签淡出不可见 */
  private getRoomLayoutMetrics(roomCount: number) {
    const rows = Math.max(1, Math.ceil(roomCount / 2));
    let rowGap = 17;
    if (roomCount > 1) {
      if (rows <= 2)
        rowGap = 17;
      else if (rows <= 4)
        rowGap = 10;
      else if (rows <= 6)
        rowGap = 7;
      else
        rowGap = 5.5;
    }
    const firstRowZ = roomCount <= 1 ? 2 : ROOM_FIRST_ROW_Z;
    const lastRowZ = roomCount <= 1 ? 2 : firstRowZ - (rows - 1) * rowGap;
    const corridorStartZ = (roomCount <= 1 ? firstRowZ : lastRowZ) - (roomCount <= 1 ? 2 : 6);
    const corridorEndZ = NURSE_STATION.z + 3;
    const corridorLen = Math.max(16, corridorEndZ - corridorStartZ);
    return { rows, rowGap, firstRowZ, lastRowZ, corridorLen, corridorStartZ, corridorEndZ };
  }

  /** 走廊地板/吊顶中心 Z：始终对齐病房区与护士站 */
  private getCorridorCenterZ(roomCount: number) {
    const { corridorStartZ, corridorEndZ } = this.getRoomLayoutMetrics(roomCount);
    return (corridorStartZ + corridorEndZ) / 2;
  }

  private getRoomRowZ(roomCount: number, row: number) {
    const { firstRowZ, rowGap } = this.getRoomLayoutMetrics(roomCount);
    return roomCount <= 1 ? 2 : firstRowZ - row * rowGap;
  }

  private formatRoomDisplayName(room: TwinWardEntity): string {
    const rooms = this.area?.rooms ?? [];
    const sameNameCount = rooms.filter(item => item.sickroomName === room.sickroomName).length;
    if (sameNameCount > 1)
      return `${room.sickroomName} · ${room.deviceCode}`;
    return room.sickroomName;
  }

  /** 病区统一外立面宽度，保证走廊两侧门洞对齐 */
  private getAreaFacadeSize() {
    let maxW = this.getAreaRoomSize(2).w;
    if (this.area?.rooms.length) {
      for (const room of this.area.rooms) {
        const size = this.getAreaRoomSize(room.beds.length);
        maxW = Math.max(maxW, size.w);
      }
    }
    return { w: maxW };
  }

  private getCorridorCeilingHalfWidth(_roomCount: number) {
    return CORRIDOR_HALF_W + AREA_FACADE_DEPTH + 0.8;
  }

  private addCeilingLightPanel(
    parent: THREE.Group,
    x: number,
    z: number,
    y: number,
    options?: { width?: number; depth?: number; withPointLight?: boolean; intensity?: number },
  ) {
    const w = options?.width ?? 1.25;
    const d = options?.depth ?? 0.58;
    const withPointLight = options?.withPointLight ?? true;
    const intensity = options?.intensity ?? 0.42;

    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.07, d),
      new THREE.MeshStandardMaterial({ color: 0xe8edf2, roughness: 0.78, metalness: 0.05 }),
    );
    housing.position.set(x, y, z);
    parent.add(housing);

    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.86, d * 0.84),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xfff8e1,
        emissiveIntensity: 0.72,
        roughness: 0.35,
      }),
    );
    panel.rotation.x = Math.PI / 2;
    panel.position.set(x, y - 0.04, z);
    parent.add(panel);

    if (withPointLight) {
      const light = new THREE.PointLight(0xfff5e0, intensity, 14, 1.6);
      light.position.set(x, y - 0.55, z);
      parent.add(light);
    }
  }

  private buildCorridorCeiling(roomCount: number, corridorLen: number, centerZ: number) {
    if (!this.corridorGroup)
      return;

    const halfW = this.getCorridorCeilingHalfWidth(roomCount);
    const ceilLen = corridorLen + 18;
    const y = CORRIDOR_CEILING_H;

    const ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(halfW * 2, 0.14, ceilLen),
      new THREE.MeshStandardMaterial({
        color: 0xf5f7fa,
        roughness: 0.92,
        metalness: 0.02,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      }),
    );
    ceiling.position.set(0, y + 0.07, centerZ);
    ceiling.castShadow = true;
    ceiling.receiveShadow = true;
    this.corridorGroup.add(ceiling);

    const underside = new THREE.Mesh(
      new THREE.PlaneGeometry(halfW * 2 - 0.2, ceilLen - 0.2),
      new THREE.MeshStandardMaterial({
        color: 0xfafafa,
        roughness: 0.94,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
      }),
    );
    underside.rotation.x = Math.PI / 2;
    underside.position.set(0, y, centerZ);
    this.corridorGroup.add(underside);

    addCeilingGrid(this.corridorGroup, halfW * 2 - 0.3, ceilLen - 0.3, y);

    const { rows } = this.getRoomLayoutMetrics(roomCount);
    for (let row = 0; row < rows; row++) {
      const z = this.getRoomRowZ(roomCount, row);
      this.addCeilingLightPanel(this.corridorGroup, 0, z, y - 0.02, { width: 1.4, depth: 0.65 });
      this.addCeilingLightPanel(
        this.corridorGroup, -CORRIDOR_HALF_W * 0.75, z, y - 0.02,
        { width: 1.0, depth: 0.48, withPointLight: false },
      );
      this.addCeilingLightPanel(
        this.corridorGroup, CORRIDOR_HALF_W * 0.75, z, y - 0.02,
        { width: 1.0, depth: 0.48, withPointLight: false },
      );
    }

    this.addCeilingLightPanel(this.corridorGroup, 0, 10, y - 0.02, { width: 1.6, depth: 0.75 });
    this.addCeilingLightPanel(this.corridorGroup, 0, NURSE_STATION.z - 2, y - 0.02, { width: 1.8, depth: 0.85, intensity: 0.5 });
  }

  private rebuildFloor(roomCount: number) {
    if (!this.envGroup)
      return;

    if (this.gridHelper) {
      this.envGroup.remove(this.gridHelper);
      this.gridHelper.geometry.dispose();
      (this.gridHelper.material as THREE.Material).dispose();
      this.gridHelper = null;
    }

    if (this.corridorGroup) {
      this.disposeCorridorDisplays();
      this.envGroup.remove(this.corridorGroup);
      this.corridorGroup = null;
    }

    const { corridorLen } = this.getRoomLayoutMetrics(roomCount);
    const wallLen = corridorLen + 6;
    const floorLen = wallLen;

    if (this.scene.fog instanceof THREE.Fog)
      this.scene.fog = null;

    this.corridorGroup = new THREE.Group();
    this.corridorGroup.name = 'corridor';

    const corridorTex = this.getFloorTileTexture().clone();
    corridorTex.repeat.set(floorLen / 2.5, 1.2);
    const corridorFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(CORRIDOR_HALF_W * 2, floorLen),
      new THREE.MeshStandardMaterial({
        map: corridorTex,
        color: 0xd8e2e4,
        roughness: 0.68,
        metalness: 0.04,
      }),
    );
    corridorFloor.rotation.x = -Math.PI / 2;
    const centerZ = this.getCorridorCenterZ(roomCount);
    corridorFloor.position.set(0, 0.015, centerZ);
    corridorFloor.receiveShadow = true;
    (corridorFloor.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    this.corridorGroup.add(corridorFloor);

    const edgeMat = new THREE.MeshStandardMaterial({ color: 0xa8bac3, roughness: 0.72 });
    [-1, 1].forEach((side) => {
      const edge = new THREE.Mesh(
        new THREE.PlaneGeometry(0.18, floorLen),
        edgeMat,
      );
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(side * (CORRIDOR_HALF_W - 0.12), 0.018, centerZ);
      this.corridorGroup!.add(edge);
    });

    const guideMat = new THREE.MeshBasicMaterial({ color: 0x35d8c8, transparent: true, opacity: 0.32 });
    const guide = new THREE.Mesh(
      new THREE.PlaneGeometry(0.28, floorLen - 4),
      guideMat,
    );
    guide.rotation.x = -Math.PI / 2;
    guide.position.set(0, 0.019, centerZ);
    this.corridorGroup.add(guide);

    const dashCount = Math.max(6, Math.floor(floorLen / 2.5));
    for (let i = 0; i < dashCount; i++) {
      const dash = new THREE.Mesh(
        new THREE.PlaneGeometry(0.12, 0.92),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }),
      );
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(0, 0.021, centerZ + floorLen / 2 - 1.5 - i * 2.4);
      this.corridorGroup.add(dash);
    }

    const sideGuideMat = new THREE.MeshBasicMaterial({ color: 0x81d4fa, transparent: true, opacity: 0.18 });
    [-1, 1].forEach((side) => {
      const lane = new THREE.Mesh(
        new THREE.PlaneGeometry(0.06, floorLen - 4.8),
        sideGuideMat,
      );
      lane.rotation.x = -Math.PI / 2;
      lane.position.set(side * (CORRIDOR_HALF_W * 0.58), 0.022, centerZ);
      this.corridorGroup!.add(lane);
    });

    this.buildCorridorCeiling(roomCount, corridorLen, centerZ);
    const doorZs = this.getCorridorDoorZs(roomCount);
    this.buildCorridorWalls(roomCount, corridorLen, centerZ, doorZs);

    this.envGroup.add(this.corridorGroup);
  }

  /** 各病房门在走廊上的 Z 坐标 */
  private getCorridorDoorZs(roomCount: number) {
    const left: number[] = [];
    const right: number[] = [];
    for (let i = 0; i < roomCount; i++) {
      const row = Math.floor(i / 2);
      const z = this.getRoomRowZ(roomCount, row);
      if (i % 2 === 0)
        left.push(z);
      else
        right.push(z);
    }
    return { left, right };
  }

  /** 走廊侧墙：门洞位置留空，门开在走廊路面上 */
  private buildCorridorWalls(
    roomCount: number,
    corridorLen: number,
    centerZ: number,
    doorZs: { left: number[]; right: number[] },
  ) {
    if (!this.corridorGroup)
      return;

    const wallH = CORRIDOR_CEILING_H;
    const wallLen = corridorLen + 6;
    const zMin = centerZ - wallLen / 2;
    const zMax = centerZ + wallLen / 2;
    const wallTex = createHospitalWallTexture().clone();
    wallTex.repeat.set(wallLen / 6, 1);

    const wallMat = new THREE.MeshStandardMaterial({
      map: wallTex,
      color: 0xe8edf2,
      roughness: 0.88,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    const kickMat = new THREE.MeshStandardMaterial({ color: 0x90a4ae, roughness: 0.82 });
    const wallX = (side: number) => side * (CORRIDOR_HALF_W - CORRIDOR_WALL_THICK / 2);

    const addWallRun = (side: -1 | 1, zStart: number, zEnd: number) => {
      if (zEnd - zStart < 0.25)
        return;
      const len = zEnd - zStart;
      const zMid = (zStart + zEnd) / 2;
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(CORRIDOR_WALL_THICK, wallH, len),
        wallMat,
      );
      wall.position.set(wallX(side), wallH / 2, zMid);
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.corridorGroup!.add(wall);

      const kick = new THREE.Mesh(
        new THREE.BoxGeometry(CORRIDOR_WALL_THICK + 0.01, 0.1, len),
        kickMat,
      );
      kick.position.set(wallX(side), 0.05, zMid);
      this.corridorGroup!.add(kick);

      addCorridorWallFinish(
        this.corridorGroup!,
        side,
        zStart,
        zEnd,
        wallX(side),
        wallH,
        CORRIDOR_WALL_THICK,
      );
    };

    const buildSideWall = (side: -1 | 1, doorZList: number[]) => {
      const gapHalf = DOOR_W / 2 + 0.12;
      const sorted = [...doorZList].sort((a, b) => b - a);
      let cursor = zMax;
      for (const doorZ of sorted) {
        addWallRun(side, doorZ + gapHalf, cursor);
        cursor = doorZ - gapHalf;
      }
      addWallRun(side, zMin, cursor);
    };

    buildSideWall(-1, doorZs.left);
    buildSideWall(1, doorZs.right);

    this.addCorridorEndWall(zMin, wallMat, kickMat);
    this.addCorridorEndWall(zMax, wallMat, kickMat);

    buildCorridorHandrails(
      this.corridorGroup,
      corridorLen,
      centerZ,
      CORRIDOR_HALF_W,
      CORRIDOR_WALL_THICK,
      doorZs,
    );
    this.buildCorridorSafetySigns(corridorLen, centerZ);
    this.buildCorridorDisplays(roomCount, centerZ);
  }

  /** 走廊两端封端墙，避免尽头露出场景背景 */
  private addCorridorEndWall(
    z: number,
    wallMat: THREE.Material,
    kickMat: THREE.Material,
  ) {
    if (!this.corridorGroup)
      return;

    const wallH = CORRIDOR_CEILING_H;
    const innerW = CORRIDOR_HALF_W * 2 - CORRIDOR_WALL_THICK * 2;
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(innerW, wallH, CORRIDOR_WALL_THICK),
      wallMat,
    );
    wall.position.set(0, wallH / 2, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    this.corridorGroup.add(wall);

    const kick = new THREE.Mesh(
      new THREE.BoxGeometry(innerW + 0.02, 0.1, CORRIDOR_WALL_THICK + 0.01),
      kickMat,
    );
    kick.position.set(0, 0.05, z);
    this.corridorGroup.add(kick);

    const bandMat = new THREE.MeshStandardMaterial({ color: 0xc5dcc8, roughness: 0.82 });
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(innerW, 0.55, CORRIDOR_WALL_THICK + 0.008),
      bandMat,
    );
    band.position.set(0, 1.15, z);
    this.corridorGroup.add(band);
  }

  /** 走廊屏 Z：病房区末端（远离护士站），屏幕朝向护士站 */
  private getCorridorDisplayZ(roomCount: number) {
    const { lastRowZ, corridorStartZ } = this.getRoomLayoutMetrics(roomCount);
    if (roomCount <= 1)
      return Math.max(corridorStartZ + 1.5, lastRowZ - 0.5);
    return lastRowZ - 4;
  }

  private buildCorridorDisplays(roomCount: number, _centerZ: number) {
    if (!this.corridorGroup)
      return;

    this.disposeCorridorDisplays();
    const data = this.getCorridorDisplayData();
    const texture = createCorridorScreenTexture(data);
    const built = buildCorridorCeilingDisplay(
      this.corridorGroup,
      this.getCorridorDisplayZ(roomCount),
      CORRIDOR_CEILING_H,
      NURSE_STATION.z,
      texture,
    );
    this.corridorDisplays.push({ screen: built.screen, texture: built.texture });
  }

  private getNurseStationDisplayInfo(): NurseStationDisplayInfo {
    const staff = this.area?.rooms[0]?.doorStaff;
    return {
      areaName: this.area?.areaName ?? '病区',
      deptName: this.area?.deptName,
      dutyNurseName: staff?.areaHeadNurseName,
      dutyDoctorName: staff?.deptDirectorName ?? staff?.areaDirectorName,
    };
  }

  private getCorridorDisplayData(): CorridorDisplayData {
    const info = this.getNurseStationDisplayInfo();
    const callingCount = this.summaries.reduce((sum, item) => sum + item.callingCount, 0);
    return {
      areaName: info.areaName ?? '病区',
      deptName: info.deptName,
      dutyNurseName: info.dutyNurseName,
      dutyDoctorName: info.dutyDoctorName,
      emergencyPhone: info.emergencyPhone,
      bulletin: info.bulletin,
      callingCount: callingCount || undefined,
    };
  }

  private refreshNurseStationDisplay() {
    this.refreshNurseStationBoardDisplays();
  }

  private refreshCorridorDisplays() {
    this.refreshCorridorModelDisplays();
    if (!this.corridorDisplays.length)
      return;

    const data = this.getCorridorDisplayData();
    for (const display of this.corridorDisplays) {
      const material = display.screen.material as THREE.MeshBasicMaterial;
      display.texture.dispose();
      display.texture = createCorridorScreenTexture(data);
      material.map = display.texture;
      material.needsUpdate = true;
      display.texture.needsUpdate = true;
    }
  }

  private disposeCorridorDisplays() {
    for (const display of this.corridorDisplays) {
      display.texture.dispose();
    }
    this.corridorDisplays = [];
    this.disposeCorridorModelDisplays();
  }

  private getAreaBoardStats() {
    const live = buildNurseStationLiveData(this.area ?? {
      areaName: '', areaCode: '', deptName: '', rooms: [],
    }, this.summaries);
    return {
      totalRooms: live.rooms,
      totalBeds: live.totalBeds,
      occupiedBeds: live.occupiedBeds,
      emptyBeds: live.emptyBeds,
      occupiedRate: live.occupiedRate,
      callingCount: live.callingCount,
      infusingCount: live.infusingCount,
      offlineCount: live.offlineBedCount,
      envWarningCount: live.envWarningCount,
      onlineRate: live.deviceHealthRate,
      deviceTotal: live.deviceTotal,
      deviceOnline: live.deviceOnline,
      priorityRooms: live.priorityRooms,
      patientBeds: live.patientBeds,
    };
  }

  private createBoardCanvas(width: number, height: number) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    return { canvas, ctx };
  }

  private makeBoardTexture(canvas: HTMLCanvasElement) {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    texture.needsUpdate = true;
    return texture;
  }

  private drawBoardRoundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  private drawTruncatedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
  ) {
    if (ctx.measureText(text).width <= maxWidth) {
      ctx.fillText(text, x, y);
      return;
    }

    let value = text;
    while (value.length > 1 && ctx.measureText(`${value}…`).width > maxWidth)
      value = value.slice(0, -1);
    ctx.fillText(`${value}…`, x, y);
  }

  private drawBoardPill(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    w: number,
    h: number,
    options: { bg: string; fg?: string; stroke?: string; fontSize?: number },
  ) {
    ctx.save();
    ctx.fillStyle = options.bg;
    this.drawBoardRoundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();
    if (options.stroke) {
      ctx.strokeStyle = options.stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.fillStyle = options.fg ?? '#ffffff';
    ctx.font = `bold ${options.fontSize ?? 22}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2 + 1);
    ctx.restore();
  }

  private createLeftEducationTexture() {
    const { canvas, ctx } = this.createBoardCanvas(960, 540);
    const info = this.getNurseStationDisplayInfo();

    const bg = ctx.createLinearGradient(0, 0, 960, 540);
    bg.addColorStop(0, '#061521');
    bg.addColorStop(0.58, '#0b2a34');
    bg.addColorStop(1, '#102f2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 960, 540);

    ctx.fillStyle = 'rgba(123,223,242,0.16)';
    ctx.fillRect(48, 42, 864, 5);
    this.drawBoardPill(ctx, '健康宣教视频', 52, 70, 208, 46, {
      bg: 'rgba(79,195,247,0.18)',
      fg: '#d7f6ff',
      stroke: 'rgba(79,195,247,0.48)',
      fontSize: 25,
    });
    this.drawBoardPill(ctx, info.areaName ?? '智慧病区', 720, 70, 188, 46, {
      bg: 'rgba(52,211,153,0.14)',
      fg: '#d7f6ff',
      stroke: 'rgba(52,211,153,0.42)',
      fontSize: 24,
    });

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(142, 246, 68, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(6,21,33,0.42)';
    ctx.beginPath();
    ctx.moveTo(124, 208);
    ctx.lineTo(124, 284);
    ctx.lineTo(184, 246);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 68px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('手卫生宣教', 252, 206);
    ctx.fillStyle = '#d7f6ff';
    ctx.font = 'bold 42px "Microsoft YaHei", sans-serif';
    ctx.fillText('如何正确洗手', 254, 282);
    ctx.fillStyle = '#9ccfd8';
    ctx.font = '28px "Microsoft YaHei", sans-serif';
    this.drawTruncatedText(ctx, '视频加载中 · 来源 CDC 公开健康宣教资源', 256, 342, 600);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    this.drawBoardRoundRect(ctx, 54, 424, 852, 54, 18);
    ctx.fill();
    ctx.fillStyle = '#bdeff7';
    ctx.font = '25px "Microsoft YaHei", sans-serif';
    ctx.fillText(info.deptName ?? '智慧病房护理单元', 84, 452);

    return this.makeBoardTexture(canvas);
  }

  private createLeftQueueTexture() {
    const { canvas, ctx } = this.createBoardCanvas(420, 360);
    const stats = this.getAreaBoardStats();

    ctx.fillStyle = '#071521';
    ctx.fillRect(0, 0, 420, 360);
    ctx.fillStyle = '#d7f6ff';
    ctx.font = 'bold 34px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('分诊叫号', 28, 44);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 72px "Consolas", "Microsoft YaHei", monospace';
    ctx.fillText('A018', 34, 126);
    this.drawBoardPill(ctx, '请到护士站', 34, 156, 160, 42, {
      bg: 'rgba(79,195,247,0.18)',
      fg: '#d7f6ff',
      stroke: 'rgba(79,195,247,0.55)',
      fontSize: 23,
    });
    this.drawBoardPill(ctx, `候诊 ${Math.max(0, stats.totalRooms - stats.callingCount)} 人`, 212, 156, 158, 42, {
      bg: 'rgba(128,203,196,0.16)',
      fg: '#d7f6ff',
      stroke: 'rgba(128,203,196,0.48)',
      fontSize: 23,
    });

    ctx.fillStyle = '#9ccfd8';
    ctx.font = '24px "Microsoft YaHei", sans-serif';
    ctx.fillText(`待处理呼叫 ${stats.callingCount} 项`, 34, 250);
    ctx.fillStyle = '#4fc3f7';
    ctx.fillRect(34, 284, 336, 8);

    return this.makeBoardTexture(canvas);
  }

  private createKioskScreenTexture() {
    const { canvas, ctx } = this.createBoardCanvas(360, 620);
    const info = this.getNurseStationDisplayInfo();

    ctx.fillStyle = '#06131c';
    ctx.fillRect(0, 0, 360, 620);
    ctx.fillStyle = '#d7f6ff';
    ctx.font = 'bold 38px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('自助服务', 180, 58);
    ctx.fillStyle = '#7bdff2';
    ctx.font = '22px "Microsoft YaHei", sans-serif';
    this.drawTruncatedText(ctx, info.areaName ?? '病区', 64, 100, 232);

    const actions = [
      ['签到', '#4fc3f7'],
      ['查询', '#80cbc4'],
      ['缴费', '#ffb74d'],
      ['呼叫', '#ff5c8a'],
    ];
    actions.forEach(([label, color], index) => {
      const y = 152 + index * 96;
      this.drawBoardPill(ctx, label, 54, y, 252, 58, {
        bg: `${color}22`,
        fg: '#ffffff',
        stroke: `${color}88`,
        fontSize: 30,
      });
    });

    ctx.fillStyle = 'rgba(123,223,242,0.12)';
    this.drawBoardRoundRect(ctx, 42, 548, 276, 40, 14);
    ctx.fill();
    ctx.fillStyle = '#bdeff7';
    ctx.font = '22px "Microsoft YaHei", sans-serif';
    ctx.fillText('请刷卡或扫码', 180, 568);

    return this.makeBoardTexture(canvas);
  }

  private createWorkstationScreenTexture(side: 'left' | 'right') {
    const { canvas, ctx } = this.createBoardCanvas(640, 280);
    const stats = this.getAreaBoardStats();
    const rooms = [...this.summaries]
      .sort((a, b) => {
        const rank = { calling: 0, danger: 1, offline: 2, infusing: 3, warning: 4, normal: 5, empty: 6 };
        return rank[a.priority] - rank[b.priority];
      })
      .slice(0, 3);
    const now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });

    const bg = ctx.createLinearGradient(0, 0, 640, 280);
    bg.addColorStop(0, '#061521');
    bg.addColorStop(1, side === 'left' ? '#0f2d38' : '#132a31');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 640, 280);
    ctx.fillStyle = 'rgba(123,223,242,0.16)';
    ctx.fillRect(28, 24, 584, 4);

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e7fbff';
    ctx.font = 'bold 40px "Microsoft YaHei", sans-serif';
    ctx.fillText(side === 'left' ? '护理工作台' : '病区监测台', 28, 58);
    ctx.fillStyle = '#8bd8e7';
    ctx.font = '26px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(now, 604, 58);
    ctx.textAlign = 'left';

    if (side === 'left') {
      const cards: Array<[string, string, string]> = [
        ['待处理呼叫', `${stats.callingCount}`, stats.callingCount > 0 ? '#ff5c8a' : '#7bdff2'],
        ['输液巡视', `${stats.infusingCount}`, '#ffb74d'],
        ['重点病房', `${rooms.length}`, '#80cbc4'],
      ];
      cards.forEach(([label, value, color], index) => {
        const x = 28 + index * 196;
        ctx.fillStyle = 'rgba(255,255,255,0.075)';
        this.drawBoardRoundRect(ctx, x, 96, 174, 96, 16);
        ctx.fill();
        ctx.strokeStyle = `${color}88`;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = 'bold 48px "Microsoft YaHei", sans-serif';
        ctx.fillText(value, x + 18, 136);
        ctx.fillStyle = '#a8c8d2';
        ctx.font = '24px "Microsoft YaHei", sans-serif';
        ctx.fillText(label, x + 18, 172);
      });

      rooms.slice(0, 2).forEach((room, index) => {
        const y = 222 + index * 40;
        ctx.fillStyle = room.accentColor;
        ctx.fillRect(34, y - 14, 8, 28);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 27px "Microsoft YaHei", sans-serif';
        this.drawTruncatedText(ctx, room.sickroomName, 56, y, 166);
        this.drawBoardPill(ctx, room.statusText, 248, y - 19, 156, 34, {
          bg: `${room.accentColor}30`,
          fg: '#ffffff',
          stroke: `${room.accentColor}88`,
          fontSize: 20,
        });
        ctx.fillStyle = '#b7d5dd';
        ctx.font = '23px "Microsoft YaHei", sans-serif';
        ctx.fillText(`${room.occupiedBeds}/${room.totalBeds} 在床`, 426, y);
      });
    }
    else {
      const metrics: Array<[string, string, string]> = [
        ['床位', `${stats.occupiedBeds}/${stats.totalBeds}`, '#4fc3f7'],
      ['设备在线', stats.onlineRate == null ? '暂无数据' : `${stats.onlineRate}%`, stats.offlineCount > 0 ? '#ff7043' : '#80cbc4'],
        ['环境预警', `${stats.envWarningCount}`, stats.envWarningCount > 0 ? '#ffb74d' : '#7bdff2'],
      ];
      metrics.forEach(([label, value, color], index) => {
        const y = 96 + index * 58;
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        this.drawBoardRoundRect(ctx, 32, y, 560, 48, 14);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.fillRect(48, y + 11, 9, 26);
        ctx.fillStyle = '#dff8ff';
        ctx.font = 'bold 27px "Microsoft YaHei", sans-serif';
        ctx.fillText(label, 76, y + 24);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 34px "Microsoft YaHei", sans-serif';
        ctx.fillText(value, 566, y + 24);
        ctx.textAlign = 'left';
      });
      ctx.fillStyle = 'rgba(123,223,242,0.14)';
      this.drawBoardRoundRect(ctx, 32, 248, 560, 28, 12);
      ctx.fill();
      ctx.fillStyle = '#bdeff7';
      ctx.font = '22px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('门口机接入正常 · 数据同步中', 312, 262);
    }

    return this.makeBoardTexture(canvas);
  }

  private createNurseWorkScreenTexture(
    kind: 'taskQueue' | 'wardStatus' | 'bedMonitor' | 'deviceHealth',
  ) {
    const { canvas, ctx } = this.createBoardCanvas(960, 520);
    const stats = this.getAreaBoardStats();
    const sortedRooms = [...this.summaries]
      .sort((a, b) => {
        const rank = { calling: 0, danger: 1, offline: 2, infusing: 3, warning: 4, normal: 5, empty: 6 };
        return rank[a.priority] - rank[b.priority];
      });
    const titles = {
      taskQueue: '任务队列',
      wardStatus: '病房状态',
      bedMonitor: '床位监测',
      deviceHealth: '设备与环境',
    };
    const now = new Date().toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const bg = ctx.createLinearGradient(0, 0, 960, 520);
    bg.addColorStop(0, '#071521');
    bg.addColorStop(1, '#102c36');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 960, 520);
    ctx.fillStyle = '#153b49';
    ctx.fillRect(0, 0, 960, 92);
    ctx.fillStyle = '#7bdff2';
    ctx.fillRect(0, 88, 960, 4);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e7fbff';
    ctx.font = 'bold 42px "Microsoft YaHei", sans-serif';
    ctx.fillText(titles[kind], 42, 46);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#9ccfd8';
    ctx.font = '28px "Consolas", "Microsoft YaHei", monospace';
    ctx.fillText(now, 918, 46);
    ctx.textAlign = 'left';

    const drawMetric = (x: number, y: number, w: number, label: string, value: string, color: string) => {
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      this.drawBoardRoundRect(ctx, x, y, w, 144, 18);
      ctx.fill();
      ctx.strokeStyle = `${color}88`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.fillRect(x + 20, y + 22, 8, 98);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 62px "Microsoft YaHei", sans-serif';
      ctx.fillText(value, x + 50, y + 63);
      ctx.fillStyle = '#a8c8d2';
      ctx.font = '26px "Microsoft YaHei", sans-serif';
      ctx.fillText(label, x + 52, y + 108);
    };

    const drawRoomRow = (room: RoomSummary, y: number) => {
      ctx.fillStyle = 'rgba(255,255,255,0.065)';
      this.drawBoardRoundRect(ctx, 42, y, 876, 94, 16);
      ctx.fill();
      ctx.fillStyle = room.accentColor;
      ctx.fillRect(42, y + 17, 9, 60);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 34px "Microsoft YaHei", sans-serif';
      this.drawTruncatedText(ctx, room.sickroomName, 78, y + 38, 230);
      ctx.fillStyle = '#9ccfd8';
      ctx.font = '26px "Microsoft YaHei", sans-serif';
      ctx.fillText(`${room.occupiedBeds}/${room.totalBeds} 在床`, 78, y + 70);
      this.drawBoardPill(ctx, room.statusText, 650, y + 25, 218, 46, {
        bg: `${room.accentColor}2e`,
        fg: '#ffffff',
        stroke: `${room.accentColor}99`,
        fontSize: 25,
      });
    };

    if (kind === 'taskQueue') {
      const pendingCount = stats.callingCount + stats.offlineCount + stats.envWarningCount;
      drawMetric(42, 122, 260, '紧急呼叫', `${stats.callingCount}`, stats.callingCount > 0 ? '#ff5c8a' : '#7bdff2');
      drawMetric(326, 122, 260, '待处理', `${pendingCount}`, pendingCount > 0 ? '#ffb74d' : '#7bdff2');
      const priorityRoom = sortedRooms[0];
      ctx.fillStyle = 'rgba(255,255,255,0.065)';
      this.drawBoardRoundRect(ctx, 42, 298, 876, 164, 18);
      ctx.fill();
      ctx.fillStyle = '#9ccfd8';
      ctx.font = '27px "Microsoft YaHei", sans-serif';
      ctx.fillText('最高优先级', 76, 336);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 42px "Microsoft YaHei", sans-serif';
      ctx.fillText(priorityRoom?.sickroomName ?? '暂无待处理任务', 76, 396);
      if (priorityRoom) {
        this.drawBoardPill(ctx, priorityRoom.statusText, 646, 366, 220, 52, {
          bg: `${priorityRoom.accentColor}30`,
          fg: '#ffffff',
          stroke: `${priorityRoom.accentColor}aa`,
          fontSize: 27,
        });
      }
    }
    else if (kind === 'wardStatus') {
      if (sortedRooms.length) {
        sortedRooms.slice(0, 3).forEach((room, index) => drawRoomRow(room, 116 + index * 116));
      }
      else {
        ctx.fillStyle = '#9ccfd8';
        ctx.font = '34px "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('暂无病房数据', 480, 300);
      }
    }
    else if (kind === 'bedMonitor') {
      drawMetric(42, 132, 270, '在床患者', `${stats.occupiedBeds}/${stats.totalBeds}`, '#7bdff2');
      drawMetric(345, 132, 270, '输液中', `${stats.infusingCount}`, stats.infusingCount > 0 ? '#ffb74d' : '#7bdff2');
      drawMetric(648, 132, 270, '待巡视', `${stats.infusingCount}`, stats.infusingCount > 0 ? '#ffb74d' : '#7bdff2');
      ctx.fillStyle = 'rgba(123,223,242,0.12)';
      this.drawBoardRoundRect(ctx, 42, 326, 876, 108, 18);
      ctx.fill();
      ctx.fillStyle = '#bdeff7';
      ctx.font = 'bold 34px "Microsoft YaHei", sans-serif';
      ctx.fillText(`空床 ${Math.max(0, stats.totalBeds - stats.occupiedBeds)} 张`, 78, 380);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#9ccfd8';
      ctx.font = '28px "Microsoft YaHei", sans-serif';
      ctx.fillText(`床位使用率 ${stats.occupiedRate == null ? '暂无数据' : `${stats.occupiedRate}%`}`, 882, 380);
    }
    else {
      drawMetric(42, 132, 270, '设备在线率', stats.onlineRate == null ? '暂无数据' : `${stats.onlineRate}%`, stats.offlineCount > 0 ? '#ffb74d' : '#7bdff2');
      drawMetric(345, 132, 270, '离线设备', `${stats.offlineCount}`, stats.offlineCount > 0 ? '#ff5c8a' : '#7bdff2');
      drawMetric(648, 132, 270, '环境预警', `${stats.envWarningCount}`, stats.envWarningCount > 0 ? '#ffb74d' : '#7bdff2');
      ctx.fillStyle = 'rgba(123,223,242,0.12)';
      this.drawBoardRoundRect(ctx, 42, 326, 876, 108, 18);
      ctx.fill();
      ctx.fillStyle = stats.offlineCount || stats.envWarningCount ? '#ffcf8a' : '#9fe5d8';
      ctx.font = 'bold 34px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(stats.offlineCount || stats.envWarningCount ? '请按优先级完成设备巡检' : '暂无设备与环境告警', 480, 380);
    }

    return this.makeBoardTexture(canvas);
  }

  private createNurseRearShiftTexture() {
    const { canvas, ctx } = this.createBoardCanvas(900, 640);
    const info = this.getNurseStationDisplayInfo();
    const bg = ctx.createLinearGradient(0, 0, 900, 640);
    bg.addColorStop(0, '#071521');
    bg.addColorStop(1, '#123039');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 900, 640);
    ctx.fillStyle = '#153b49';
    ctx.fillRect(0, 0, 900, 104);
    ctx.fillStyle = '#7bdff2';
    ctx.fillRect(0, 100, 900, 4);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e7fbff';
    ctx.font = 'bold 58px "Microsoft YaHei", sans-serif';
    ctx.fillText('护理交班', 42, 54);

    const liveRoom = this.summaries
      .slice()
      .sort((left, right) => right.callingCount - left.callingCount || right.occupiedBeds - left.occupiedBeds)[0];
    const rows = [
      ['护士长', info.dutyNurseName ?? '暂无数据'],
      ['责任医生', info.dutyDoctorName ?? '暂无数据'],
      ['实时交班', liveRoom ? `${liveRoom.sickroomName} ${liveRoom.statusText}` : '暂无数据'],
    ];
    rows.forEach(([label, value], index) => {
      const y = 138 + index * 112;
      ctx.fillStyle = 'rgba(255,255,255,0.065)';
      this.drawBoardRoundRect(ctx, 42, y, 816, 88, 16);
      ctx.fill();
      ctx.fillStyle = '#9ccfd8';
      ctx.font = '34px "Microsoft YaHei", sans-serif';
      ctx.fillText(label, 76, y + 44);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 42px "Microsoft YaHei", sans-serif';
      this.drawTruncatedText(ctx, value, 824 - Math.min(420, ctx.measureText(value).width), y + 44, 420);
      ctx.textAlign = 'left';
    });

    ctx.fillStyle = 'rgba(255,183,77,0.14)';
    this.drawBoardRoundRect(ctx, 42, 500, 816, 92, 16);
    ctx.fill();
    ctx.fillStyle = '#ffcf8a';
    ctx.font = 'bold 34px "Microsoft YaHei", sans-serif';
    ctx.fillText('公告', 74, 532);
    ctx.fillStyle = '#e7f2f4';
    ctx.font = '31px "Microsoft YaHei", sans-serif';
    this.drawTruncatedText(ctx, info.bulletin ?? '暂无公告', 74, 566, 742);
    return this.makeBoardTexture(canvas);
  }

  private createNurseRearDashboardTexture() {
    const { canvas, ctx } = this.createBoardCanvas(1200, 640);
    const stats = this.getAreaBoardStats();
    const info = this.getNurseStationDisplayInfo();
    const now = new Date();
    const time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    const bg = ctx.createLinearGradient(0, 0, 1200, 640);
    bg.addColorStop(0, '#06141f');
    bg.addColorStop(1, '#10313a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1200, 640);
    ctx.fillStyle = '#153b49';
    ctx.fillRect(0, 0, 1200, 112);
    ctx.fillStyle = '#7bdff2';
    ctx.fillRect(0, 108, 1200, 4);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e7fbff';
    ctx.font = 'bold 48px "Microsoft YaHei", sans-serif';
    ctx.fillText('病区态势', 48, 56);
    ctx.fillStyle = '#9ccfd8';
    ctx.font = '28px "Microsoft YaHei", sans-serif';
    this.drawTruncatedText(ctx, info.areaName ?? '智慧病区', 276, 58, 520);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 46px "Consolas", "Microsoft YaHei", monospace';
    ctx.fillText(time, 1152, 56);

    const metrics: Array<[string, string, string]> = [
      ['在床患者', `${stats.occupiedBeds}/${stats.totalBeds}`, '#7bdff2'],
      ['待处理呼叫', `${stats.callingCount}`, stats.callingCount > 0 ? '#ff5c8a' : '#7bdff2'],
      ['输液巡视', `${stats.infusingCount}`, stats.infusingCount > 0 ? '#ffb74d' : '#7bdff2'],
      ['设备在线率', stats.onlineRate == null ? '暂无数据' : `${stats.onlineRate}%`, stats.offlineCount > 0 ? '#ffb74d' : '#80cbc4'],
    ];
    metrics.forEach(([label, value, color], index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = 48 + col * 564;
      const y = 150 + row * 206;
      ctx.fillStyle = 'rgba(255,255,255,0.065)';
      this.drawBoardRoundRect(ctx, x, y, 516, 172, 20);
      ctx.fill();
      ctx.strokeStyle = `${color}66`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.fillRect(x + 24, y + 28, 9, 112);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 66px "Microsoft YaHei", sans-serif';
      ctx.fillText(value, x + 62, y + 70);
      ctx.fillStyle = '#9ccfd8';
      ctx.font = '30px "Microsoft YaHei", sans-serif';
      ctx.fillText(label, x + 64, y + 126);
    });
    return this.makeBoardTexture(canvas);
  }

  private createNurseRearPriorityTexture() {
    const { canvas, ctx } = this.createBoardCanvas(900, 640);
    const sortedRooms = [...this.summaries]
      .sort((a, b) => {
        const rank = { calling: 0, danger: 1, offline: 2, infusing: 3, warning: 4, normal: 5, empty: 6 };
        return rank[a.priority] - rank[b.priority];
      })
      .slice(0, 3);
    const bg = ctx.createLinearGradient(0, 0, 900, 640);
    bg.addColorStop(0, '#071521');
    bg.addColorStop(1, '#123039');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 900, 640);
    ctx.fillStyle = '#153b49';
    ctx.fillRect(0, 0, 900, 104);
    ctx.fillStyle = '#7bdff2';
    ctx.fillRect(0, 100, 900, 4);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e7fbff';
    ctx.font = 'bold 58px "Microsoft YaHei", sans-serif';
    ctx.fillText('患者状态', 42, 54);
    const attentionCount = this.summaries.filter(room => room.priority !== 'normal' && room.priority !== 'empty').length;
    this.drawBoardPill(ctx, attentionCount ? `${attentionCount} 项异常` : '运行正常', 660, 27, 194, 50, {
      bg: attentionCount ? 'rgba(255,92,138,0.18)' : 'rgba(123,223,242,0.14)',
      fg: attentionCount ? '#ffb4c5' : '#bdeff7',
      stroke: attentionCount ? 'rgba(255,92,138,0.5)' : 'rgba(123,223,242,0.4)',
      fontSize: 30,
    });

    if (!sortedRooms.length) {
      ctx.fillStyle = '#9fe5d8';
      ctx.font = 'bold 50px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('暂无患者数据', 450, 330);
    }
    sortedRooms.forEach((room, index) => {
      const y = 138 + index * 150;
      ctx.fillStyle = 'rgba(255,255,255,0.065)';
      this.drawBoardRoundRect(ctx, 42, y, 816, 118, 18);
      ctx.fill();
      ctx.fillStyle = room.accentColor;
      ctx.fillRect(42, y + 18, 10, 82);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 46px "Microsoft YaHei", sans-serif';
      this.drawTruncatedText(ctx, room.sickroomName, 80, y + 42, 300);
      ctx.fillStyle = '#9ccfd8';
      ctx.font = '32px "Microsoft YaHei", sans-serif';
      ctx.fillText(`${room.occupiedBeds}/${room.totalBeds} 在床 · 呼叫 ${room.callingCount} · 输液 ${room.infusingCount}`, 80, y + 82);
      this.drawBoardPill(ctx, room.statusText, 600, y + 36, 210, 50, {
        bg: `${room.accentColor}30`,
        fg: '#ffffff',
        stroke: `${room.accentColor}aa`,
        fontSize: 31,
      });
    });
    return this.makeBoardTexture(canvas);
  }

  private createNurseStationBoardTexture(kind: NurseStationBoardKind) {
    if (kind === 'clock')
      return this.createNurseStationClockTexture();
    if (kind === 'dashboard')
      return this.createNurseRearDashboardTexture();
    if (kind === 'whiteboard')
      return this.createNurseRearShiftTexture();
    if (kind === 'roomStatus')
      return this.createNurseRearPriorityTexture();
    if (kind === 'education')
      return this.createLeftEducationTexture();
    if (kind === 'queue')
      return this.createLeftQueueTexture();
    if (kind === 'workLeft')
      return this.createWorkstationScreenTexture('left');
    if (kind === 'workRight')
      return this.createWorkstationScreenTexture('right');
    if (kind === 'taskQueue' || kind === 'wardStatus' || kind === 'bedMonitor' || kind === 'deviceHealth')
      return this.createNurseWorkScreenTexture(kind);
    return this.createKioskScreenTexture();
  }

  private createNurseStationClockTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 192;
    const ctx = canvas.getContext('2d')!;
    const now = new Date();
    const time = now.toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const date = now.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    });

    ctx.fillStyle = '#050708';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff2d2d';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#ff3b30';
    ctx.font = '700 124px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(time, canvas.width / 2, 76);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#d6dde0';
    ctx.font = '34px "Microsoft YaHei", sans-serif';
    ctx.fillText(date, canvas.width / 2, 158);
    return this.makeBoardTexture(canvas);
  }

  private createHealthEducationVideoTexture() {
    const video = document.createElement('video');
    video.src = HEALTH_EDUCATION_VIDEO_URL;
    video.crossOrigin = 'anonymous';
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.preload = 'auto';
    video.play().catch(() => {
      // Muted autoplay is usually allowed. If the browser still blocks it, the
      // poster canvas remains visible until the user interacts with the page.
    });

    const texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;

    return { texture, video };
  }

  private replaceMeshMaterialWithTexture(screen: THREE.Mesh, texture: THREE.Texture) {
    const oldMaterials = Array.isArray(screen.material) ? screen.material : [screen.material];
    for (const oldMaterial of oldMaterials) {
      for (const value of Object.values(oldMaterial)) {
        if (value instanceof THREE.Texture)
          value.dispose();
      }
      oldMaterial.dispose();
    }

    screen.material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
      toneMapped: false,
      depthWrite: false,
    });
    screen.renderOrder = 18;
  }

  private attachNurseStationTextureOverlay(
    screen: THREE.Mesh,
    texture: THREE.Texture,
    kind: NurseStationBoardKind,
  ) {
    texture.flipY = true;
    texture.needsUpdate = true;
    const oldMaterials = Array.isArray(screen.material) ? screen.material : [screen.material];
    for (const oldMaterial of oldMaterials) {
      for (const value of Object.values(oldMaterial)) {
        if (value instanceof THREE.Texture)
          value.dispose();
      }
      oldMaterial.dispose();
    }
    screen.material = new THREE.MeshBasicMaterial({ color: 0x07131b, toneMapped: false });

    screen.geometry.computeBoundingBox();
    const bounds = screen.geometry.boundingBox;
    const size = bounds?.getSize(new THREE.Vector3()) ?? new THREE.Vector3(1, 0.55, 0.02);
    const center = bounds?.getCenter(new THREE.Vector3()) ?? new THREE.Vector3();
    const axes = [
      { axis: 'x' as const, size: size.x },
      { axis: 'y' as const, size: size.y },
      { axis: 'z' as const, size: size.z },
    ].sort((a, b) => a.size - b.size);
    const depthAxis = axes[0].axis;
    const surfaceAxes = axes.slice(1).sort((a, b) => b.size - a.size);
    const overlayWidth = surfaceAxes[0].size * 0.94;
    const overlayHeight = surfaceAxes[1].size * 0.9;
    const surfaceOffset = 0.002;

    const overlay = new THREE.Mesh(
      new THREE.PlaneGeometry(overlayWidth, overlayHeight),
      new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        toneMapped: false,
        depthTest: true,
        depthWrite: false,
      }),
    );
    const primaryScreenKinds = new Set<NurseStationBoardKind>(['dashboard', 'whiteboard', 'roomStatus', 'clock']);
    const overlayOpacity = primaryScreenKinds.has(kind) ? 1 : 0.78;
    const overlayMaterial = overlay.material as THREE.MeshBasicMaterial;
    overlayMaterial.transparent = overlayOpacity < 1;
    overlayMaterial.opacity = overlayOpacity;
    overlay.name = `nurse-station-screen-overlay-${kind}`;
    if (depthAxis === 'z') {
      overlay.position.set(center.x, center.y, (bounds?.max.z ?? size.z / 2) + surfaceOffset);
    }
    else if (depthAxis === 'y') {
      overlay.rotation.x = -Math.PI / 2;
      overlay.position.set(center.x, (bounds?.min.y ?? -size.y / 2) - surfaceOffset, center.z);
    }
    else {
      overlay.rotation.y = Math.PI / 2;
      overlay.position.set((bounds?.max.x ?? size.x / 2) + surfaceOffset, center.y, center.z);
    }
    overlay.renderOrder = 24;
    screen.add(overlay);
    return overlay;
  }

  private attachNurseStationBoardDisplays(model: THREE.Object3D) {
    this.disposeNurseStationBoardDisplays();
    this.hideNurseStationStaticBoardContent(model);
    const boards: Array<[NurseStationBoardKind, string]> = [
      ['dashboard', 'Screen_Main'],
      ['whiteboard', 'Board_Nursing'],
      ['roomStatus', 'Board_Patient_Status'],
      ['taskQueue', 'Screen_Work_01'],
      ['wardStatus', 'Screen_Work_02'],
      ['bedMonitor', 'Screen_Work_03'],
      ['deviceHealth', 'Screen_Work_04'],
      ['clock', 'Clock_Display'],
    ];

    for (const [kind, objectName] of boards) {
      const object = model.getObjectByName(objectName);
      if (!(object instanceof THREE.Mesh)) {
        console.warn(`[AreaScene] nurse station board mesh not found: ${objectName}`);
        continue;
      }
      const videoTexture = kind === 'education'
        ? this.createHealthEducationVideoTexture()
        : undefined;
      const texture = videoTexture?.texture ?? this.createNurseStationBoardTexture(kind);
      const overlay = this.attachNurseStationTextureOverlay(object, texture, kind);
      this.nurseStationBoardDisplays.push({ kind, screen: overlay, texture, video: videoTexture?.video });
    }
  }

  private hideNurseStationStaticBoardContent(model: THREE.Object3D) {
    const exactNames = new Set([
      'Nursing_Board_Title',
      'Patient_Board_Title',
    ]);
    const prefixes = [
      'Nursing_Bed_',
      'Nursing_Row_',
      'Nursing_Level_',
      'Patient_Room_',
      'Patient_Status_Dot_',
      'Patient_Status_Bar_',
    ];
    model.traverse((object) => {
      if (exactNames.has(object.name) || prefixes.some(prefix => object.name.startsWith(prefix)))
        object.visible = false;
    });
  }

  private refreshNurseStationBoardDisplays() {
    if (!this.nurseStationBoardDisplays.length)
      return;

    for (const display of this.nurseStationBoardDisplays) {
      if (display.video)
        continue;
      display.texture.dispose();
      display.texture = this.createNurseStationBoardTexture(display.kind);
      const material = display.screen.material as THREE.MeshBasicMaterial;
      material.map = display.texture;
      material.needsUpdate = true;
      display.texture.needsUpdate = true;
    }
  }

  private disposeNurseStationBoardDisplays() {
    for (const display of this.nurseStationBoardDisplays) {
      if (display.video) {
        display.video.pause();
        display.video.removeAttribute('src');
        display.video.load();
      }
      display.texture.dispose();
    }
    this.nurseStationBoardDisplays = [];
  }

  /** 走廊侧墙安全/导向标识，背板嵌入墙面 */
  private buildCorridorSafetySigns(corridorLen: number, centerZ: number) {
    if (!this.corridorGroup)
      return;

    const innerX = CORRIDOR_HALF_W - CORRIDOR_WALL_THICK / 2;
    const zSpan = corridorLen - 6;
    const zStart = centerZ - zSpan / 2;
    const step = zSpan / Math.max(1, CORRIDOR_SAFETY_SIGNS.length - 1);

    CORRIDOR_SAFETY_SIGNS.forEach((sign, index) => {
      const z = zStart + step * index;
      const onLeft = index % 2 === 0;
      const x = onLeft ? -innerX : innerX;
      const rotY = onLeft ? Math.PI / 2 : -Math.PI / 2;
      this.addWallMountedSign(
        this.corridorGroup!,
        x,
        2.28,
        z,
        rotY,
        sign.title,
        sign.subtitle,
        sign,
      );
    });
  }

  private createSignTexture(
    title: string,
    subtitle: string,
    options: { bg: string; fg: string; accent: string; variant: 'direction' | 'safety' },
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = options.bg;
    ctx.beginPath();
    ctx.roundRect(8, 8, 240, 112, 10);
    ctx.fill();

    ctx.strokeStyle = options.accent;
    ctx.lineWidth = 4;
    ctx.stroke();

    if (options.variant === 'safety') {
      ctx.fillStyle = options.accent;
      ctx.beginPath();
      ctx.arc(42, 64, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', 42, 66);
    }
    else {
      ctx.fillStyle = options.accent;
      ctx.beginPath();
      ctx.moveTo(42, 38);
      ctx.lineTo(58, 64);
      ctx.lineTo(26, 64);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = options.fg;
    ctx.font = 'bold 28px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, 78, 52);
    ctx.font = '16px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText(subtitle, 78, 82);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  /** 标识贴墙安装（背板嵌入墙面，牌面微凸） */
  private addWallMountedSign(
    parent: THREE.Group,
    x: number,
    y: number,
    z: number,
    rotY: number,
    title: string,
    subtitle: string,
    options: { bg: string; fg: string; accent: string; variant: 'direction' | 'safety' },
  ) {
    const tex = this.createSignTexture(title, subtitle, options);
    const normalX = Math.sin(rotY);
    const normalZ = Math.cos(rotY);

    const back = new THREE.Mesh(
      new THREE.BoxGeometry(0.88, 0.42, 0.05),
      new THREE.MeshStandardMaterial({ color: 0xf0f4f8, roughness: 0.88 }),
    );
    back.position.set(x, y, z);
    back.rotation.y = rotY;
    parent.add(back);

    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(0.84, 0.38),
      new THREE.MeshBasicMaterial({ map: tex }),
    );
    board.position.set(x + normalX * 0.028, y, z + normalZ * 0.028);
    board.rotation.y = rotY;
    parent.add(board);
  }

  private buildNurseStation() {
    const group = new THREE.Group();
    group.position.set(0, 0, NURSE_STATION.z);

    this.scene.add(group);
    this.nurseGroup = group;
    void this.loadNurseStationModel(group);
  }

  private async loadNurseStationModel(parent: THREE.Group) {
    const token = ++this.nurseStationModelLoadToken;
    const loader = new GLTFLoader();
    this.onModelState?.('loading');

    try {
      const gltf = await loader.loadAsync(NURSE_STATION_MODEL_URL);
      const model = gltf.scene;
      if (token !== this.nurseStationModelLoadToken || !this.nurseGroup) {
        this.disposeObjectTree(model);
        return;
      }

      model.name = 'blender-nurse-station';
      this.prepareLoadedModel(model);
      this.fitNurseStationModel(model);
      this.attachNurseStationBoardDisplays(model);
      parent.add(model);
      this.nurseStationModel = model;
      this.hasLoadedNurseStationModel = true;
      this.onModelState?.('ready');
      if (this.stationShell)
        this.stationShell.visible = false;
    }
    catch (error) {
      console.warn('[AreaScene] failed to load nurse station GLB', error);
      this.onModelState?.('fallback');
    }
  }

  private async loadWardCorridorModel() {
    const token = ++this.wardCorridorModelLoadToken;
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    loader.setDRACOLoader(dracoLoader);
    this.onCorridorState?.('loading');

    try {
      const gltf = await loader.loadAsync(WARD_CORRIDOR_MODEL_URL);
      const model = gltf.scene;
      if (token !== this.wardCorridorModelLoadToken) {
        this.disposeObjectTree(model);
        return;
      }

      model.name = 'blender-ward-corridor';
      this.prepareLoadedModel(model);
      normalizeHospitalCorridorModelTransform(model);
      // Keep the corridor's long axis aligned with the existing scene Z axis.
      model.rotation.y = Math.PI / 2;
      model.updateMatrixWorld(true);

      this.wardCorridorModel = model;
      this.wardCorridorModelLoaded = true;
      this.onCorridorState?.('ready');
      this.scene.add(model);
      this.bindWardCorridorSlots();
      this.updateCorridorImplementationVisibility();
      if (this.viewPhase === 'corridor')
        this.applyCorridorOverviewCamera(Math.max(this.area?.rooms.length ?? 1, 1));
    }
    catch (error) {
      this.wardCorridorModelFailed = true;
      this.onCorridorState?.('fallback');
      console.warn('[AreaScene] failed to load ward corridor GLB, using generated fallback', error);
      this.updateCorridorImplementationVisibility();
    }
    finally {
      dracoLoader.dispose();
    }
  }

  private bindWardCorridorSlots() {
    if (!this.wardCorridorModel)
      return;

    this.disposeWardCorridorOverlays();
    this.disposeWardCorridorTextures();
    const rooms = this.area?.rooms ?? [];
    const slots = buildWardCorridorSlots(rooms);
    const bindings = slots.map(slot => ({ slot } as WardCorridorModelBinding));
    const meshes: THREE.Mesh[] = [];
    const modelNodes: THREE.Object3D[] = [];

    this.wardCorridorModel.traverse((obj) => {
      modelNodes.push(obj);
      if (obj instanceof THREE.Mesh)
        meshes.push(obj);
    });
    this.bindCorridorModelDisplays(modelNodes);

    const doors = getHospitalCorridorDoorOrder(modelNodes);
    // 门口机节点可能是 Blender 导出的 Group，屏幕网格通常挂在其子节点下；
    // 因此这里必须在完整节点树上按“门口机1…”名称识别，而不能只扫描 Mesh。
    const materialScreenMeshes = getHospitalCorridorEntranceScreenOrder(modelNodes);
    const entranceDevices = materialScreenMeshes.length
      ? materialScreenMeshes
      : getHospitalCorridorEntranceDeviceOrder(modelNodes);
    const unpairedEntranceDevices = [...entranceDevices];
    if (doors.length < bindings.length) {
      console.warn(`[AreaScene] hospital corridor model exposes ${doors.length} of ${bindings.length} expected doors`);
    }
    doors.slice(0, bindings.length).forEach((door, index) => {
      const binding = bindings[index];
      binding.door = door as THREE.Mesh;
      binding.door.userData.roomIndex = binding.slot.roomIndex;
      binding.door.userData.role = binding.slot.interactive
        ? 'wardCorridorDoor'
        : 'emptyWardCorridorDoor';
      const doorCenter = new THREE.Box3().setFromObject(binding.door).getCenter(new THREE.Vector3());
      // 优先按同编号绑定（门1 ↔ 门口机1），避免模型空间排序变化导致错配；
      // 只有节点未按编号命名时才回退到空间最近匹配。
      const expectedDeviceName = binding.door.name.replace(/^门(?=\d+$)/, '门口机');
      let nearestDeviceIndex = unpairedEntranceDevices.findIndex(
        device => device.name === expectedDeviceName,
      );
      let nearestDistance = Number.POSITIVE_INFINITY;
      if (nearestDeviceIndex < 0) {
        unpairedEntranceDevices.forEach((device, deviceIndex) => {
          const deviceCenter = new THREE.Box3().setFromObject(device).getCenter(new THREE.Vector3());
          const distance = doorCenter.distanceToSquared(deviceCenter);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestDeviceIndex = deviceIndex;
          }
        });
      }
      const entranceDevice = nearestDeviceIndex >= 0
        ? unpairedEntranceDevices.splice(nearestDeviceIndex, 1)[0]
        : undefined;
      const overlays = this.createHospitalCorridorDoorOverlays(binding.door, entranceDevice);
      binding.screen = overlays.screen;
      binding.screenMaterialIndex = overlays.screenMaterialIndex;
      binding.screenAspect = overlays.screenAspect;
      binding.label = overlays.label;
    });

    for (const binding of bindings) {
      binding.labelTexture = this.createWardCorridorLabelTexture(binding.slot.label, binding.slot.interactive);
      if (binding.label)
        this.applyWardCorridorTexture(binding.label, binding.labelTexture);
      const room = binding.slot.roomIndex == null ? undefined : rooms[binding.slot.roomIndex];
      this.applyWardCorridorScreenPresentation(
        binding,
        room ? isDoorHorizontal(resolveDoorDirector(room)) : false,
      );
      binding.screenTexture = this.createEmptyWardCorridorScreenTexture(binding.slot.label);
      if (binding.screen)
        this.applyWardCorridorTexture(binding.screen, binding.screenTexture, binding.screenMaterialIndex);
    }

    this.wardCorridorBindings = bindings;
    this.wardCorridorBindingSignature = buildWardCorridorBindingSignature(rooms);
    void this.refreshWardCorridorScreens();
  }

  private bindCorridorModelDisplays(nodes: readonly THREE.Object3D[]) {
    this.disposeCorridorModelDisplays();
    const displayNodes = nodes
      .filter(node => /^走廊屏[12]$/.test(node.name))
      .flatMap(node => {
        if (node instanceof THREE.Mesh)
          return [node];
        const meshes: THREE.Mesh[] = [];
        node.traverse(child => {
          if (child instanceof THREE.Mesh)
            meshes.push(child);
        });
        return meshes;
      })
      .sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans'));

    displayNodes.slice(0, 2).forEach((screen, index) => {
      const mode: CorridorModelDisplay['mode'] = index === 0 ? 'area' : 'clock';
      const texture = createCorridorScreenTexture({
        ...this.getCorridorDisplayData(),
        mode,
      });
      const materialIndex = getHospitalCorridorEntranceScreenMaterialIndex(screen);
      const screenBounds = materialIndex >= 0
        ? getHospitalCorridorEntranceScreenBounds(screen, materialIndex)
        : (() => {
          if (!screen.geometry.boundingBox)
            screen.geometry.computeBoundingBox();
          return screen.geometry.boundingBox?.clone() ?? new THREE.Box3();
        })();
      const size = screenBounds.getSize(new THREE.Vector3());
      const center = screenBounds.getCenter(new THREE.Vector3());
      screen.updateWorldMatrix(true, false);
      const worldCenter = screen.localToWorld(center.clone());
      const worldXEdge = screen.localToWorld(center.clone().add(new THREE.Vector3(size.x, 0, 0)));
      const worldZEdge = screen.localToWorld(center.clone().add(new THREE.Vector3(0, 0, size.z)));
      const overlay = new THREE.Mesh(
        new THREE.PlaneGeometry(
          Math.max(worldCenter.distanceTo(worldXEdge), 0.1),
          Math.max(worldCenter.distanceTo(worldZEdge), 0.1),
        ),
        new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        toneMapped: false,
        // 走廊屏的显示面被模型外壳包在后面，必须作为顶层贴图显示。
        depthTest: false,
        depthWrite: false,
        }),
      );
      overlay.name = `${screen.name}-dynamic-overlay`;
      overlay.position.copy(worldCenter);
      overlay.quaternion.copy(screen.getWorldQuaternion(new THREE.Quaternion()));
      overlay.rotateX(-Math.PI / 2);
      overlay.renderOrder = 1000;
      overlay.userData.generatedCorridorDisplayOverlay = true;
      this.scene.add(overlay);
      this.corridorModelDisplays.push({ screen, overlay, texture, mode });
    });
  }

  private refreshCorridorModelDisplays() {
    if (!this.corridorModelDisplays.length)
      return;
    const data = this.getCorridorDisplayData();
    for (const display of this.corridorModelDisplays) {
      display.texture.dispose();
      display.texture = createCorridorScreenTexture({ ...data, mode: display.mode });
      const material = display.overlay.material as THREE.MeshBasicMaterial;
      material.map = display.texture;
      material.needsUpdate = true;
    }
  }

  private disposeCorridorModelDisplays() {
    for (const display of this.corridorModelDisplays) {
      display.texture.dispose();
      display.overlay.geometry.dispose();
      (display.overlay.material as THREE.Material).dispose();
      this.scene.remove(display.overlay);
    }
    this.corridorModelDisplays = [];
  }

  private createHospitalCorridorDoorOverlays(door: THREE.Mesh, entranceDevice?: THREE.Object3D) {
    if (entranceDevice instanceof THREE.Mesh) {
      const screenMaterialIndex = getHospitalCorridorEntranceScreenMaterialIndex(entranceDevice);
      if (screenMaterialIndex >= 0) {
        fitHospitalCorridorEntranceScreenGeometry(entranceDevice);
        // 直接使用模型“门口机内”几何面，避免额外平面与门框发生错位。
        entranceDevice.userData.hospitalCorridorTemplateDevice = true;
        entranceDevice.userData.hospitalCorridorTemplateMaterialIndex = screenMaterialIndex;
        this.raiseEntranceDeviceFrameLayers(entranceDevice);
        return {
          screen: entranceDevice as THREE.Mesh,
          label: undefined,
          screenMaterialIndex,
          screenAspect: getHospitalCorridorEntranceScreenAspect(entranceDevice),
        };
      }
    }

    if (!this.wardCorridorOverlayGroup) {
      this.wardCorridorOverlayGroup = new THREE.Group();
      this.wardCorridorOverlayGroup.name = 'hospital-corridor-dynamic-overlays';
      this.scene.add(this.wardCorridorOverlayGroup);
    }

    const doorBounds = new THREE.Box3().setFromObject(door);
    const templateBounds = entranceDevice
      ? new THREE.Box3().setFromObject(entranceDevice)
      : doorBounds;
    const center = templateBounds.getCenter(new THREE.Vector3());
    const size = templateBounds.getSize(new THREE.Vector3());
    const doorCenter = doorBounds.getCenter(new THREE.Vector3());
    const towardCorridor = doorCenter.x >= 0 ? -1 : 1;
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        toneMapped: false,
        depthTest: false,
        depthWrite: false,
      }),
    );
    screen.name = `${door.name}-dynamic-screen`;
    screen.userData.generatedHospitalCorridorOverlay = true;
    screen.rotation.y = towardCorridor > 0 ? Math.PI / 2 : -Math.PI / 2;
    screen.position.set(
      center.x + towardCorridor * Math.max(size.x * 0.18, 0.035),
      center.y + 0.08,
      center.z,
    );
    // PlaneGeometry 经 Y 轴旋转后，X 轴对应模型 Z 方向；按门口机尺寸铺开，
    // 不再使用固定尺寸，避免模板跑到门口机顶部或被墙体遮住。
    screen.scale.set(
      Math.max(size.z * 0.82, 0.34),
      Math.max(size.y * 0.82, 0.42),
      1,
    );
    screen.renderOrder = 50;

    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        color: 0x43e6ff,
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    glow.name = `${door.name}-screen-highlight`;
    glow.userData.generatedHospitalCorridorOverlay = true;
    glow.rotation.copy(screen.rotation);
    glow.position.copy(screen.position);
    glow.position.x -= towardCorridor * 0.008;
    glow.scale.copy(screen.scale).multiplyScalar(1.12);
    glow.renderOrder = 49;

    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        toneMapped: false,
        depthTest: false,
        depthWrite: false,
      }),
    );
    label.name = `${door.name}-room-label`;
    label.userData.generatedHospitalCorridorOverlay = true;
    label.rotation.copy(screen.rotation);
    label.position.set(
      screen.position.x + towardCorridor * 0.004,
      screen.position.y + Math.max(size.y * 0.62, 0.28),
      screen.position.z,
    );
    label.scale.set(Math.max(size.z * 0.68, 0.24), Math.max(size.y * 0.18, 0.12), 1);
    label.renderOrder = 50;

    this.wardCorridorOverlayGroup.add(glow, screen, label);
    return { screen, label, screenMaterialIndex: undefined, screenAspect: undefined };
  }

  private raiseEntranceDeviceFrameLayers(device: THREE.Mesh) {
    const host = device.parent ?? device;
    host.traverse((node) => {
      if (!(node instanceof THREE.Mesh) || node.userData.hospitalCorridorTemplateDevice)
        return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      const isScreenSurface = materials.some(material => material.name.includes('门口机内'));
      if (!isScreenSurface)
        node.renderOrder = Math.max(node.renderOrder, 120);
    });
  }

  private applyWardCorridorTexture(
    mesh: THREE.Mesh,
    texture: THREE.CanvasTexture,
    materialIndex?: number,
  ) {
    texture.colorSpace = THREE.SRGBColorSpace;
    configureWardCorridorCanvasTexture(texture);
    const nextMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
      toneMapped: false,
      // 模型门口屏必须参与深度测试，斜视时由真实门框遮挡模板边缘，
      // 避免模板穿过门框显示；独立兜底平面仍保持顶层显示。
      depthTest: shouldDepthTestHospitalCorridorScreen(mesh),
      depthWrite: false,
      polygonOffset: mesh.userData.hospitalCorridorTemplateDevice,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    if (materialIndex != null && Array.isArray(mesh.material)) {
      const materials = mesh.material.slice();
      materials[materialIndex] = nextMaterial;
      mesh.material = materials;
    }
    else {
      mesh.material = nextMaterial;
    }
    mesh.renderOrder = mesh.userData.hospitalCorridorTemplateDevice ? 100 : 50;
    mesh.visible = true;
  }

  private applyWardCorridorScreenPresentation(
    binding: WardCorridorModelBinding,
    isHorizontal: boolean,
  ) {
    if (binding.screen?.userData.generatedHospitalCorridorOverlay) {
      // 生成的显示面已按“门口机1”包围盒计算尺寸，此处只更新纹理，
      // 不再用固定横竖屏尺寸覆盖其位置和缩放。
      return;
    }
    if (binding.screen?.userData.hospitalCorridorTemplateDevice)
      return;
    const presentation = getWardCorridorScreenPresentation(isHorizontal);
    if (binding.screen)
      binding.screen.scale.set(presentation.width, presentation.height, 1);
    if (binding.screenShell) {
      binding.screenShell.scale.set(
        1,
        presentation.shellHeight / 0.82,
        presentation.shellWidth / 0.62,
      );
    }
  }

  private createWardCorridorLabelTexture(label: string, interactive: boolean) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = interactive ? '#f7faf8' : '#eef1ef';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = interactive ? '#176b63' : '#66736f';
    ctx.font = '700 104px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, canvas.width / 2, canvas.height / 2 + 4);
    return new THREE.CanvasTexture(canvas);
  }

  private createEmptyWardCorridorScreenTexture(label = '空床') {
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#173b3a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#7fc4b5';
    ctx.fillRect(0, 0, canvas.width, 18);
    ctx.fillStyle = '#dcece8';
    ctx.font = '700 104px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, canvas.width / 2, canvas.height / 2 - 18);
    ctx.fillStyle = '#9cb8b2';
    ctx.font = '400 42px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText('暂无入住信息', canvas.width / 2, canvas.height / 2 + 88);
    return new THREE.CanvasTexture(canvas);
  }

  private async refreshWardCorridorScreens() {
    const area = this.area;
    if (!area || !this.wardCorridorBindings.length)
      return;
    const token = ++this.wardCorridorRefreshToken;

    await Promise.all(this.wardCorridorBindings.map(async (binding) => {
      const roomIndex = binding.slot.roomIndex;
      const room = roomIndex == null ? undefined : area.rooms[roomIndex];
      const summary = roomIndex == null ? undefined : this.summaries[roomIndex];
      if (!room || !summary || !binding.screen)
        return;
      console.info('[DoorTemplate] 走廊屏刷新', {
        room: room.sickroomName,
        templateId: room.templateId,
        hasSummary: !!summary,
        screen: binding.screen.name,
      });

      let texture: THREE.CanvasTexture;
      let isHorizontal = isDoorHorizontal(resolveDoorDirector(room));
      try {
        if (room.templateId) {
          const loadingTexture = createDoorTemplateStatusTexture(room, 'loading');
      binding.screenTexture?.dispose();
      binding.screenTexture = loadingTexture;
      this.applyWardCorridorScreenPresentation(binding, isHorizontal);
          this.applyWardCorridorTexture(binding.screen, loadingTexture, binding.screenMaterialIndex);
          const parsed = await loadParsedTemplate(room.templateId);
          isHorizontal = getDoorTerminalScreenLayout(room, parsed).isHorizontal;
          texture = await renderDoorTerminalTexture(room, summary, parsed, {
            areaName: area.areaName,
            deptName: area.deptName,
            targetAspect: binding.screenAspect
              ? (isHorizontal ? binding.screenAspect : 1 / binding.screenAspect)
              : undefined,
            fit: binding.screenAspect ? 'fill' : 'contain',
          });
        }
        else {
          texture = createDoorTemplateStatusTexture(room, 'missing');
        }
      }
      catch (error) {
        console.error('[DoorTemplate] 走廊屏渲染失败', {
          room: room.sickroomName,
          templateId: room.templateId,
          error,
        });
        texture = createDoorTemplateStatusTexture(
          room,
          'error',
          error instanceof Error ? error.message : undefined,
        );
      }

      if (token !== this.wardCorridorRefreshToken) {
        texture.dispose();
        return;
      }
      binding.screenTexture?.dispose();
      binding.screenTexture = texture;
      this.applyWardCorridorScreenPresentation(binding, isHorizontal);
      this.applyWardCorridorTexture(binding.screen, texture, binding.screenMaterialIndex);
    }));
  }

  private disposeWardCorridorTextures() {
    for (const binding of this.wardCorridorBindings) {
      binding.screenTexture?.dispose();
      binding.labelTexture?.dispose();
    }
    this.wardCorridorBindings = [];
  }

  private disposeWardCorridorOverlays() {
    if (!this.wardCorridorOverlayGroup)
      return;

    this.wardCorridorOverlayGroup.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh))
        return;
      obj.geometry.dispose();
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      materials.forEach(material => material.dispose());
    });
    this.scene.remove(this.wardCorridorOverlayGroup);
    this.wardCorridorOverlayGroup = null;
  }

  private shouldShowWardCorridorModel() {
    return this.viewPhase === 'corridor'
      && this.wardCorridorModelLoaded
      && !this.wardCorridorModelFailed
      && shouldUseWardCorridorModel(this.area?.rooms.length ?? 0);
  }

  private updateCorridorImplementationVisibility() {
    const showModel = this.shouldShowWardCorridorModel();
    if (this.wardCorridorModel)
      this.wardCorridorModel.visible = showModel;
    if (this.wardCorridorOverlayGroup)
      this.wardCorridorOverlayGroup.visible = showModel;
    // 走廊只允许显示 Blender 导出的正式模型。
    // 正式模型加载前保持空场景，避免切换瞬间闪现旧的备用几何体。
    if (this.corridorGroup)
      this.corridorGroup.visible = false;
    for (const mesh of this.roomMeshes.values())
      mesh.group.visible = false;
  }

  private prepareLoadedModel(model: THREE.Object3D) {
    model.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh))
        return;
      obj.castShadow = true;
      obj.receiveShadow = true;
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const material of materials) {
        if ('envMapIntensity' in material)
          material.envMapIntensity = 0.56;
      }
    });
  }

  attachNurseStationIntegrationDisplays(parent: THREE.Group) {
    const displayGroup = new THREE.Group();
    displayGroup.name = 'nurse-station-integration-displays';

    const createIntegrationDisplay = (
      x: number,
      kind: NurseStationBoardKind,
      width: number,
    ) => {
      const height = 0.54;
      const y = 1.44;
      const z = -1.365;
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.1, height + 0.1, 0.045),
        new THREE.MeshStandardMaterial({
          color: 0x07131b,
          metalness: 0.28,
          roughness: 0.48,
        }),
      );
      frame.name = `nurse-station-integration-frame-${kind}`;
      frame.position.set(x, y, z - 0.018);
      frame.castShadow = true;
      frame.receiveShadow = true;
      displayGroup.add(frame);

      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshBasicMaterial(),
      );
      screen.name = `nurse-station-integration-${kind}`;
      screen.position.set(x, y, z + 0.008);
      const texture = this.createNurseStationBoardTexture(kind);
      this.replaceMeshMaterialWithTexture(screen, texture);
      screen.renderOrder = 16;
      this.nurseStationBoardDisplays.push({ kind, screen, texture });
      displayGroup.add(screen);
    };

    createIntegrationDisplay(-1.1, 'whiteboard', 0.82);
    createIntegrationDisplay(1.1, 'roomStatus', 0.82);
    parent.add(displayGroup);
  }

  private fitNurseStationModel(model: THREE.Object3D) {
    model.updateMatrixWorld(true);
    const architecturalFillNames = new Set(['Detail_Full_Ceiling']);
    const initialBox = new THREE.Box3();
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || architecturalFillNames.has(object.name))
        return;
      initialBox.expandByObject(object);
    });
    const initialSize = initialBox.getSize(new THREE.Vector3());
    const maxAxis = Math.max(initialSize.x, initialSize.y, initialSize.z);
    if (maxAxis <= 0)
      return;

    const scale = Math.min(
      NURSE_STATION_MODEL_MAX_SIZE.x / initialSize.x,
      NURSE_STATION_MODEL_MAX_SIZE.y / initialSize.y,
      NURSE_STATION_MODEL_MAX_SIZE.z / initialSize.z,
    );
    model.scale.multiplyScalar(scale);
    model.updateMatrixWorld(true);

    const fittedBox = new THREE.Box3();
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || architecturalFillNames.has(object.name))
        return;
      fittedBox.expandByObject(object);
    });
    const center = fittedBox.getCenter(new THREE.Vector3());
    model.position.set(-center.x, -fittedBox.min.y + 0.03, -center.z);
  }

  private disposeObjectTree(object: THREE.Object3D) {
    object.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments || obj instanceof THREE.Points))
        return;
      obj.geometry.dispose();
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const material of materials) {
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture)
            value.dispose();
        }
        material.dispose();
      }
    });
  }

  /** 护士站阶段：半封闭外壳遮挡走廊方向，并防止缩放时看到场景外空白 */
  private buildStationBackdrop() {
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0xe8eef4,
      roughness: 0.88,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    const shell = new THREE.Group();
    shell.visible = false;

    const backPanel = new THREE.Mesh(new THREE.BoxGeometry(8.6, 3.5, 0.1), shellMat);
    backPanel.position.set(0, 1.58, STATION_SHELL_BACK_Z);
    backPanel.receiveShadow = true;
    shell.add(backPanel);

    const sideH = 3.2;
    const sideDepth = STATION_SHELL_BACK_Z + STATION_SHELL_HALF_D;
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.1, sideH, sideDepth), shellMat);
    leftWall.position.set(-STATION_SHELL_HALF_W, sideH / 2, STATION_SHELL_BACK_Z / 2 - 0.3);
    leftWall.receiveShadow = true;
    shell.add(leftWall);

    const rightWall = leftWall.clone();
    rightWall.position.x = STATION_SHELL_HALF_W;
    shell.add(rightWall);

    const extFloor = new THREE.Mesh(
      new THREE.BoxGeometry(STATION_SHELL_HALF_W * 2 + 0.2, 0.04, sideDepth + 0.4),
      new THREE.MeshStandardMaterial({ color: 0xdce3ea, roughness: 0.72 }),
    );
    extFloor.position.set(0, 0.02, STATION_SHELL_BACK_Z / 2 - 0.35);
    extFloor.receiveShadow = true;
    shell.add(extFloor);

    const ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(8.4, 0.06, sideDepth + 0.2),
      new THREE.MeshStandardMaterial({ color: 0xf0f3f6, roughness: 0.92 }),
    );
    ceiling.position.set(0, 2.78, STATION_SHELL_BACK_Z / 2 - 0.35);
    shell.add(ceiling);

    // 外壳天花板下沿灯槽（视觉连贯，实际照明在护士站 group 内）
    for (const lx of [-2.2, 0, 2.2]) {
      const slot = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.025, 0.42),
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: 0xfff8e1,
          emissiveIntensity: 0.35,
          roughness: 0.4,
        }),
      );
      slot.position.set(lx, 2.745, STATION_SHELL_BACK_Z / 2 - 0.55);
      shell.add(slot);
    }

    this.nurseGroup?.add(shell);
    this.stationShell = shell;
  }

  private worldFromNurseLocal(local: THREE.Vector3): THREE.Vector3 {
    const v = local.clone();
    if (this.nurseGroup)
      this.nurseGroup.localToWorld(v);
    else
      v.z += NURSE_STATION.z;
    return v;
  }

  /** 坐席视角：面向排班看板与 L 型柜台（智慧病房护士站真实动线） */
  private getNurseStationDeskCameraView() {
    return {
      position: this.worldFromNurseLocal(STATION_CAM_LOCAL.clone()),
      target: this.worldFromNurseLocal(STATION_TARGET_LOCAL.clone()),
    };
  }

  /** 护士站：限制 Orbit 不穿过天花板（动态 polar + 高度硬钳制） */
  private applyStationOrbitCeilingConstraint() {
    if (this.viewPhase !== 'station' || !this.nurseGroup)
      return;

    const targetLocal = this.nurseGroup.worldToLocal(this.controls.target.clone());
    const clampedX = THREE.MathUtils.clamp(
      targetLocal.x,
      -STATION_PAN_X_LIMIT,
      STATION_PAN_X_LIMIT,
    );
    const clampedY = THREE.MathUtils.clamp(
      targetLocal.y,
      STATION_PAN_Y_MIN,
      STATION_PAN_Y_MAX,
    );
    if (clampedX !== targetLocal.x || clampedY !== targetLocal.y || targetLocal.z !== STATION_TARGET_Z) {
      targetLocal.x = clampedX;
      targetLocal.y = clampedY;
      targetLocal.z = STATION_TARGET_Z;

      const clampedTarget = this.worldFromNurseLocal(targetLocal);
      const correction = clampedTarget.clone().sub(this.controls.target);
      this.controls.target.copy(clampedTarget);
      this.camera.position.add(correction);
    }

    const radius = Math.max(this.camera.position.distanceTo(this.controls.target), 0.01);
    const headroom = STATION_CEILING_Y - targetLocal.y - STATION_CEILING_CAM_MARGIN;

    if (headroom > 0.05) {
      const minPolar = Math.acos(Math.min(1, headroom / radius));
      this.controls.minPolarAngle = Math.max(Math.PI / 4, Math.min(minPolar, Math.PI / 2.06));
    }

    const ceilingWorldY = this.worldFromNurseLocal(new THREE.Vector3(0, STATION_CEILING_Y, 0)).y;
    const camMaxY = ceilingWorldY - STATION_CEILING_CAM_MARGIN;
    if (this.camera.position.y > camMaxY)
      this.camera.position.y = camMaxY;

    const floorWorldY = this.worldFromNurseLocal(new THREE.Vector3(0, 0, 0)).y;
    const camMinY = floorWorldY + STATION_FLOOR_CAM_MARGIN;
    if (this.camera.position.y < camMinY)
      this.camera.position.y = camMinY;

    const targetMaxY = ceilingWorldY - STATION_CEILING_TARGET_MARGIN;
    if (this.controls.target.y > targetMaxY)
      this.controls.target.y = targetMaxY;
  }

  private applyStationDeskCamera() {
    const { position, target } = this.getNurseStationDeskCameraView();
    this.cameraTransition = null;
    this.controls.enabled = true;
    this.controls.enableRotate = true;
    this.controls.enableZoom = true;
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = true;
    this.controls.zoomSpeed = 0.9;
    this.controls.rotateSpeed = 0.7;
    this.camera.fov = STATION_DESK_FOV;
    this.camera.position.copy(position);
    this.controls.target.copy(target);
    this.controls.minPolarAngle = STATION_MIN_POLAR_ANGLE;
    this.controls.maxPolarAngle = STATION_MAX_POLAR_ANGLE;
    this.controls.minAzimuthAngle = -STATION_AZIMUTH_LIMIT;
    this.controls.maxAzimuthAngle = STATION_AZIMUTH_LIMIT;
    this.controls.minDistance = STATION_MIN_DISTANCE;
    this.controls.maxDistance = STATION_MAX_DISTANCE;
    this.camera.lookAt(target);
    this.controls.update();
    this.applyStationOrbitCeilingConstraint();
    this.camera.updateProjectionMatrix();
    this.emitCameraDebugState();
  }

  private setCorridorContentVisible(visible: boolean) {
    this.updateCorridorImplementationVisibility();
    if (this.nurseGroup)
      this.nurseGroup.visible = !visible;
    if (this.stationShell)
      this.stationShell.visible = !visible && !this.hasLoadedNurseStationModel;
  }

  setViewPhase(phase: AreaViewPhase, animate = true) {
    this.viewPhase = phase;
    const count = Math.max(this.area?.rooms.length ?? 1, 1);
    const showCorridor = phase === 'corridor';
    this.scene.background = new THREE.Color(showCorridor ? SCENE_BG : NURSE_STATION_BG);
    this.setCorridorContentVisible(showCorridor);

    if (showCorridor) {
      // 立即解除护士站水平角钳制，避免过渡期间拖拽几乎无效
      this.controls.minAzimuthAngle = -Infinity;
      this.controls.maxAzimuthAngle = Infinity;
      const { position, target } = this.getNurseStationCameraView(count);
      this.camera.fov = this.getOverviewFov(count);
      this.camera.updateProjectionMatrix();
      if (animate) {
        this.startCameraTransition(position, target, 0.82, () => {
          this.applyCorridorOverviewCamera(count);
        });
      }
      else {
        this.applyCorridorOverviewCamera(count);
      }
    }
    else {
      this.camera.fov = STATION_DESK_FOV;
      this.camera.updateProjectionMatrix();
      if (animate) {
        const { position, target } = this.getNurseStationDeskCameraView();
        this.startCameraTransition(position, target, 0.75, () => {
          this.applyStationDeskCamera();
        });
      }
      else {
        this.applyStationDeskCamera();
      }
    }
  }

  expandToCorridorView() {
    this.setViewPhase('corridor', true);
  }

  private applyCorridorOverviewCamera(count: number) {
    const { position, target } = this.getNurseStationCameraView(count);
    this.cameraTransition = null;
    this.controls.enabled = true;
    this.controls.enableRotate = true;
    this.controls.enableZoom = true;
    this.controls.enablePan = true;
    this.controls.zoomSpeed = wardCorridorSceneConfig.controls.zoomSpeed;
    this.controls.rotateSpeed = wardCorridorSceneConfig.controls.rotateSpeed;
    this.camera.fov = this.getOverviewFov(count);
    this.camera.position.copy(position);
    this.controls.target.copy(target);
    const { corridorLen } = this.getRoomLayoutMetrics(count);
    const limits = resolveAreaCorridorControlLimits(corridorLen);
    this.controls.minPolarAngle = limits.minPolarAngle;
    this.controls.maxPolarAngle = limits.maxPolarAngle;
    this.controls.minAzimuthAngle = limits.minAzimuthAngle;
    this.controls.maxAzimuthAngle = limits.maxAzimuthAngle;
    this.controls.minDistance = limits.minDistance;
    this.controls.maxDistance = limits.maxDistance;
    this.camera.lookAt(target);
    this.controls.update();
    this.camera.updateProjectionMatrix();
    this.emitCameraDebugState();
  }

  private buildDoorBladeTexture(summary: RoomSummary, room: TwinWardEntity): THREE.CanvasTexture {
    const displayName = this.formatRoomDisplayName(room);
    return createCorridorBladeTexture(
      displayName.replace(/房$/, ''),
      summary.accentColor,
      summary.occupiedBeds,
      summary.totalBeds,
      summary.priority,
      summary.priority === 'calling',
    );
  }

  /** 门旁小牌点击：与侧栏「进入病房」一致，立即切换单房视图 */
  private triggerRoomEnter(roomIndex: number) {
    if (!this.roomMeshes.has(roomIndex))
      return;
    this.onRoomClick?.(roomIndex);
  }

  /** 走廊两侧病房：门洞落在走廊内壁，纵深向建筑内侧延伸 */
  private getRoomPosition(
    index: number,
    total: number,
  ): { x: number; z: number; rotY: number; corridorSide: -1 | 1 } {
    const row = Math.floor(index / 2);
    const side = (index % 2 === 0 ? -1 : 1) as -1 | 1;
    const z = this.getRoomRowZ(total, row);
    const doorPlane = CORRIDOR_HALF_W - CORRIDOR_WALL_THICK;
    const x = side * (doorPlane + AREA_FACADE_DEPTH / 2);
    if (total <= 1)
      return { x: -(doorPlane + AREA_FACADE_DEPTH / 2), z: 2, rotY: 0, corridorSide: -1 };
    return { x, z, rotY: 0, corridorSide: side };
  }

  private hexToThree(hex: string): number {
    return Number.parseInt(hex.replace('#', ''), 16);
  }

  private createPlaceholderDoorTexture(summary: RoomSummary, room: TwinWardEntity) {
    return createFallbackDoorTerminalTexture(room, summary);
  }

  private disposeDoorTerminalGroup(terminal?: THREE.Group, keepTexture?: THREE.CanvasTexture) {
    if (!terminal)
      return;
    terminal.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of mats) {
          if (mat instanceof THREE.MeshBasicMaterial && mat.map && mat.map !== keepTexture)
            mat.map.dispose();
          mat.dispose();
        }
      }
    });
  }

  private mountDoorTerminal(
    meshGroup: RoomMeshGroup,
    room: TwinWardEntity,
    summary: RoomSummary,
    isHorizontal: boolean,
  ) {
    if (meshGroup.doorTerminal) {
      meshGroup.group.remove(meshGroup.doorTerminal);
      this.disposeDoorTerminalGroup(meshGroup.doorTerminal, meshGroup.doorScreenTexture);
    }
    meshGroup.doorScreenTexture?.dispose();

    const isEmpty = summary.priority === 'empty';
    const built = this.buildDoorTerminal(
      isEmpty, summary, room, meshGroup.roomD, meshGroup.corridorSide, isHorizontal,
    );
    meshGroup.group.add(built.group);
    meshGroup.doorTerminal = built.group;
    meshGroup.doorScreen = built.screen;
    meshGroup.doorLed = built.led;
    meshGroup.doorGlow = undefined;
    meshGroup.doorScreenTexture = built.texture;
    meshGroup.doorIsHorizontal = isHorizontal;
    this.syncDoorDisplayMount(meshGroup);
  }

  /** 门口机横竖屏切换时，同步显示牌到门洞旁固定位置 */
  private syncDoorDisplayMount(meshGroup: RoomMeshGroup) {
    if (!meshGroup.doorDisplay)
      return;
    const towardCorridor = meshGroup.corridorSide < 0 ? 1 : -1;
    const corridorFaceX = this.getCorridorFaceX(meshGroup.roomD, meshGroup.corridorSide);
    const { centerY, mountZ } = computeWardDoorDisplayMount({
      doorW: DOOR_W,
      doorH: DOOR_H,
      isHorizontal: meshGroup.doorIsHorizontal ?? false,
    });
    meshGroup.doorDisplay.position.set(
      corridorFaceX + towardCorridor * 0.088,
      centerY,
      mountZ,
    );
  }

  private async refreshDoorScreen(roomIndex: number) {
    const meshGroup = this.roomMeshes.get(roomIndex);
    const room = this.area?.rooms[roomIndex];
    const summary = this.summaries[roomIndex];
    if (!meshGroup?.doorScreen || !room || !summary)
      return;

    const token = (this.doorRefreshToken.get(roomIndex) ?? 0) + 1;
    this.doorRefreshToken.set(roomIndex, token);

    let tex: THREE.CanvasTexture;
    if (room.templateId) {
      try {
        const loadingTexture = createDoorTemplateStatusTexture(room, 'loading');
        meshGroup.doorScreenTexture?.dispose();
        meshGroup.doorScreenTexture = loadingTexture;
        const loadingMat = meshGroup.doorScreen.material as THREE.MeshBasicMaterial;
        loadingMat.map = loadingTexture;
        loadingMat.needsUpdate = true;
        const parsed = await loadParsedTemplate(room.templateId);
        if (token !== this.doorRefreshToken.get(roomIndex))
          return;
        const layout = getDoorTerminalScreenLayout(room, parsed);
        if (layout.isHorizontal !== meshGroup.doorIsHorizontal) {
          this.mountDoorTerminal(meshGroup, room, summary, layout.isHorizontal);
          if (token !== this.doorRefreshToken.get(roomIndex))
            return;
        }
        tex = await renderDoorTerminalTexture(room, summary, parsed, {
          areaName: this.area?.areaName,
          deptName: this.area?.deptName,
        });
        if (token !== this.doorRefreshToken.get(roomIndex)) {
          tex.dispose();
          return;
        }
      }
      catch (error) {
        if (token !== this.doorRefreshToken.get(roomIndex))
          return;
        tex = createDoorTemplateStatusTexture(
          room,
          'error',
          error instanceof Error ? error.message : undefined,
        );
      }
    }
    else {
      const fallbackHorizontal = isDoorHorizontal(resolveDoorDirector(room));
      if (fallbackHorizontal !== meshGroup.doorIsHorizontal)
        this.mountDoorTerminal(meshGroup, room, summary, fallbackHorizontal);
      tex = createDoorTemplateStatusTexture(room, 'missing');
    }

    if (token !== this.doorRefreshToken.get(roomIndex)) {
      tex.dispose();
      return;
    }

    if (meshGroup.doorScreenTexture)
      meshGroup.doorScreenTexture.dispose();
    meshGroup.doorScreenTexture = tex;
    const screenMat = meshGroup.doorScreen.material as THREE.MeshBasicMaterial;
    screenMat.map = tex;
    screenMat.needsUpdate = true;
  }

  private syncDoorTemplates() {
    if (!this.area)
      return;
    this.area.rooms.forEach((_, index) => {
      void this.refreshDoorScreen(index);
    });
  }

  /**
   * 门口墙上挂装的门口机
   * 屏幕法线沿本地 +Z，与房门同向，随病房旋转后朝向护士站
   */
  private buildDoorTerminal(
    isEmpty: boolean,
    summary: RoomSummary,
    room: TwinWardEntity,
    depthX: number,
    corridorSide: -1 | 1,
    isHorizontal: boolean,
  ): {
    group: THREE.Group;
    screen: THREE.Mesh;
    led: THREE.Mesh;
    texture: THREE.CanvasTexture;
  } {
    const s = 1.45;
    const { width: screenW, height: screenH } = getDoorMeshScreenSize(isHorizontal, s);
    const texture = this.createPlaceholderDoorTexture(summary, room);
    const built = buildHospitalDoorTerminal({
      screenW,
      screenH,
      isHorizontal,
      isEmpty,
      isCalling: summary.priority === 'calling',
      texture,
    });

    this.placeDoorTerminal(built.group, depthX, corridorSide, isHorizontal);
    return { group: built.group, screen: built.screen, led: built.led, texture };
  }

  /** 病房门在本地坐标系的 X（门洞中心平面） */
  private getDoorLocalX(depthX: number, corridorSide: -1 | 1) {
    return corridorSide < 0 ? depthX / 2 : -depthX / 2;
  }

  /** 门洞朝向走廊一侧的外表面 X */
  private getCorridorFaceX(depthX: number, corridorSide: -1 | 1) {
    const doorX = this.getDoorLocalX(depthX, corridorSide);
    const outward = corridorSide < 0 ? -1 : 1;
    return doorX + outward * -(CORRIDOR_WALL_THICK / 2 + 0.05);
  }

  /** 门口机挂于走廊侧门洞旁，屏幕朝走廊 */
  private placeDoorTerminal(
    terminal: THREE.Group,
    depthX: number,
    corridorSide: -1 | 1,
    isHorizontal: boolean,
  ) {
    const corridorFaceX = this.getCorridorFaceX(depthX, corridorSide);
    const offsetY = isHorizontal ? 2.02 : 2.12;
    const sideZ = DOOR_W / 2 + (isHorizontal ? 0.42 : 0.48);
    const towardCorridor = corridorSide < 0 ? 1 : -1;
    terminal.rotation.y = corridorSide < 0 ? Math.PI / 2 : -Math.PI / 2;
    terminal.position.set(corridorFaceX + towardCorridor * 0.05, offsetY, sideZ);
  }

  /** 走廊侧薄立面：仅门洞+封闭后墙，不展示病房内部 */
  private buildCorridorWardFacade(
    group: THREE.Group,
    spanZ: number,
    corridorSide: -1 | 1,
    isEmpty: boolean,
    isCalling: boolean,
  ): { wallMat: THREE.MeshStandardMaterial; doorFrameLed: THREE.Mesh } {
    const depthX = AREA_FACADE_DEPTH;
    const wallTex = this.getWallPanelTexture().clone();
    wallTex.repeat.set(spanZ / 3, 1);
    const wallMat = new THREE.MeshStandardMaterial({
      map: wallTex,
      color: isEmpty ? 0xeceff1 : 0xf8fafc,
      roughness: 0.88,
      metalness: 0.02,
    });
    const kickMat = new THREE.MeshStandardMaterial({ color: 0x90a4ae, roughness: 0.85 });
    const h = CORRIDOR_CEILING_H;
    const kickH = 0.1;
    const halfZ = spanZ / 2;
    const doorX = this.getDoorLocalX(depthX, corridorSide);
    const backX = -doorX;

    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(WALL_THICK, h, spanZ),
      wallMat,
    );
    backWall.position.set(backX, h / 2, 0);
    backWall.castShadow = true;
    group.add(backWall);

    const backKick = new THREE.Mesh(new THREE.BoxGeometry(WALL_THICK + 0.02, kickH, spanZ), kickMat);
    backKick.position.set(backX, kickH / 2, 0);
    group.add(backKick);

    const sideSegZ = (spanZ - DOOR_W) / 2;
    if (sideSegZ > 0.2) {
      const sideL = new THREE.Mesh(new THREE.BoxGeometry(depthX, h, sideSegZ), wallMat);
      sideL.position.set(0, h / 2, -halfZ + sideSegZ / 2);
      group.add(sideL);
      const sideR = new THREE.Mesh(new THREE.BoxGeometry(depthX, h, sideSegZ), wallMat);
      sideR.position.set(0, h / 2, halfZ - sideSegZ / 2);
      group.add(sideR);

      const kickL = new THREE.Mesh(new THREE.BoxGeometry(depthX + 0.02, kickH, sideSegZ), kickMat);
      kickL.position.set(0, kickH / 2, -halfZ + sideSegZ / 2);
      group.add(kickL);
      const kickR = kickL.clone();
      kickR.position.set(0, kickH / 2, halfZ - sideSegZ / 2);
      group.add(kickR);
    }

    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(CORRIDOR_WALL_THICK, h - DOOR_H, DOOR_W + 0.2),
      wallMat,
    );
    lintel.position.set(doorX, DOOR_H + (h - DOOR_H) / 2, 0);
    group.add(lintel);

    const doorFrameLed = buildHospitalWardDoor(group, doorX, {
      doorW: DOOR_W,
      doorH: DOOR_H,
      wallThick: CORRIDOR_WALL_THICK,
      corridorSide,
      isEmpty,
      isCalling,
    });

    return { wallMat, doorFrameLed };
  }

  private disposeRoomGroup(meshGroup: RoomMeshGroup) {
    if (meshGroup.doorScreenTexture)
      meshGroup.doorScreenTexture.dispose();
    meshGroup.doorDisplayBladeTexture?.dispose();
    this.disposeDoorTerminalGroup(meshGroup.doorTerminal, meshGroup.doorScreenTexture);
    this.scene.remove(meshGroup.group);
    meshGroup.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of mats) {
          if (mat instanceof THREE.MeshBasicMaterial && mat.map)
            mat.map.dispose();
          mat.dispose();
        }
      }
    });
  }

  private createRoomBlock(room: TwinWardEntity, index: number, summary: RoomSummary): RoomMeshGroup {
    const total = this.area!.rooms.length;
    const facade = this.getAreaFacadeSize();
    const { x, z, rotY, corridorSide } = this.getRoomPosition(index, total);
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotY;
    group.userData.roomIndex = index;

    const accentHex = this.hexToThree(summary.accentColor);
    const isEmpty = summary.priority === 'empty';
    const isCalling = summary.priority === 'calling';
    const corridorFaceX = this.getCorridorFaceX(AREA_FACADE_DEPTH, corridorSide);
    const towardCorridor = corridorSide < 0 ? 1 : -1;

    const { wallMat, doorFrameLed } = this.buildCorridorWardFacade(
      group, facade.w, corridorSide, isEmpty, isCalling,
    );

    const hitBox = new THREE.Mesh(
      new THREE.BoxGeometry(AREA_FACADE_DEPTH + 0.3, CORRIDOR_CEILING_H, facade.w),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hitBox.position.y = CORRIDOR_CEILING_H / 2;
    group.add(hitBox);

    const initialHorizontal = isDoorHorizontal(resolveDoorDirector(room));
    const built = this.buildDoorTerminal(
      isEmpty, summary, room, AREA_FACADE_DEPTH, corridorSide, initialHorizontal,
    );
    group.add(built.group);

    const displayName = this.formatRoomDisplayName(room);
    const doorDisplayBuilt = buildWardDoorDisplayBoard(group, {
      corridorFaceX,
      towardCorridor,
      roomIndex: index,
      accentHex: summary.accentColor,
      priority: summary.priority,
      isCalling,
      roomNo: displayName.replace(/房$/, ''),
      occupiedBeds: summary.occupiedBeds,
      totalBeds: summary.totalBeds,
      doorW: DOOR_W,
      doorH: DOOR_H,
      isHorizontal: initialHorizontal,
    });

    const doorX = this.getDoorLocalX(AREA_FACADE_DEPTH, corridorSide);
    const doorLintel = buildDoorPriorityLintel(
      group,
      doorX,
      DOOR_W,
      DOOR_H,
      corridorSide,
      accentHex,
      isCalling,
    );

    this.scene.add(group);
    return {
      roomIndex: index,
      structureSignature: buildRoomStructureSignature(room),
      group,
      hitBox,
      wallMat,
      bedMattresses: [],
      roomW: facade.w,
      roomD: AREA_FACADE_DEPTH,
      corridorSide,
      doorTerminal: built.group,
      doorScreen: built.screen,
      doorScreenTexture: built.texture,
      doorLed: built.led,
      doorGlow: undefined,
      doorFrameLed,
      doorLintel,
      doorIsHorizontal: initialHorizontal,
      doorDisplay: doorDisplayBuilt.group,
      doorDisplayBlade: doorDisplayBuilt.blade,
      doorDisplayBladeTexture: doorDisplayBuilt.bladeTexture,
    };
  }

  /** 走廊纵向视角：站在护士站端，沿走廊看向病区 */
  private getOverviewFov(_count: number): number {
    return wardCorridorSceneConfig.appearance.fov;
  }

  /** 病区总览初始视角：护士站端走廊内抬高，沿走廊看向病房区 */
  private getNurseStationCameraView(count: number) {
    if (this.shouldShowWardCorridorModel() && this.wardCorridorModel) {
      const initial = wardCorridorSceneConfig.camera.initial;
      const target = new THREE.Vector3(initial.target.x, initial.target.y, initial.target.z);
      const azimuth = THREE.MathUtils.degToRad(initial.initialAngle.azimuthDeg);
      const elevation = THREE.MathUtils.degToRad(initial.initialAngle.elevationDeg);
      const horizontalDistance = initial.initialDistance * Math.cos(elevation);
      const position = target.clone().add(new THREE.Vector3(
        Math.sin(azimuth) * horizontalDistance,
        Math.sin(elevation) * initial.initialDistance,
        Math.cos(azimuth) * horizontalDistance,
      ));
      return {
        position,
        target,
      };
    }
    const layoutCount = Math.max(count, 1);
    const { rows, corridorStartZ, corridorEndZ, corridorLen } = this.getRoomLayoutMetrics(layoutCount);
    const centerZ = (corridorStartZ + corridorEndZ) / 2;
    const rowBoost = Math.min(OVERVIEW_ELEVATION_ROW_CAP, Math.max(0, rows - 1) * OVERVIEW_ELEVATION_PER_ROW);
    const camX = Math.min(OVERVIEW_CAM_X_MAX, NURSE_CAMERA_X_OFFSET + Math.max(0, rows - 1) * OVERVIEW_CAM_X_PER_ROW);
    const camZBack = Math.min(
      OVERVIEW_CAM_Z_BACK_MAX,
      OVERVIEW_CAM_Z_BACK_BASE + corridorLen * OVERVIEW_CAM_Z_LEN_FACTOR,
    );
    const camY = OVERVIEW_ELEVATION_BASE + rowBoost;
    const target = new THREE.Vector3(-1.15, NURSE_CAMERA_TARGET_Y, centerZ - corridorLen * 0.12);
    const camZ = corridorEndZ + camZBack;

    return {
      position: new THREE.Vector3(camX, camY, camZ),
      target,
    };
  }

  private getLayoutBounds(count: number): THREE.Box3 {
    const m = this.getRoomLayoutMetrics(count);
    const facade = this.getAreaFacadeSize();
    const halfX = CORRIDOR_HALF_W + facade.w + 2.5;
    return new THREE.Box3(
      new THREE.Vector3(-halfX, 0, m.corridorStartZ - 4),
      new THREE.Vector3(halfX, CORRIDOR_CEILING_H + 2, m.corridorEndZ + 2),
    );
  }

  /** 根据场景包围盒自动 framing，保证走廊与病房门入镜 */
  private collectSceneBounds(count: number): THREE.Box3 {
    const fallback = this.getLayoutBounds(count);
    const box = new THREE.Box3();
    let hasGeometry = false;

    const include = (obj: THREE.Object3D | null | undefined) => {
      if (!obj)
        return;
      const part = new THREE.Box3().setFromObject(obj);
      if (part.isEmpty())
        return;
      if (hasGeometry)
        box.union(part);
      else
        box.copy(part);
      hasGeometry = true;
    };

    if (this.shouldShowWardCorridorModel()) {
      include(this.wardCorridorModel);
    }
    else {
      include(this.envGroup);
      include(this.nurseGroup);
      for (const mesh of this.roomMeshes.values())
        include(mesh.group);
    }

    return hasGeometry ? box : fallback;
  }

  private fitCameraToScene(count: number) {
    if (this.viewPhase === 'station') {
      this.applyStationDeskCamera();
      return;
    }
    this.applyCorridorOverviewCamera(count);
  }

  /** 重置为护士站视角（corridor=走廊总览，station=工作台） */
  resetToNurseStationView() {
    const count = this.area?.rooms.length ?? 1;
    this.focusedRoomIndex = -1;
    this.updateFocusHighlight();
    if (this.viewPhase === 'station')
      this.applyStationDeskCamera();
    else
      this.applyCorridorOverviewCamera(count);
  }

  private fitCameraToRoomCount(count: number) {
    const { corridorLen } = this.getRoomLayoutMetrics(count);
    if (this.viewPhase !== 'station') {
      const limits = resolveAreaCorridorControlLimits(corridorLen);
      this.controls.maxDistance = limits.maxDistance;
      this.controls.minDistance = limits.minDistance;
    }
    this.rebuildFloor(count);
  }

  private getRoomDoorFocus(roomIndex: number): { position: THREE.Vector3; target: THREE.Vector3 } {
    const modelDoor = this.wardCorridorBindings.find(binding => binding.slot.roomIndex === roomIndex)?.door;
    if (this.shouldShowWardCorridorModel() && modelDoor) {
      const target = new THREE.Box3().setFromObject(modelDoor).getCenter(new THREE.Vector3());
      const position = new THREE.Vector3(0, Math.max(1.75, target.y + 0.25), target.z + 2.6);
      return { position, target };
    }
    const mesh = this.roomMeshes.get(roomIndex);
    if (!mesh) {
      const center = this.collectSceneBounds(this.area?.rooms.length ?? 1).getCenter(new THREE.Vector3());
      const position = center.clone().add(new THREE.Vector3(4, 5, 12));
      return { position, target: center };
    }

    const outward = mesh.corridorSide < 0 ? -1 : 1;
    const corridorFaceX = this.getCorridorFaceX(mesh.roomD, mesh.corridorSide);
    const doorLocal = new THREE.Vector3(
      corridorFaceX,
      1.85,
      DOOR_W / 2 + 0.55,
    );
    const doorWorld = mesh.group.localToWorld(doorLocal.clone());
    const forward = new THREE.Vector3(outward, 0, 0).applyQuaternion(mesh.group.quaternion).normalize();
    const camPos = doorWorld.clone().addScaledVector(forward, 5.5);
    camPos.y = Math.max(2.2, doorWorld.y + 0.5);
    return { position: camPos, target: doorWorld };
  }

  private startCameraTransition(
    toPos: THREE.Vector3,
    toTarget: THREE.Vector3,
    duration = 0.85,
    onComplete?: () => void,
  ) {
    this.cameraTransition = {
      elapsed: 0,
      duration,
      fromPos: this.camera.position.clone(),
      toPos: toPos.clone(),
      fromTarget: this.controls.target.clone(),
      toTarget: toTarget.clone(),
      onComplete,
    };
    this.controls.enabled = false;
  }

  private updateFocusHighlight() {
    for (const meshGroup of this.roomMeshes.values()) {
      const focused = meshGroup.roomIndex === this.focusedRoomIndex;
      if (meshGroup.doorDisplayBlade) {
        (meshGroup.doorDisplayBlade.material as THREE.MeshStandardMaterial).emissiveIntensity
          = focused ? 0.26 : 0.18;
      }
    }
  }

  /** 相机飞向病房门口机，可选完成后回调 */
  focusRoom(roomIndex: number, onComplete?: () => void) {
    const hasModelDoor = this.wardCorridorBindings.some(binding => binding.slot.roomIndex === roomIndex && binding.door);
    if (this.shouldShowWardCorridorModel() && !hasModelDoor)
      return;
    if (!this.roomMeshes.has(roomIndex) && !hasModelDoor)
      return;
    this.focusedRoomIndex = roomIndex;
    this.updateFocusHighlight();
    const { position, target } = this.getRoomDoorFocus(roomIndex);
    this.startCameraTransition(position, target, 0.85, onComplete);
  }

  updateArea(area: TwinAreaEntity) {
    this.area = area;
    const rooms = Array.isArray(area?.rooms) ? area.rooms : [];
    const layoutCount = Math.max(rooms.length, 1);
    const countChanged = rooms.length !== this.lastRoomCount;

    if (countChanged || !this.corridorGroup)
      this.fitCameraToRoomCount(layoutCount);

    try {
      this.summaries = summarizeArea(rooms);
    }
    catch (e) {
      console.error('[AreaScene] summarizeArea failed', e);
      this.summaries = rooms.map((room, index) => summarizeRoom(room, index));
    }

    const existing = new Set(this.roomMeshes.keys());
    const newIndices = new Set(rooms.map((_, i) => i));

    for (const index of existing) {
      if (!newIndices.has(index)) {
        this.disposeRoomGroup(this.roomMeshes.get(index)!);
        this.roomMeshes.delete(index);
      }
    }

    rooms.forEach((room, index) => {
      const summary = this.summaries[index] ?? summarizeRoom(room, index);
      try {
        if (!this.roomMeshes.has(index)) {
          this.roomMeshes.set(index, this.createRoomBlock(room, index, summary));
        }
        else {
          const facade = this.getAreaFacadeSize();
          const meshGroup = this.roomMeshes.get(index)!;
          const sizeChanged = meshGroup.roomW !== facade.w;
          const depthChanged = meshGroup.roomD !== AREA_FACADE_DEPTH;
          const structureChanged = meshGroup.structureSignature !== buildRoomStructureSignature(room);
          if (sizeChanged || depthChanged || structureChanged) {
            this.disposeRoomGroup(meshGroup);
            this.roomMeshes.set(index, this.createRoomBlock(room, index, summary));
          }
          else {
            const { x, z, rotY, corridorSide } = this.getRoomPosition(index, rooms.length);
            meshGroup.group.position.set(x, 0, z);
            meshGroup.group.rotation.y = rotY;
            meshGroup.corridorSide = corridorSide;
            this.updateRoomVisual(room, index, summary);
          }
        }
      }
      catch (e) {
        console.error(`[AreaScene] create room ${index} failed`, e);
      }
    });

    try {
      this.syncDoorTemplates();
      this.refreshCorridorDisplays();
      this.refreshNurseStationDisplay();
    }
    catch (e) {
      console.error('[AreaScene] corridor display refresh failed', e);
    }

    if (this.wardCorridorModelLoaded)
      this.bindWardCorridorSlots();
    this.updateCorridorImplementationVisibility();
    this.fitCameraToScene(layoutCount);
    this.setCorridorContentVisible(this.viewPhase === 'corridor');

    if (this.roomMeshes.size !== rooms.length)
      console.warn('[AreaScene] room mesh count mismatch', this.roomMeshes.size, rooms.length);

    this.lastRoomCount = rooms.length;
  }

  /** 床位/状态变更时轻量刷新，不重建走廊 */
  syncAreaData(area: TwinAreaEntity) {
    this.area = area;
    const rooms = Array.isArray(area?.rooms) ? area.rooms : [];
    try {
      this.summaries = summarizeArea(rooms);
    }
    catch {
      this.summaries = rooms.map((room, index) => summarizeRoom(room, index));
    }

    rooms.forEach((room, index) => {
      const summary = this.summaries[index] ?? summarizeRoom(room, index);
      if (this.roomMeshes.has(index))
        this.updateRoomVisual(room, index, summary);
    });

    try {
      this.refreshCorridorDisplays();
      this.refreshNurseStationDisplay();
      if (this.wardCorridorModelLoaded) {
        const signature = buildWardCorridorBindingSignature(rooms);
        if (signature !== this.wardCorridorBindingSignature)
          this.bindWardCorridorSlots();
        else
          void this.refreshWardCorridorScreens();
      }
    }
    catch (e) {
      console.error('[AreaScene] syncAreaData refresh failed', e);
    }
  }

  /** 数据加载后强制 framing（供布局刷新调用） */
  ensureOverviewCamera() {
    const count = Math.max(this.area?.rooms.length ?? 0, 1);
    this.fitCameraToScene(count);
  }

  private updateRoomVisual(room: TwinWardEntity, index: number, summary: RoomSummary) {
    const meshGroup = this.roomMeshes.get(index);
    if (!meshGroup)
      return;

    const accentHex = this.hexToThree(summary.accentColor);
    const isEmpty = summary.priority === 'empty';
    const isCalling = summary.priority === 'calling';

    meshGroup.wallMat.color.setHex(isEmpty ? 0xeceff1 : 0xf8fafc);

    if (meshGroup.doorDisplayBlade && meshGroup.doorDisplayBladeTexture) {
      meshGroup.doorDisplayBladeTexture.dispose();
      meshGroup.doorDisplayBladeTexture = this.buildDoorBladeTexture(summary, room);
      const bladeMat = meshGroup.doorDisplayBlade.material as THREE.MeshStandardMaterial;
      bladeMat.map = meshGroup.doorDisplayBladeTexture;
      bladeMat.emissiveMap = meshGroup.doorDisplayBladeTexture;
      bladeMat.emissiveIntensity = isCalling ? 0.32 : 0.18;
      bladeMat.needsUpdate = true;
      meshGroup.doorDisplayBladeTexture.needsUpdate = true;
    }

    if (meshGroup.doorLintel) {
      const lintelMat = meshGroup.doorLintel.material as THREE.MeshStandardMaterial;
      lintelMat.color.setHex(accentHex);
      lintelMat.emissive.setHex(accentHex);
      lintelMat.emissiveIntensity = isCalling ? 1.1 : summary.priority === 'infusing' ? 0.75 : 0.45;
    }

    if (meshGroup.doorFrameLed) {
      const ledMat = meshGroup.doorFrameLed.material as THREE.MeshStandardMaterial;
      const ledColor = isCalling ? 0xe91e63 : isEmpty ? 0x607d8b : 0x43a047;
      ledMat.color.setHex(ledColor);
      ledMat.emissive.setHex(isCalling ? 0xff1744 : isEmpty ? 0x455a64 : 0x76ff03);
      ledMat.emissiveIntensity = isCalling ? 1.1 : isEmpty ? 0.25 : 0.85;
    }

    void this.refreshDoorScreen(index);

    if (meshGroup.doorLed) {
      const ledMat = meshGroup.doorLed.material as THREE.MeshStandardMaterial;
      const isInfusing = summary.priority === 'infusing';
      const ledColor = isCalling ? 0xe91e63 : isInfusing ? 0xff9800 : isEmpty ? 0x546e7a : 0x43a047;
      ledMat.color.setHex(ledColor);
      ledMat.emissive.setHex(isCalling ? 0xff1744 : isInfusing ? 0xff6d00 : isEmpty ? 0x455a64 : 0x76ff03);
      ledMat.emissiveIntensity = isCalling ? 1.2 : isInfusing ? 1.0 : isEmpty ? 0.35 : 1.0;
    }

    room.beds.forEach((bed, bedIndex) => {
      const mattress = meshGroup.bedMattresses[bedIndex];
      if (!mattress)
        return;
      const status = resolveBedStatus(bed);
      const mat = mattress.material as THREE.MeshStandardMaterial;
      const isEmpty = status.state === 'empty';
      const alertGlow = bed.isCalling || status.state === 'infusing' || status.state === 'offline';
      mat.color.setHex(isEmpty ? 0xb0bec5 : 0xf5f7fa);
      mat.emissive.setHex(alertGlow ? this.hexToThree(status.emissive) : 0x000000);
      mat.emissiveIntensity = isEmpty ? 0.02 : bed.isCalling ? 0.55 : alertGlow ? 0.18 : 0;
    });
  }

  private handleClick = (event: MouseEvent) => {
    if (this.viewPhase === 'station')
      return;

    if (this.suppressRoomClick) {
      this.suppressRoomClick = false;
      return;
    }

    const rect = this.container.getBoundingClientRect();
    if (!rect.width || !rect.height)
      return;

    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const groups = this.shouldShowWardCorridorModel() && this.wardCorridorModel
      ? [this.wardCorridorModel]
      : [...this.roomMeshes.values()].map(m => m.group);
    const intersects = this.raycaster.intersectObjects(groups, true);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const worldPosition = hit.getWorldPosition(new THREE.Vector3());
      const materials = hit instanceof THREE.Mesh
        ? (Array.isArray(hit.material) ? hit.material : [hit.material])
        : [];
      const materialNames = materials.map(material => material.name || '(未命名材质)');
      this.onNodePick?.({
        name: hit.name || '(未命名节点)',
        type: hit.type,
        parentName: hit.parent?.name || '(无父节点)',
        worldPosition: {
          x: Number(worldPosition.x.toFixed(3)),
          y: Number(worldPosition.y.toFixed(3)),
          z: Number(worldPosition.z.toFixed(3)),
        },
        materialNames,
      });
      console.info('[AreaScene] 射线命中节点', {
        name: hit.name,
        type: hit.type,
        parent: hit.parent?.name,
        materialNames,
        worldPosition,
      });
      let obj: THREE.Object3D | null = intersects[0].object;
      while (obj && obj !== this.wardCorridorModel && obj.userData.role !== 'wardCorridorDoor')
        obj = obj.parent;
      if (obj?.userData.role === 'wardCorridorDoor' && typeof obj.userData.roomIndex === 'number') {
        const index = obj.userData.roomIndex as number;
        this.focusRoom(index, () => this.onRoomClick?.(index));
        return;
      }
      if (this.shouldShowWardCorridorModel())
        return;

      obj = intersects[0].object;
      while (obj && obj.userData.role !== 'doorDisplay' && obj.userData.roomIndex === undefined)
        obj = obj.parent;
      if (obj?.userData.role === 'doorDisplay' && obj.userData.roomIndex !== undefined) {
        this.triggerRoomEnter(obj.userData.roomIndex as number);
        return;
      }

      obj = intersects[0].object;
      while (obj && obj.userData.roomIndex === undefined)
        obj = obj.parent;
      if (obj?.userData.roomIndex !== undefined) {
        const index = obj.userData.roomIndex as number;
        this.focusRoom(index, () => this.onRoomClick?.(index));
      }
    }
  };

  private handleResize() {
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    if (width < 2 || height < 2)
      return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.labelRenderer.setSize(width, height);
    this.styleRendererLayers();
    this.styleLabelLayer();
  }

  refreshLayout() {
    this.handleResize();
    if (this.area?.rooms.length)
      this.ensureOverviewCamera();
  }

  private animate = (timestamp?: number) => {
    this.animationId = requestAnimationFrame(this.animate);
    if (this.pageHidden)
      return;

    this.timer.update(timestamp);
    const elapsed = this.timer.getElapsed();
    const delta = this.timer.getDelta();

    if (this.cameraTransition) {
      this.cameraTransition.elapsed += delta;
      const t = easeOutCubic(this.cameraTransition.elapsed / this.cameraTransition.duration);
      this.camera.position.lerpVectors(this.cameraTransition.fromPos, this.cameraTransition.toPos, t);
      this.controls.target.lerpVectors(this.cameraTransition.fromTarget, this.cameraTransition.toTarget, t);
      if (t >= 1) {
        const onComplete = this.cameraTransition.onComplete;
        this.cameraTransition = null;
        this.controls.enabled = true;
        onComplete?.();
      }
    }

    for (const meshGroup of this.roomMeshes.values()) {
      const summary = this.summaries[meshGroup.roomIndex];
      if (!summary)
        continue;

      if (meshGroup.doorDisplayBlade) {
        const bladeMat = meshGroup.doorDisplayBlade.material as THREE.MeshStandardMaterial;
        const glowPulse = summary.priority === 'calling'
          ? 0.32 + Math.sin(elapsed * 4 + meshGroup.roomIndex) * 0.1
          : 0.22;
        bladeMat.opacity = 1;
        bladeMat.emissiveIntensity = glowPulse;
        meshGroup.doorDisplayBlade.visible = true;
        if (meshGroup.doorDisplay)
          meshGroup.doorDisplay.visible = true;
      }

      if (meshGroup.doorFrameLed && summary.priority === 'calling') {
        const ledMat = meshGroup.doorFrameLed.material as THREE.MeshStandardMaterial;
        ledMat.emissiveIntensity = 0.55 + Math.sin(elapsed * 5) * 0.25;
      }

      if (meshGroup.doorLintel) {
        const lintelMat = meshGroup.doorLintel.material as THREE.MeshStandardMaterial;
        if (summary.priority === 'calling') {
          lintelMat.emissiveIntensity = 0.6 + Math.sin(elapsed * 5 + meshGroup.roomIndex) * 0.3;
        }
        else if (summary.priority === 'infusing') {
          lintelMat.emissiveIntensity = 0.48 + Math.sin(elapsed * 2.5 + meshGroup.roomIndex) * 0.12;
        }
      }

      if (meshGroup.doorLed) {
        const doorLedMat = meshGroup.doorLed.material as THREE.MeshStandardMaterial;
        if (summary.priority === 'calling') {
          doorLedMat.emissiveIntensity = 0.85 + Math.sin(elapsed * 5) * 0.2;
        }
        else if (summary.infusingCount > 0) {
          doorLedMat.emissiveIntensity = 0.75 + Math.sin(elapsed * 3) * 0.1;
        }
      }

      meshGroup.bedMattresses.forEach((mattress, i) => {
        const bed = this.area?.rooms[meshGroup.roomIndex]?.beds[i];
        if (!bed?.isCalling)
          return;
        const mat = mattress.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 0.35 + Math.sin(elapsed * 5) * 0.2;
      });
    }

    if (this.corridorDisplays.length) {
      const nowMs = performance.now();
      if (nowMs - this.corridorTimeRefreshAt >= 1000) {
        this.corridorTimeRefreshAt = nowMs;
        this.refreshCorridorDisplays();
      }
    }

    if (this.nurseStationBoardDisplays.length) {
      const nowMs = performance.now();
      if (nowMs - this.nurseStationBoardRefreshAt >= 1000) {
        this.nurseStationBoardRefreshAt = nowMs;
        this.refreshNurseStationBoardDisplays();
      }
    }

    this.controls.update();
    if (this.viewPhase === 'station')
      this.applyStationOrbitCeilingConstraint();
    this.updateCss2dLabelVisibility();
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  };

  /** CSS2D 标签在相机后方时会投影到屏幕中央，需隐藏 */
  private updateCss2dLabelVisibility() {
    this.camera.getWorldDirection(this.css2dLookDir);
    this.scene.traverse((obj) => {
      if (!(obj instanceof CSS2DObject))
        return;
      obj.getWorldPosition(this.css2dToLabel);
      this.css2dToLabel.sub(this.camera.position);
      obj.visible = this.css2dLookDir.dot(this.css2dToLabel) > 0;
    });
  }

  dispose() {
    this.nurseStationModelLoadToken++;
    this.wardCorridorModelLoadToken++;
    this.hasLoadedNurseStationModel = false;
    cancelAnimationFrame(this.animationId);
    this.timer.dispose();
    this.resizeObserver?.disconnect();
    this.controls.removeEventListener('start', this.onControlsStart);
    this.controls.removeEventListener('change', this.onControlsChange);
    this.container.removeEventListener('click', this.handleClick);
    this.container.removeEventListener('wheel', this.cancelCameraTransition);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labelRenderer.domElement.remove();
    if (this.envGroup)
      this.scene.remove(this.envGroup);
    this.disposeNurseStationBoardDisplays();
    if (this.nurseStationModel)
      this.disposeObjectTree(this.nurseStationModel);
    this.disposeWardCorridorOverlays();
    this.disposeWardCorridorTextures();
    if (this.wardCorridorModel)
      this.disposeObjectTree(this.wardCorridorModel);
    if (this.nurseGroup)
      this.scene.remove(this.nurseGroup);
  }
}
