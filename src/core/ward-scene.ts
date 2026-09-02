import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { easeOutCubic } from '@/core/camera-easing';
import { getCameraPreset, resolveWardCameraViewportScale } from '@/core/camera-presets';
import { resolveWardSceneControlLimits } from '@/core/ward-scene-controls';
import { wardInteriorSceneConfig } from '@/config/ward-interior-scene';
import { getEnvSceneTint } from '@/core/env-alert';
import type { EnvAlertLevel } from '@/core/env-alert';
import { resolveBedStatus } from '@/core/bed-status';
import {
  createBedTemplateStatusTexture,
  createFallbackBedTerminalTexture,
  renderBedTerminalTexture,
} from '@/core/template/bed-terminal-texture';
import {
  addBedsideCabinet,
  addHandSanitizer,
  addHospitalWallBand,
  addIvStand,
  addOxygenOutlet,
  createHospitalFloorTexture,
  createHospitalWallTexture,
} from '@/core/hospital-scene-details';
import { loadParsedTemplate } from '@/core/template/template-cache';
import { displayPatientName } from '@/utils/mask-patient';
import { getWardRoomSize } from '@/types/twin';
import { resolveWardBedPose } from '@/core/ward-room-layout';
import {
  resolveWardRoomDataCards,
  resolveWardSupportLayout,
} from '@/core/ward-room-support-layout';
import { BED_DEPTH, BED_HEAD_Z, BED_WIDTH, resolveBedVisualScale } from '@/core/ward-bed-geometry';
import {
  WARD_INTERIOR_MODEL_URL,
  bindWardInteriorBakedBed,
  cloneWardInteriorBed,
  configureWardInteriorCanvasTexture,
  disposeWardInteriorModel,
  fitWardInteriorEnvironment,
  getWardInteriorAssetParts,
  hideWardInteriorCeiling,
  prepareWardInteriorModelMaterials,
  resolveWardInteriorModelBedPose,
  syncWardInteriorBakedBedVisibility,
} from '@/core/ward-interior-model';
import type { WardInteriorAssetParts } from '@/core/ward-interior-model';
import type { BedStatusMeta, CameraPresetId, TwinBedEntity, TwinWardEntity } from '@/types/twin';

type CurtainMode = 'full' | 'lite' | 'minimal';

export type WardInteriorModelState = 'loading' | 'ready' | 'fallback';

export interface WardSceneOptions {
  container: HTMLElement;
  onBedClick?: (bed: TwinBedEntity) => void;
  onModelState?: (state: WardInteriorModelState) => void;
}

interface BedMeshGroup {
  bedCode: string;
  group: THREE.Group;
  indicator: THREE.Mesh;
  mattress: THREE.Mesh;
  bedTerminalScreen?: THREE.Mesh;
  bedTerminalTexture?: THREE.CanvasTexture;
  infusionPump?: THREE.Mesh;
  callRing?: THREE.Mesh;
  label?: CSS2DObject;
  selectionRing?: THREE.Mesh;
  selectionBeam?: THREE.Mesh;
  selectionPillar?: THREE.Mesh;
  deviceTag?: CSS2DObject;
  bedsideMonitor?: THREE.Mesh;
  bedsideMonitorTexture?: THREE.CanvasTexture;
  curtainPanels?: THREE.Mesh[];
  curtainPhase?: number;
}

const SCENE_BG = wardInteriorSceneConfig.appearance.background;
const ROOM_H = wardInteriorSceneConfig.room.height;
const HEADBOARD_Z = BED_HEAD_Z;

interface CameraTransition {
  elapsed: number;
  duration: number;
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
}

export class WardScene {
  private renderer: THREE.WebGLRenderer;
  private labelRenderer: CSS2DRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private animationId = 0;
  private isActive = true;
  private bedMeshes = new Map<string, BedMeshGroup>();
  private ward: TwinWardEntity | null = null;
  private bedTerminalRefreshToken = new Map<string, number>();
  private clock = new THREE.Clock();
  private onBedClick?: (bed: TwinBedEntity) => void;
  private onModelState?: (state: WardInteriorModelState) => void;
  private resizeObserver: ResizeObserver | null = null;
  private container: HTMLElement;
  private alertLevel: EnvAlertLevel = 'normal';
  private cameraTransition: CameraTransition | null = null;
  private activePresetId: CameraPresetId | null = null;
  private suppressBedClick = false;
  private accentStrips: THREE.Mesh[] = [];
  private ceilingPanels: THREE.Mesh[] = [];
  private roomGroup = new THREE.Group();
  private wardInteriorModel: THREE.Group | null = null;
  private wardInteriorParts: WardInteriorAssetParts | null = null;
  private wardInteriorModelLoadToken = 0;
  private cameraViewLogStep = 0;
  private cameraViewLogTimer = 0;
  private environmentTexture: THREE.Texture | null = null;
  private quiltTexture: THREE.CanvasTexture | null = null;
  private pillowcaseTexture: THREE.CanvasTexture | null = null;
  private roomW = 14;
  private roomD = 12;
  private bedCount = 1;
  private lastBedCount = 0;
  private selectedBedCode: string | null = null;
  private pageHidden = document.hidden;

  constructor(options: WardSceneOptions) {
    const { container, onBedClick, onModelState } = options;
    this.container = container;
    this.onBedClick = onBedClick;
    this.onModelState = onModelState;

    const width = container.clientWidth;
    const height = container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SCENE_BG);
    if (wardInteriorSceneConfig.appearance.baseFogDensity > 0)
      this.scene.fog = new THREE.FogExp2(SCENE_BG, wardInteriorSceneConfig.appearance.baseFogDensity);

    const perspective = wardInteriorSceneConfig.camera.perspective;
    this.camera = new THREE.PerspectiveCamera(perspective.fov, width / height, perspective.near, perspective.far);
    this.camera.position.set(...wardInteriorSceneConfig.camera.initial.position);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = wardInteriorSceneConfig.appearance.exposure;
    this.renderer.sortObjects = true;
    this.styleRendererLayers();

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environmentTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.environmentTexture;
    this.scene.environmentIntensity = wardInteriorSceneConfig.appearance.environmentIntensity;
    pmrem.dispose();

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(width, height);
    this.styleLabelLayer();
    container.appendChild(this.renderer.domElement);
    container.appendChild(this.labelRenderer.domElement);

    this.controls = new OrbitControls(this.camera, this.container);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = wardInteriorSceneConfig.controls.dampingFactor;
    this.controls.enableRotate = true;
    this.controls.enableZoom = true;
    this.controls.enablePan = true;
    this.controls.zoomSpeed = wardInteriorSceneConfig.controls.zoomSpeed;
    this.controls.rotateSpeed = wardInteriorSceneConfig.controls.rotateSpeed;
    this.applyOpenWardControls();
    this.controls.target.set(...wardInteriorSceneConfig.camera.initial.target);
    this.controls.addEventListener('start', this.onControlsStart);
    this.controls.addEventListener('change', this.onControlsChange);
    this.controls.addEventListener('end', this.onControlsEnd);

    this.scene.add(this.roomGroup);
    this.roomGroup.visible = false;
    this.setupLights();
    void this.loadWardInteriorModel();

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
    root.style.overflow = 'hidden';
  }

  private cancelCameraTransition = () => {
    this.cameraTransition = null;
  };

  private onControlsStart = () => {
    this.cancelCameraTransition();
    this.suppressBedClick = false;
  };

  private onControlsChange = () => {
    this.suppressBedClick = true;
    // window.clearTimeout(this.cameraViewLogTimer);
    // this.cameraViewLogTimer = window.setTimeout(() => this.logCameraView('拖动中'), 160);
  };

  private onControlsEnd = () => {
    // window.clearTimeout(this.cameraViewLogTimer);
    // this.logCameraView('操作结束');
  };

  private logCameraView(reason: string) {
    // const offset = this.camera.position.clone().sub(this.controls.target);
    // const spherical = new THREE.Spherical().setFromVector3(offset);
    // this.cameraViewLogStep += 1;
    // console.info(`[WardScene] 视角 #${this.cameraViewLogStep} ${reason}`, {
    //   position: this.camera.position.toArray().map(value => Number(value.toFixed(3))),
    //   target: this.controls.target.toArray().map(value => Number(value.toFixed(3))),
    //   distance: Number(spherical.radius.toFixed(3)),
    //   azimuthDeg: Number(THREE.MathUtils.radToDeg(spherical.theta).toFixed(2)),
    //   polarDeg: Number(THREE.MathUtils.radToDeg(spherical.phi).toFixed(2)),
    // });
    void reason;
  }

  private handleVisibilityChange = () => {
    this.pageHidden = document.hidden;
    if (!this.pageHidden)
      this.clock.getDelta();
  };

  private applyBedLabelElement(el: HTMLElement, bed: TwinBedEntity) {
    const status = resolveBedStatus(bed);
    const isEmpty = !bed.isOccupied;
    const selected = this.selectedBedCode === bed.bedCode;
    let stateMod = 'bed-label-3d--occupied';
    if (bed.isCalling)
      stateMod = 'bed-label-3d--calling';
    else if (status.state === 'infusing')
      stateMod = 'bed-label-3d--infusing';
    else if (status.state === 'offline' || status.state === 'lowBattery')
      stateMod = 'bed-label-3d--device-alert';
    else if (isEmpty)
      stateMod = 'bed-label-3d--empty';

    const compact = this.bedCount >= 4 ? ' bed-label-3d--compact' : '';
    const selectedClass = selected ? ' bed-label-3d--selected' : '';
    el.className = `bed-label-3d ${stateMod}${compact}${selectedClass}`;
    el.style.pointerEvents = 'none';
    const nursingColor = bed.nursingColor ?? bed.sickInfo?.nursingColor;
    const name = displayPatientName(bed.sickInfo?.sickName, bed.isOccupied);
    const nurse = bed.sickInfo?.dutyNurseName;
    const level = bed.nursingLevel
      ? `<span class="bed-label-3d__level">${bed.nursingLevel}</span>`
      : '';
    const badge = !isEmpty && status.state !== 'occupied' && status.state !== 'empty'
      ? `<span class="bed-label-3d__badge">${status.label}</span>`
      : '';
    const statusLabel = isEmpty ? '待入住' : status.label;
    const selectedExtra = selected
      ? `<div class="bed-label-3d__selected-extra">
          <span>${nurse ? `责任护士 ${nurse}` : '床旁设备联动'}</span>
          <span>${bed.deviceCode ? `设备 ${bed.deviceCode}` : '床头屏在线'}</span>
        </div>`
      : '';
    if (nursingColor)
      el.style.setProperty('--nursing-accent', nursingColor);
    else
      el.style.removeProperty('--nursing-accent');
    el.innerHTML = `
      <div class="bed-label-3d__accent" aria-hidden="true"></div>
      <div class="bed-label-3d__head">
        <span class="bed-label-3d__dot"></span>
        <span class="bed-label-3d__num">${bed.bedName}</span>
        <span class="bed-label-3d__status">${statusLabel}</span>
      </div>
      <div class="bed-label-3d__name">${name}</div>
      <div class="bed-label-3d__meta">
        ${level}
        ${badge}
      </div>
      ${selectedExtra}
    `;
  }

  private createFloorTexture() {
    return createHospitalFloorTexture(this.roomW / 2, this.roomD / 2);
  }

  private createWallPanelTexture() {
    return createHospitalWallTexture();
  }

  /** 医院被褥：白色底 + 柔和折痕，不再用状态色铺满 */
  private getQuiltTexture() {
    if (this.quiltTexture)
      return this.quiltTexture;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f6f8fb';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 32) {
      const fold = ctx.createLinearGradient(0, y, 0, y + 32);
      fold.addColorStop(0, 'rgba(220, 228, 238, 0.35)');
      fold.addColorStop(0.5, 'rgba(255, 255, 255, 0.15)');
      fold.addColorStop(1, 'rgba(200, 210, 222, 0.25)');
      ctx.fillStyle = fold;
      ctx.fillRect(0, y, 256, 32);
    }
    ctx.strokeStyle = 'rgba(176, 190, 204, 0.18)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= 256; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 256);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2.2, 1.6);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.quiltTexture = tex;
    return tex;
  }

  /** 枕套：白色针织感 + 缝线边 */
  private getPillowcaseTexture() {
    if (this.pillowcaseTexture)
      return this.pillowcaseTexture;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fafbfc';
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 128; i += 4) {
      ctx.fillStyle = i % 8 === 0 ? 'rgba(230, 236, 242, 0.5)' : 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(0, i, 128, 2);
    }
    ctx.strokeStyle = 'rgba(176, 190, 204, 0.45)';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, 116, 116);
    ctx.strokeStyle = 'rgba(200, 210, 220, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(12, 12, 104, 104);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1.2, 1.2);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.pillowcaseTexture = tex;
    return tex;
  }

  /** 床垫/被褥发光：仅输液、呼叫等异常态高亮，日常在院不染色 */
  private getMattressEmissive(status: BedStatusMeta, isEmpty: boolean): { color: string; intensity: number } {
    if (isEmpty)
      return { color: '#616161', intensity: 0.02 };
    if (status.state === 'infusing')
      return { color: status.emissive, intensity: 0.18 };
    if (status.state === 'calling' || status.state === 'offline' || status.state === 'lowBattery')
      return { color: status.emissive, intensity: 0.1 };
    return { color: '#000000', intensity: 0 };
  }

  /** 医用隔帘织物纹理：竖向褶皱 + 顶部加固带 + 底部坠感 */
  private createCurtainFabricTexture() {
    const w = 128;
    const h = 256;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    const base = ctx.createLinearGradient(0, 0, w, 0);
    base.addColorStop(0, '#a8c8dc');
    base.addColorStop(0.5, '#c5deee');
    base.addColorStop(1, '#a8c8dc');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);

    for (let x = 0; x < w; x++) {
      const fold = Math.sin((x / w) * Math.PI * 14) * 0.5 + 0.5;
      const stripe = ctx.createLinearGradient(x, 0, x + 6, 0);
      stripe.addColorStop(0, `rgba(120, 164, 196, ${0.12 + fold * 0.18})`);
      stripe.addColorStop(0.5, `rgba(220, 238, 248, ${0.05 + fold * 0.08})`);
      stripe.addColorStop(1, `rgba(90, 140, 175, ${0.1 + fold * 0.15})`);
      ctx.fillStyle = stripe;
      ctx.fillRect(x, 0, 1, h);
    }

    ctx.fillStyle = 'rgba(74, 122, 158, 0.22)';
    ctx.fillRect(0, 0, w, h * 0.06);

    const hem = ctx.createLinearGradient(0, h * 0.88, 0, h);
    hem.addColorStop(0, 'transparent');
    hem.addColorStop(0.5, 'rgba(58, 110, 148, 0.14)');
    hem.addColorStop(1, 'rgba(42, 92, 128, 0.28)');
    ctx.fillStyle = hem;
    ctx.fillRect(0, h * 0.88, w, h * 0.12);

    for (let i = 0; i < 400; i++) {
      const px = Math.random() * w;
      const py = Math.random() * h;
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`;
      ctx.fillRect(px, py, 1, 1);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1.8, 1);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /** 垂坠感隔帘几何：底部前坠 + 竖向褶皱起伏 */
  private createDrapedCurtainGeometry(
    width: number,
    height: number,
    widthSegs: number,
    heightSegs: number,
    options: { foldAmp?: number; hemSag?: number; gather?: number } = {},
  ) {
    const foldAmp = options.foldAmp ?? 0.018;
    const hemSag = options.hemSag ?? 0.05;
    const gather = options.gather ?? 0;
    const geo = new THREE.PlaneGeometry(width, height, widthSegs, heightSegs);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const xNorm = (x + width / 2) / width;
      const yNorm = 1 - (y + height / 2) / height;
      const fold = Math.sin(xNorm * Math.PI * 10 + gather) * foldAmp * (0.35 + yNorm * 0.65);
      const bulge = Math.sin(xNorm * Math.PI) * 0.012 * yNorm;
      const hem = (1 - yNorm) ** 2 * hemSag;
      pos.setZ(i, fold + bulge + hem);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }

  private getCurtainMode(): CurtainMode {
    if (this.bedCount <= 2)
      return 'lite';
    return 'minimal';
  }

  private addCurtainTrack(
    group: THREE.Group,
    from: THREE.Vector3,
    to: THREE.Vector3,
    railMat: THREE.Material,
  ) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    if (len < 0.01)
      return;
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, len, 10), railMat);
    rail.position.copy(from).add(to).multiplyScalar(0.5);
    rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    group.add(rail);
  }

  private addCurtainRings(
    group: THREE.Group,
    points: THREE.Vector3[],
    ringMat: THREE.Material,
  ) {
    for (const p of points) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.005, 8, 14), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(p.x, p.y - 0.06, p.z);
      group.add(ring);
      const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.05, 6), ringMat);
      hook.position.set(p.x, p.y - 0.03, p.z);
      group.add(hook);
    }
  }

  /**
   * 病房隔帘：轨道 + 吊环 + 垂坠布帘
   * - 单/双人间：U 型围合（头侧 + 两侧，足侧留通道）
   * - 三人间：L 型（头侧 + 一侧）
   * - 四人间及以上：头侧短帘
   */
  private addBedCurtain(group: THREE.Group, mode: CurtainMode): THREE.Mesh[] {
    const panels: THREE.Mesh[] = [];
    const halfW = BED_WIDTH / 2;
    const headZ = HEADBOARD_Z - 0.24;
    const sideCenterZ = headZ + BED_DEPTH / 2 + 0.06;
    const footGap = mode === 'full' ? 0.22 : 0.15;
    const railY = mode === 'minimal' ? 2.12 : 2.38;
    const fabricH = mode === 'minimal' ? 1.35 : mode === 'lite' ? 1.72 : 1.92;
    const fabricTopY = railY - 0.1;
    const fabricCenterY = fabricTopY - fabricH / 2;
    const sideLen = mode === 'minimal' ? BED_DEPTH * 0.45 : BED_DEPTH - footGap;
    const opacity = mode === 'minimal' ? 0.78 : 0.88;

    const railMat = new THREE.MeshStandardMaterial({
      color: 0xb0bec5,
      metalness: 0.82,
      roughness: 0.22,
    });
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x90a4ae,
      metalness: 0.9,
      roughness: 0.18,
    });
    const curtainTex = this.createCurtainFabricTexture();
    const makeCurtainMat = (alpha = opacity) => new THREE.MeshStandardMaterial({
      map: curtainTex,
      color: 0xd8ecf8,
      transparent: true,
      opacity: alpha,
      side: THREE.DoubleSide,
      roughness: 0.98,
      metalness: 0,
      depthWrite: false,
    });

    const backRailFrom = new THREE.Vector3(-halfW, railY, headZ);
    const backRailTo = new THREE.Vector3(halfW, railY, headZ);
    this.addCurtainTrack(group, backRailFrom, backRailTo, railMat);

    if (mode !== 'minimal') {
      const leftRailFrom = new THREE.Vector3(-halfW, railY, sideCenterZ - sideLen / 2);
      const leftRailTo = new THREE.Vector3(-halfW, railY, sideCenterZ + sideLen / 2);
      this.addCurtainTrack(group, leftRailFrom, leftRailTo, railMat);

      if (mode === 'full') {
        const rightRailFrom = new THREE.Vector3(halfW, railY, sideCenterZ - sideLen * 0.38);
        const rightRailTo = new THREE.Vector3(halfW, railY, sideCenterZ + sideLen * 0.38);
        this.addCurtainTrack(group, rightRailFrom, rightRailTo, railMat);
        [-halfW, halfW].forEach((x) => {
          const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.034, 10, 10), railMat);
          elbow.position.set(x, railY, headZ);
          group.add(elbow);
        });
      }
    }

    const ringSpacing = mode === 'full' ? 0.42 : 0.55;
    const ringPoints: THREE.Vector3[] = [];
    for (let x = -halfW + 0.2; x <= halfW - 0.15; x += ringSpacing)
      ringPoints.push(new THREE.Vector3(x, railY, headZ - 0.01));

    if (mode !== 'minimal') {
      for (let z = sideCenterZ - sideLen / 2 + 0.12; z <= sideCenterZ + sideLen / 2 - 0.12; z += ringSpacing)
        ringPoints.push(new THREE.Vector3(-halfW - 0.01, railY, z));
      if (mode === 'full') {
        for (let z = sideCenterZ - sideLen * 0.36; z <= sideCenterZ + sideLen * 0.36; z += ringSpacing * 1.1)
          ringPoints.push(new THREE.Vector3(halfW + 0.01, railY, z));
      }
    }
    this.addCurtainRings(group, ringPoints, ringMat);

    const backPanel = new THREE.Mesh(
      this.createDrapedCurtainGeometry(BED_WIDTH, fabricH, 14, 10, { gather: 0.2 }),
      makeCurtainMat(),
    );
    backPanel.position.set(0, fabricCenterY, headZ - 0.045);
    group.add(backPanel);
    panels.push(backPanel);

    const valance = new THREE.Mesh(
      new THREE.BoxGeometry(BED_WIDTH, 0.09, 0.025),
      makeCurtainMat(0.95),
    );
    valance.position.set(0, fabricTopY + 0.02, headZ - 0.03);
    group.add(valance);

    if (mode === 'full') {
      const leftPanel = new THREE.Mesh(
        this.createDrapedCurtainGeometry(sideLen, fabricH, 12, 10, { gather: 1.4 }),
        makeCurtainMat(0.9),
      );
      leftPanel.rotation.y = Math.PI / 2;
      leftPanel.position.set(-halfW - 0.04, fabricCenterY, sideCenterZ);
      group.add(leftPanel);
      panels.push(leftPanel);

      const rightPanel = new THREE.Mesh(
        this.createDrapedCurtainGeometry(sideLen * 0.75, fabricH, 10, 10, { gather: 2.6, foldAmp: 0.022 }),
        makeCurtainMat(0.82),
      );
      rightPanel.rotation.y = -Math.PI / 3.2;
      rightPanel.position.set(halfW + 0.16, fabricCenterY, sideCenterZ - BED_DEPTH * 0.08);
      group.add(rightPanel);
      panels.push(rightPanel);
    }
    else if (mode === 'lite') {
      const leftPanel = new THREE.Mesh(
        this.createDrapedCurtainGeometry(sideLen, fabricH, 10, 9, { gather: 0.8 }),
        makeCurtainMat(0.88),
      );
      leftPanel.rotation.y = Math.PI / 2;
      leftPanel.position.set(-halfW - 0.04, fabricCenterY, sideCenterZ);
      group.add(leftPanel);
      panels.push(leftPanel);
    }
    else {
      const wingL = new THREE.Mesh(
        this.createDrapedCurtainGeometry(BED_DEPTH * 0.55, fabricH * 0.92, 6, 8),
        makeCurtainMat(0.75),
      );
      wingL.rotation.y = Math.PI / 2;
      wingL.position.set(-halfW - 0.03, fabricCenterY, sideCenterZ);
      group.add(wingL);
      panels.push(wingL);

      const wingR = new THREE.Mesh(
        this.createDrapedCurtainGeometry(BED_DEPTH * 0.5, fabricH * 0.88, 6, 8, { gather: 1.8 }),
        makeCurtainMat(0.7),
      );
      wingR.rotation.y = -Math.PI / 2.8;
      wingR.position.set(halfW + 0.1, fabricCenterY, sideCenterZ - BED_DEPTH * 0.06);
      group.add(wingR);
      panels.push(wingR);
    }

    return panels;
  }

  /** 按每床 templateId（来自 queryBedDeviceInfo）刷新床头屏纹理 */
  async syncWardBedTemplates(ward: TwinWardEntity) {
    await Promise.all(ward.beds.map(bed => this.refreshBedTerminal(bed)));
  }

  private async refreshBedTerminal(bed: TwinBedEntity) {
    const meshGroup = this.bedMeshes.get(bed.bedCode);
    if (!meshGroup?.bedTerminalScreen)
      return;

    const token = (this.bedTerminalRefreshToken.get(bed.bedCode) ?? 0) + 1;
    this.bedTerminalRefreshToken.set(bed.bedCode, token);
    const status = resolveBedStatus(bed);

    let tex: THREE.CanvasTexture;
    if (bed.templateId) {
      try {
        const loadingTexture = createBedTemplateStatusTexture(bed, 'loading');
        if (meshGroup.group.userData.wardInteriorModelBed)
          configureWardInteriorCanvasTexture(loadingTexture);
        meshGroup.bedTerminalTexture?.dispose();
        meshGroup.bedTerminalTexture = loadingTexture;
        const loadingMat = meshGroup.bedTerminalScreen.material as THREE.MeshBasicMaterial;
        loadingMat.map = loadingTexture;
        loadingMat.needsUpdate = true;
        const parsed = await loadParsedTemplate(bed.templateId);
        if (token !== this.bedTerminalRefreshToken.get(bed.bedCode))
          return;
        tex = await renderBedTerminalTexture(bed, parsed, status);
      }
      catch (error) {
        if (token !== this.bedTerminalRefreshToken.get(bed.bedCode))
          return;
        tex = createBedTemplateStatusTexture(
          bed,
          'error',
          error instanceof Error ? error.message : undefined,
        );
      }
    }
    else {
      tex = createBedTemplateStatusTexture(bed, 'missing');
    }

    if (token !== this.bedTerminalRefreshToken.get(bed.bedCode)) {
      tex.dispose();
      return;
    }

    if (meshGroup.group.userData.wardInteriorModelBed)
      configureWardInteriorCanvasTexture(tex);

    if (meshGroup.bedTerminalTexture)
      meshGroup.bedTerminalTexture.dispose();
    meshGroup.bedTerminalTexture = tex;
    const screenMat = meshGroup.bedTerminalScreen.material as THREE.MeshBasicMaterial;
    screenMat.map = tex;
    screenMat.needsUpdate = true;
    tex.needsUpdate = true;
  }

  private createBedTerminalTexture(bed: TwinBedEntity, status: BedStatusMeta) {
    return createFallbackBedTerminalTexture(bed, status);
  }

  /** 床头背景板 + 床头机显示屏 */
  private addHeadboardAssembly(
    group: THREE.Group,
    bed: TwinBedEntity,
    status: BedStatusMeta,
    isEmpty: boolean,
  ) {
    const panelW = BED_WIDTH + 0.34;
    const panelHalfW = panelW / 2;
    const panelZ = HEADBOARD_Z - 0.1;
    const panelFrontZ = HEADBOARD_Z + 0.02;
    const backPanel = new THREE.Mesh(
      new THREE.BoxGeometry(panelW, 1.38, 0.07),
      new THREE.MeshStandardMaterial({
        color: 0xf5f9fc,
        roughness: 0.72,
        metalness: 0.08,
      }),
    );
    backPanel.position.set(0, 1.14, panelZ);
    backPanel.castShadow = true;
    group.add(backPanel);

    const sideTrimMat = new THREE.MeshStandardMaterial({ color: 0xb0bec5, metalness: 0.35, roughness: 0.45 });
    [-panelHalfW + 0.02, panelHalfW - 0.02].forEach((x) => {
      const trim = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.38, 0.09), sideTrimMat);
      trim.position.set(x, 1.14, panelZ);
      group.add(trim);
    });

    const topStrip = new THREE.Mesh(
      new THREE.BoxGeometry(panelW - 0.04, 0.05, 0.04),
      new THREE.MeshStandardMaterial({
        color: 0x2fc7e8,
        emissive: 0x20bfe6,
        emissiveIntensity: isEmpty ? 0.12 : 0.62,
      }),
    );
    topStrip.position.set(0, 1.76, panelZ + 0.04);
    group.add(topStrip);

    const lowerStrip = new THREE.Mesh(
      new THREE.BoxGeometry(panelW - 0.24, 0.028, 0.035),
      new THREE.MeshBasicMaterial({
        color: 0x78e8ff,
        transparent: true,
        opacity: isEmpty ? 0.18 : 0.42,
        depthWrite: false,
      }),
    );
    lowerStrip.position.set(0, 1.05, panelFrontZ);
    group.add(lowerStrip);

    const tex = this.createBedTerminalTexture(bed, status);
    const housingMat = new THREE.MeshStandardMaterial({ color: 0x37474f, metalness: 0.5, roughness: 0.38 });

    const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.46, 0.05), housingMat);
    bezel.position.set(0, 1.4, panelFrontZ - 0.02);
    group.add(bezel);

    const screen = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.38, 0.02),
      new THREE.MeshBasicMaterial({ map: tex }),
    );
    screen.position.set(0, 1.4, panelFrontZ + 0.02);
    group.add(screen);

    const screenGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.66, 0.46),
      new THREE.MeshBasicMaterial({
        color: 0x4fc3f7,
        transparent: true,
        opacity: isEmpty ? 0.035 : 0.08,
        depthWrite: false,
      }),
    );
    screenGlow.position.set(0, 1.4, panelFrontZ + 0.035);
    group.add(screenGlow);

    const sensorRail = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.035, 0.025),
      new THREE.MeshStandardMaterial({
        color: 0xdfe8ee,
        emissive: isEmpty ? 0x000000 : 0x1e88e5,
        emissiveIntensity: isEmpty ? 0 : 0.18,
        roughness: 0.55,
      }),
    );
    sensorRail.position.set(-0.72, 1.52, panelFrontZ);
    sensorRail.position.x = -panelHalfW + 0.32;
    group.add(sensorRail);

    for (let i = 0; i < 3; i++) {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.024, 10, 8),
        new THREE.MeshStandardMaterial({
          color: i === 0 ? 0x76ff03 : 0x4fc3f7,
          emissive: i === 0 ? 0x76ff03 : 0x4fc3f7,
          emissiveIntensity: isEmpty ? 0.18 : 0.75,
        }),
      );
      dot.position.set(-panelHalfW + 0.12 + i * 0.14, 1.52, panelFrontZ + 0.025);
      group.add(dot);
    }

    const statusLed = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.03, 0.02),
      new THREE.MeshStandardMaterial({
        color: status.color,
        emissive: new THREE.Color(status.emissive),
        emissiveIntensity: isEmpty ? 0.2 : 0.9,
      }),
    );
    statusLed.position.set(0.28, 1.58, panelFrontZ);
    group.add(statusLed);

    return { screen, texture: tex };
  }

  private createMonitorTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 200;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#061018';
    ctx.fillRect(0, 0, 320, 200);
    ctx.strokeStyle = 'rgba(79, 195, 247, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, 304, 184);
    ctx.fillStyle = '#4fc3f7';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('SMART WARD', 20, 36);
    ctx.fillStyle = '#8fa3b8';
    ctx.font = '12px sans-serif';
    ctx.fillText('环境监测 · 床位联动', 20, 58);
    ctx.strokeStyle = 'rgba(79, 195, 247, 0.25)';
    for (let y = 80; y < 180; y += 14) {
      ctx.beginPath();
      ctx.moveTo(20, y);
      ctx.lineTo(300, y);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(79, 195, 247, 0.15)';
    ctx.fillRect(20, 90, 120, 8);
    ctx.fillStyle = '#76ff03';
    ctx.beginPath();
    ctx.arc(280, 30, 5, 0, Math.PI * 2);
    ctx.fill();
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private createWardInfoCardTexture(title: string, value: string, sub: string, accent = '#6ee8ff') {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f7fbff';
    ctx.fillRect(0, 0, 320, 180);
    ctx.fillStyle = '#0f3350';
    ctx.fillRect(0, 0, 320, 42);
    ctx.strokeStyle = 'rgba(28, 116, 166, 0.28)';
    ctx.lineWidth = 2;
    ctx.strokeRect(5, 5, 310, 170);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, 8, 180);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, 22, 22);

    ctx.fillStyle = '#17324a';
    ctx.font = 'bold 54px "Microsoft YaHei", sans-serif';
    ctx.fillText(value, 24, 98);

    ctx.fillStyle = '#4d6779';
    ctx.font = '20px "Microsoft YaHei", sans-serif';
    ctx.fillText(sub, 24, 140);

    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.16;
    ctx.beginPath();
    ctx.arc(270, 108, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(270, 108, 32, -Math.PI / 2, Math.PI * 1.1);
    ctx.stroke();
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  private createSceneLabelTexture(title: string, sub = '', accent = '#4fc3f7') {
    const canvas = document.createElement('canvas');
    canvas.width = 360;
    canvas.height = 150;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f8fbfd';
    ctx.fillRect(0, 0, 360, 150);
    ctx.strokeStyle = 'rgba(80, 125, 150, 0.28)';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, 348, 138);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, 360, 16);
    ctx.fillStyle = '#17324a';
    ctx.font = 'bold 34px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, 180, sub ? 70 : 82);
    if (sub) {
      ctx.fillStyle = '#607d8b';
      ctx.font = '21px "Microsoft YaHei", sans-serif';
      ctx.fillText(sub, 180, 108);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  private getBedPose(index: number, total = this.bedCount) {
    return resolveWardBedPose(index, total, this.roomW, this.roomD);
  }

  private shouldShowBedOverlay(bed: TwinBedEntity) {
    const status = resolveBedStatus(bed);
    return this.selectedBedCode === bed.bedCode
      || bed.isCalling
      || status.state === 'infusing'
      || status.state === 'offline'
      || status.state === 'lowBattery';
  }

  private createBedsideMonitorTexture(bed: TwinBedEntity, status: BedStatusMeta) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 160;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#07121f';
    ctx.fillRect(0, 0, 256, 160);

    ctx.fillStyle = '#0e2236';
    ctx.fillRect(0, 0, 256, 28);
    ctx.fillStyle = status.color;
    ctx.fillRect(0, 0, 5, 160);

    ctx.fillStyle = '#dff9ff';
    ctx.font = 'bold 17px "Microsoft YaHei", sans-serif';
    ctx.fillText(`${bed.bedName}  ${status.label}`, 14, 19);

    const name = displayPatientName(bed.sickInfo?.sickName, bed.isOccupied);
    ctx.fillStyle = '#90caf9';
    ctx.font = '12px "Microsoft YaHei", sans-serif';
    ctx.fillText(name, 14, 48);

    const vitals = [
      ['HR', bed.latestVitals?.pulse || '--', '#76ff03'],
      ['SpO2', bed.latestVitals?.bloodSugar || '--', '#4fc3f7'],
      ['BP', bed.latestVitals?.bloodPressure || '--', '#ffb74d'],
    ];
    vitals.forEach(([label, value, color], i) => {
      const x = 14 + i * 78;
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(x, 60, 68, 34);
      ctx.fillStyle = color;
      ctx.font = 'bold 15px "Consolas", "Microsoft YaHei", monospace';
      ctx.fillText(value, x + 7, 82);
      ctx.fillStyle = '#78909c';
      ctx.font = '9px "Microsoft YaHei", sans-serif';
      ctx.fillText(label, x + 7, 92);
    });

    ctx.strokeStyle = 'rgba(118,255,3,0.72)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 100; i++) {
      const x = 14 + i * 2.2;
      const y = 122 + Math.sin(i * 0.34) * 8 + (i % 16 === 0 ? -18 : 0);
      if (i === 0)
        ctx.moveTo(x, y);
      else
        ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.fillStyle = 'rgba(79,195,247,0.25)';
    ctx.fillRect(14, 144, 212, 3);
    ctx.fillStyle = status.color;
    ctx.fillRect(14, 144, 124, 3);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  private createDeviceTagElement(bed: TwinBedEntity) {
    const el = document.createElement('div');
    el.style.pointerEvents = 'none';
    this.applyDeviceTagElement(el, bed);
    return el;
  }

  private applyDeviceTagElement(el: HTMLElement, bed: TwinBedEntity) {
    const status = resolveBedStatus(bed);
    const alerting = bed.isCalling || status.state === 'offline' || status.state === 'lowBattery' || status.state === 'infusing';
    el.className = `bed-device-tag ${alerting ? 'bed-device-tag--alert' : 'bed-device-tag--normal'} bed-device-tag--${status.state}`;
    const title = bed.isCalling
      ? '呼叫中'
      : status.state === 'offline'
        ? '设备离线'
        : status.state === 'lowBattery'
          ? '低电量'
          : status.state === 'infusing'
            ? '输液监测'
            : '设备正常';
    el.innerHTML = `
      <span class="bed-device-tag__dot"></span>
      <strong>${title}</strong>
      <small>${bed.deviceCode || '床旁终端'}</small>
    `;
  }

  private addBedsideMonitor(
    group: THREE.Group,
    bed: TwinBedEntity,
    status: BedStatusMeta,
    isEmpty: boolean,
  ): THREE.Mesh | undefined {
    if (isEmpty)
      return undefined;

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x263238, metalness: 0.45, roughness: 0.38 });
    const standMat = new THREE.MeshStandardMaterial({ color: 0x607d8b, metalness: 0.6, roughness: 0.32 });

    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.62, 10), standMat);
    stand.position.set(BED_WIDTH / 2 + 0.22, 0.96, -0.34);
    group.add(stand);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, 0.025), standMat);
    arm.position.set(BED_WIDTH / 2 + 0.13, 1.24, -0.34);
    group.add(arm);

    const monitor = new THREE.Group();
    monitor.position.set(BED_WIDTH / 2 + 0.02, 1.28, -0.34);
    monitor.rotation.y = -0.22;

    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.045), frameMat);
    monitor.add(housing);

    const texture = this.createBedsideMonitorTexture(bed, status);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.36, 0.22),
      new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }),
    );
    screen.position.z = 0.026;
    monitor.add(screen);

    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 10, 8),
      new THREE.MeshStandardMaterial({
        color: status.color,
        emissive: new THREE.Color(status.emissive),
        emissiveIntensity: 0.9,
      }),
    );
    led.position.set(0.17, -0.11, 0.03);
    monitor.add(led);

    group.add(monitor);
    screen.userData.monitorTexture = texture;
    return screen;
  }

  private addHeadwallUtilities(group: THREE.Group, status: BedStatusMeta, isEmpty: boolean) {
    const railMat = new THREE.MeshStandardMaterial({
      color: 0xdfe8ee,
      roughness: 0.58,
      metalness: 0.12,
      transparent: isEmpty,
      opacity: isEmpty ? 0.55 : 1,
    });
    const rail = new THREE.Mesh(new THREE.BoxGeometry(BED_WIDTH + 0.22, 0.08, 0.04), railMat);
    rail.position.set(0, 1.04, HEADBOARD_Z + 0.03);
    group.add(rail);

    const outletMat = new THREE.MeshStandardMaterial({
      color: 0xf8fbfd,
      roughness: 0.44,
      metalness: 0.08,
      transparent: isEmpty,
      opacity: isEmpty ? 0.6 : 1,
    });
    const gasColors = [0x43a047, 0x1e88e5, 0xffb300];
    gasColors.forEach((color, i) => {
      const outlet = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.022, 16), outletMat);
      outlet.rotation.x = Math.PI / 2;
      outlet.position.set(-BED_WIDTH / 2 + 0.18 + i * 0.15, 1.04, HEADBOARD_Z + 0.06);
      group.add(outlet);
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.014, 8, 8),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: isEmpty ? 0.15 : 0.55,
        }),
      );
      dot.position.set(-BED_WIDTH / 2 + 0.18 + i * 0.15, 1.04, HEADBOARD_Z + 0.078);
      group.add(dot);
    });

    const nurseCall = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.11, 0.025),
      new THREE.MeshStandardMaterial({
        color: status.color,
        emissive: new THREE.Color(status.emissive),
        emissiveIntensity: isEmpty ? 0.18 : 0.55,
        roughness: 0.42,
      }),
    );
    nurseCall.position.set(BED_WIDTH / 2 - 0.14, 1.04, HEADBOARD_Z + 0.06);
    group.add(nurseCall);
  }

  private addOverbedTable(group: THREE.Group, isEmpty: boolean) {
    const topMat = new THREE.MeshStandardMaterial({
      color: 0xf2eee3,
      roughness: 0.72,
      metalness: 0.04,
      transparent: isEmpty,
      opacity: isEmpty ? 0.45 : 1,
    });
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0xb0bec5,
      metalness: 0.72,
      roughness: 0.28,
      transparent: isEmpty,
      opacity: isEmpty ? 0.45 : 1,
    });

    const table = new THREE.Group();
    table.position.set(0.25, 0, 0.54);

    const top = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.045, 0.34), topMat);
    top.position.set(0, 0.86, 0);
    top.castShadow = true;
    table.add(top);

    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.025, 0.025), metalMat);
    rail.position.set(0, 0.78, -0.14);
    table.add(rail);

    for (const x of [-0.34, 0.34]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.78, 8), metalMat);
      post.position.set(x, 0.43, -0.13);
      table.add(post);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.025, 0.05), metalMat);
      foot.position.set(x, 0.06, -0.13);
      table.add(foot);
    }

    group.add(table);
  }

  private addWardComfortDetails(rw: number, rd: number) {
    const support = resolveWardSupportLayout(this.bedCount, rw, rd);
    const sofaMat = new THREE.MeshStandardMaterial({ color: 0x9fb5bd, roughness: 0.76, metalness: 0.03 });
    const cushionMat = new THREE.MeshStandardMaterial({ color: 0xd8e7ef, roughness: 0.82 });
    const sofa = new THREE.Group();
    sofa.position.set(support.familyChair.x, 0, support.familyChair.z);
    sofa.rotation.y = support.familyChair.rotationY ?? 0;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.16, 0.58), cushionMat);
    seat.position.y = 0.42;
    seat.castShadow = true;
    sofa.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.68, 0.1), sofaMat);
    back.position.set(0, 0.78, 0.29);
    back.castShadow = true;
    sofa.add(back);
    for (const x of [-0.48, 0.48]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.42, 0.58), sofaMat);
      arm.position.set(x, 0.58, 0);
      arm.castShadow = true;
      sofa.add(arm);
    }
    const chairLabel = new THREE.Mesh(
      new THREE.PlaneGeometry(0.78, 0.28),
      new THREE.MeshBasicMaterial({
        map: this.createSceneLabelTexture('陪护区', '短时休息', '#7cb342'),
        transparent: true,
        toneMapped: false,
      }),
    );
    chairLabel.position.set(0, 1.2, -0.32);
    sofa.add(chairLabel);
    this.roomGroup.add(sofa);

    const cartMat = new THREE.MeshStandardMaterial({ color: 0xf4f8fb, roughness: 0.58, metalness: 0.08 });
    const trayMat = new THREE.MeshStandardMaterial({ color: 0x8bdde8, roughness: 0.42, metalness: 0.18 });
    const cart = new THREE.Group();
    cart.position.set(support.nursingCart.x, 0, support.nursingCart.z);
    cart.rotation.y = support.nursingCart.rotationY ?? 0;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.74, 0.42), cartMat);
    body.position.y = 0.48;
    body.castShadow = true;
    cart.add(body);
    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.04, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x90a4ae, metalness: 0.65, roughness: 0.34 }),
    );
    handle.position.set(0, 0.88, -0.24);
    cart.add(handle);
    for (const y of [0.32, 0.58]) {
      const tray = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.035, 0.45), trayMat);
      tray.position.y = y;
      cart.add(tray);
    }
    const bottleMat = new THREE.MeshStandardMaterial({
      color: 0xc8f3ff,
      transparent: true,
      opacity: 0.72,
      roughness: 0.2,
      metalness: 0.02,
    });
    for (const x of [-0.18, 0, 0.18]) {
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.22, 14), bottleMat);
      bottle.position.set(x, 0.73, -0.06);
      cart.add(bottle);
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.032, 0.032, 0.035, 12),
        new THREE.MeshStandardMaterial({ color: 0x42a5f5, roughness: 0.42 }),
      );
      cap.position.set(x, 0.86, -0.06);
      cart.add(cap);
    }
    for (const x of [-0.24, 0.24]) {
      for (const z of [-0.16, 0.16]) {
        const wheel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.045, 0.045, 0.028, 10),
          new THREE.MeshStandardMaterial({ color: 0x455a64, metalness: 0.55, roughness: 0.38 }),
        );
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(x, 0.08, z);
        cart.add(wheel);
      }
    }
    const cartLabel = new THREE.Mesh(
      new THREE.PlaneGeometry(0.82, 0.34),
      new THREE.MeshBasicMaterial({
        map: this.createSceneLabelTexture('护理车', '巡房 / 治疗', '#26a69a'),
        transparent: true,
        toneMapped: false,
      }),
    );
    cartLabel.position.set(0, 1.12, 0.26);
    cart.add(cartLabel);
    this.roomGroup.add(cart);

    const storage = new THREE.Group();
    storage.position.set(support.cleanStorage.x, 0, support.cleanStorage.z);
    const storageMat = new THREE.MeshStandardMaterial({ color: 0xf5f9fb, roughness: 0.62, metalness: 0.05 });
    const storageBody = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.42, 0.42), storageMat);
    storageBody.position.y = 0.76;
    storageBody.castShadow = true;
    storage.add(storageBody);
    for (const y of [0.52, 0.86, 1.2]) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.025, 0.44), trayMat);
      shelf.position.y = y;
      storage.add(shelf);
    }
    const storageLabel = new THREE.Mesh(
      new THREE.PlaneGeometry(0.72, 0.3),
      new THREE.MeshBasicMaterial({
        map: this.createSceneLabelTexture('物品柜', '清洁耗材', '#5c9ded'),
        transparent: true,
        toneMapped: false,
      }),
    );
    storageLabel.position.set(0, 1.34, 0.23);
    storage.add(storageLabel);
    this.roomGroup.add(storage);

    const waste = new THREE.Group();
    waste.position.set(support.wasteStation.x, 0, support.wasteStation.z);
    const wasteColors = [0x43a047, 0xffb300];
    const wasteLabels = ['生活', '医疗'];
    for (let i = 0; i < 2; i++) {
      const bin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.18, 0.48, 18),
        new THREE.MeshStandardMaterial({ color: wasteColors[i], roughness: 0.7, metalness: 0.02 }),
      );
      bin.position.set((i - 0.5) * 0.42, 0.28, 0);
      bin.castShadow = true;
      waste.add(bin);
      const lid = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.045, 0.32),
        new THREE.MeshStandardMaterial({ color: 0xf8fbfd, roughness: 0.52, metalness: 0.04 }),
      );
      lid.position.set((i - 0.5) * 0.42, 0.55, 0);
      waste.add(lid);
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(0.26, 0.12),
        new THREE.MeshBasicMaterial({
          map: this.createSceneLabelTexture(wasteLabels[i], '', '#455a64'),
          transparent: true,
          toneMapped: false,
        }),
      );
      label.position.set((i - 0.5) * 0.42, 0.31, 0.185);
      label.scale.set(0.55, 0.55, 0.55);
      waste.add(label);
    }
    const wasteStationLabel = new THREE.Mesh(
      new THREE.PlaneGeometry(0.86, 0.28),
      new THREE.MeshBasicMaterial({
        map: this.createSceneLabelTexture('分类处置', '垃圾桶', '#78909c'),
        transparent: true,
        toneMapped: false,
      }),
    );
    wasteStationLabel.position.set(0, 0.92, 0.16);
    waste.add(wasteStationLabel);
    this.roomGroup.add(waste);
  }

  private createSelectionMeshes(status: BedStatusMeta) {
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(status.color),
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.17, 72), ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.05, 0);
    ring.scale.set(0.62, 1.24, 1);

    const pulse = new THREE.Mesh(
      new THREE.RingGeometry(1.22, 1.28, 72),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(status.color),
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    pulse.rotation.x = -Math.PI / 2;
    pulse.position.set(0, 0.055, 0);
    pulse.scale.set(0.62, 1.24, 1);

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.68, 2.4, 32, 1, true),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(status.color),
        transparent: true,
        opacity: 0.08,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    beam.position.set(0, 1.28, 0);
    ring.visible = false;
    pulse.visible = false;
    beam.visible = false;

    return { ring, pulse, beam };
  }

  private addSmartWardFloorGuides(rw: number, rd: number) {
    const centerGuide = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.max(2.2, rw * 0.22), rd - 2.4),
      new THREE.MeshBasicMaterial({
        color: 0x45dfff,
        transparent: true,
        opacity: 0.03,
        depthWrite: false,
      }),
    );
    centerGuide.rotation.x = -Math.PI / 2;
    centerGuide.position.set(0, 0.018, 0.18);
    this.roomGroup.add(centerGuide);

    const lineMat = new THREE.MeshBasicMaterial({
      color: 0x70ecff,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    });
    for (const x of [-rw * 0.18, rw * 0.18]) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.025, rd - 2.8), lineMat.clone());
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, 0.022, 0.12);
      this.roomGroup.add(line);
    }

    const beds = this.ward?.beds ?? [];
    for (const [index, bed] of beds.entries()) {
      const status = resolveBedStatus(bed);
      const pose = this.getBedPose(index, beds.length);
      const zone = new THREE.Mesh(
        new THREE.PlaneGeometry(BED_WIDTH * 1.65, BED_DEPTH * 1.2),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(status.color),
          transparent: true,
          opacity: status.state === 'empty' ? 0.025 : 0.04,
          depthWrite: false,
        }),
      );
      zone.rotation.x = -Math.PI / 2;
      zone.position.set(pose.x, 0.025, pose.z + 0.05);
      this.roomGroup.add(zone);

      const zoneLine = new THREE.Mesh(
        new THREE.RingGeometry(1.08, 1.1, 48),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(status.color),
          transparent: true,
          opacity: status.state === 'empty' ? 0.07 : 0.12,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      zoneLine.rotation.x = -Math.PI / 2;
      zoneLine.position.set(pose.x, 0.028, pose.z);
      zoneLine.scale.set(0.72, 1.35, 1);
      this.roomGroup.add(zoneLine);
    }
  }

  private addWardWallDataCards(rd: number) {
    const env = this.ward?.doorEnvData;
    const occupied = this.ward?.beds.filter(bed => bed.isOccupied).length ?? 0;
    const total = this.ward?.beds.length ?? this.bedCount;
    const cards = resolveWardRoomDataCards({
      occupied,
      total,
      calling: this.ward?.beds.filter(bed => bed.isCalling).length ?? 0,
      temp: env?.temp,
      humidity: env?.relativeHumid,
    });

    for (const cardInfo of cards) {
      const texture = this.createWardInfoCardTexture(cardInfo.title, cardInfo.value, cardInfo.sub, cardInfo.accent);
      const card = new THREE.Mesh(
        new THREE.PlaneGeometry(cardInfo.w, cardInfo.h),
        new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          opacity: 0.92,
          toneMapped: false,
          depthWrite: false,
        }),
      );
      card.position.set(cardInfo.x, cardInfo.y, -rd / 2 + 0.135);
      this.roomGroup.add(card);

      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(cardInfo.w * 1.05, cardInfo.h * 1.1),
        new THREE.MeshBasicMaterial({
          color: 0x4fc3f7,
          transparent: true,
          opacity: 0.045,
          depthWrite: false,
        }),
      );
      glow.position.set(cardInfo.x, cardInfo.y, -rd / 2 + 0.13);
      this.roomGroup.add(glow);
    }

    const boardTitleTex = this.createSceneLabelTexture(this.ward?.sickroomName ?? '病房', '房间状态看板', '#2f9fd6');
    const boardTitle = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.48),
      new THREE.MeshBasicMaterial({ map: boardTitleTex, transparent: true, toneMapped: false }),
    );
    boardTitle.position.set(-3.1, 2.5, -rd / 2 + 0.14);
    this.roomGroup.add(boardTitle);
  }

  private addWindowTreatment(winX: number, winY: number, winZ: number, winW: number, winH: number) {
    const railMat = new THREE.MeshStandardMaterial({ color: 0xb0bec5, metalness: 0.6, roughness: 0.35 });
    const fabricMat = new THREE.MeshStandardMaterial({
      color: 0xd7edf7,
      transparent: true,
      opacity: 0.82,
      roughness: 0.96,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const rail = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.7, 0.035, 0.05), railMat);
    rail.position.set(winX, winY + winH / 2 + 0.22, winZ + 0.05);
    this.roomGroup.add(rail);

    for (const side of [-1, 1]) {
      const curtain = new THREE.Mesh(
        this.createDrapedCurtainGeometry(0.52, winH + 0.75, 8, 10, { foldAmp: 0.026, gather: side > 0 ? 1.2 : 0.4 }),
        fabricMat.clone(),
      );
      curtain.position.set(winX + side * (winW / 2 + 0.34), winY - 0.04, winZ + 0.09);
      this.roomGroup.add(curtain);
    }

    const sill = new THREE.Mesh(
      new THREE.BoxGeometry(winW + 0.34, 0.08, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xf4f8fb, roughness: 0.52, metalness: 0.06 }),
    );
    sill.position.set(winX, winY - winH / 2 - 0.14, winZ + 0.1);
    this.roomGroup.add(sill);

    const planter = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.16, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.72 }),
    );
    planter.position.set(winX + winW * 0.25, winY - winH / 2 + 0.02, winZ + 0.2);
    this.roomGroup.add(planter);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x43a047, roughness: 0.8 });
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), leafMat);
      leaf.position.set(
        planter.position.x - 0.26 + i * 0.085,
        planter.position.y + 0.16 + (i % 2) * 0.05,
        planter.position.z,
      );
      leaf.scale.set(0.55, 1.35, 0.22);
      leaf.rotation.z = -0.5 + i * 0.16;
      this.roomGroup.add(leaf);
    }
  }

  private addBedSafetyDetails(group: THREE.Group, status: BedStatusMeta, isEmpty: boolean) {
    const railMat = new THREE.MeshStandardMaterial({
      color: isEmpty ? 0x90a4ae : 0xdfe8ee,
      metalness: 0.42,
      roughness: 0.34,
      transparent: isEmpty,
      opacity: isEmpty ? 0.52 : 1,
    });
    for (const x of [-BED_WIDTH / 2 - 0.02, BED_WIDTH / 2 + 0.02]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.08, BED_DEPTH * 0.66), railMat);
      rail.position.set(x, 0.86, 0.04);
      group.add(rail);
      for (const z of [-0.58, 0.04, 0.66]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.34, 0.04), railMat);
        post.position.set(x, 0.72, z);
        group.add(post);
      }
    }

    const callButton = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.026, 18),
      new THREE.MeshStandardMaterial({
        color: isEmpty ? 0x78909c : new THREE.Color(status.color),
        emissive: new THREE.Color(status.emissive),
        emissiveIntensity: isEmpty ? 0.2 : 0.7,
        metalness: 0.18,
        roughness: 0.38,
      }),
    );
    callButton.rotation.x = Math.PI / 2;
    callButton.position.set(BED_WIDTH / 2 + 0.16, 0.88, -0.42);
    group.add(callButton);

    const underGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(BED_WIDTH * 1.35, BED_DEPTH * 0.78),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(status.color),
        transparent: true,
        opacity: isEmpty ? 0.035 : 0.07,
        depthWrite: false,
      }),
    );
    underGlow.rotation.x = -Math.PI / 2;
    underGlow.position.set(0, 0.024, 0.04);
    group.add(underGlow);
  }

  private addEmptyWardShowcase(rw: number, rd: number) {
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0xe8f1f4,
      roughness: 0.62,
      metalness: 0.04,
      transparent: true,
      opacity: 0.92,
    });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.08, 1.55), deckMat);
    deck.position.set(0, 0.1, 1.25);
    deck.receiveShadow = true;
    this.roomGroup.add(deck);

    const outlineMat = new THREE.MeshBasicMaterial({
      color: 0x6ee8ff,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });
    const outline = new THREE.Mesh(new THREE.RingGeometry(1.08, 1.1, 64), outlineMat);
    outline.rotation.x = -Math.PI / 2;
    outline.position.set(0, 0.16, 1.25);
    outline.scale.set(1.58, 0.82, 1);
    this.roomGroup.add(outline);

    const bedGhost = new THREE.Mesh(
      new THREE.BoxGeometry(BED_WIDTH, 0.22, BED_DEPTH),
      new THREE.MeshStandardMaterial({
        color: 0xf8fbfd,
        roughness: 0.82,
        transparent: true,
        opacity: 0.58,
      }),
    );
    bedGhost.position.set(0, 0.42, 1.25);
    this.roomGroup.add(bedGhost);

    const headPanel = new THREE.Mesh(
      new THREE.BoxGeometry(BED_WIDTH + 0.34, 1.0, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xf4f8fb, roughness: 0.72, metalness: 0.06 }),
    );
    headPanel.position.set(0, 1.18, 1.25 + HEADBOARD_Z - 0.08);
    this.roomGroup.add(headPanel);

    const screenTex = this.createWardInfoCardTexture('Ready', '0/0', 'waiting for bed data', '#6ee8ff');
    const readyScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.5),
      new THREE.MeshBasicMaterial({ map: screenTex, transparent: true, toneMapped: false }),
    );
    readyScreen.position.set(0, 1.3, 1.25 + HEADBOARD_Z);
    this.roomGroup.add(readyScreen);

    const light = new THREE.Mesh(
      new THREE.BoxGeometry(BED_WIDTH + 0.26, 0.035, 0.03),
      new THREE.MeshBasicMaterial({
        color: 0x78e8ff,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      }),
    );
    light.position.set(0, 1.75, 1.25 + HEADBOARD_Z);
    this.roomGroup.add(light);

    const cabinetMat = new THREE.MeshStandardMaterial({ color: 0xf5f7fa, roughness: 0.58, metalness: 0.04 });
    const bedside = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.6, 0.42), cabinetMat);
    bedside.position.set(-1.65, 0.35, 1.42);
    bedside.castShadow = true;
    this.roomGroup.add(bedside);

    const loungeSeat = new THREE.Mesh(
      new THREE.BoxGeometry(0.78, 0.12, 0.62),
      new THREE.MeshStandardMaterial({ color: 0x9fb5bd, roughness: 0.72 }),
    );
    loungeSeat.position.set(rw / 2 - 2.1, 0.42, rd / 2 - 2.1);
    this.roomGroup.add(loungeSeat);
    const loungeBack = new THREE.Mesh(
      new THREE.BoxGeometry(0.78, 0.62, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x90a8b0, roughness: 0.76 }),
    );
    loungeBack.position.set(rw / 2 - 2.1, 0.75, rd / 2 - 1.82);
    this.roomGroup.add(loungeBack);

    const cart = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.82, 0.44),
      new THREE.MeshStandardMaterial({ color: 0xeef4f7, roughness: 0.56, metalness: 0.08 }),
    );
    cart.position.set(-rw / 2 + 1.5, 0.48, rd / 2 - 2.0);
    cart.castShadow = true;
    this.roomGroup.add(cart);
    const cartLine = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.03, 0.46),
      new THREE.MeshBasicMaterial({ color: 0x66e6ff, transparent: true, opacity: 0.32 }),
    );
    cartLine.position.set(cart.position.x, 0.72, cart.position.z);
    this.roomGroup.add(cartLine);
  }

  private addWardCeilingDetails(rw: number, rd: number) {
    const seamMat = new THREE.MeshStandardMaterial({
      color: 0xdde5e8,
      roughness: 0.92,
      metalness: 0.02,
      transparent: true,
      opacity: 0.16,
    });
    const serviceMat = new THREE.MeshStandardMaterial({
      color: 0xe9eff2,
      roughness: 0.86,
      metalness: 0.04,
      transparent: true,
      opacity: 0.78,
    });

    for (const x of [-rw * 0.24, rw * 0.24]) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.018, rd - 1.6), seamMat);
      seam.position.set(x, ROOM_H - 0.045, 0);
      this.roomGroup.add(seam);
    }
    for (const z of [-rd * 0.18, rd * 0.18]) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(rw - 1.8, 0.018, 0.025), seamMat);
      seam.position.set(0, ROOM_H - 0.045, z);
      this.roomGroup.add(seam);
    }

    const ventPositions: Array<[number, number]> = [
      [-rw * 0.32, -rd * 0.28],
      [rw * 0.32, -rd * 0.28],
      [-rw * 0.32, rd * 0.22],
      [rw * 0.32, rd * 0.22],
    ];
    for (const [x, z] of ventPositions) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.025, 0.34), serviceMat);
      vent.position.set(x, ROOM_H - 0.035, z);
      this.roomGroup.add(vent);
      for (let i = 0; i < 4; i++) {
        const slot = new THREE.Mesh(
          new THREE.BoxGeometry(0.62, 0.012, 0.015),
          new THREE.MeshStandardMaterial({ color: 0xb0bec5, roughness: 0.68 }),
        );
        slot.position.set(x, ROOM_H - 0.016, z - 0.11 + i * 0.07);
        this.roomGroup.add(slot);
      }
    }
  }

  private setupLights() {
    this.scene.add(new THREE.AmbientLight(0xf4faf6, 0.38));
    this.scene.add(new THREE.HemisphereLight(0xf7f3ee, 0x8a847c, 0.28));

    const key = new THREE.DirectionalLight(0xfff8f0, 0.72);
    key.position.set(5, 12, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 40;
    key.shadow.camera.left = -12;
    key.shadow.camera.right = 12;
    key.shadow.camera.top = 12;
    key.shadow.camera.bottom = -12;
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(0xe8e4dc, 0.18);
    rim.position.set(-6, 5, -8);
    this.scene.add(rim);
  }

  private async loadWardInteriorModel() {
    const token = ++this.wardInteriorModelLoadToken;
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    loader.setDRACOLoader(dracoLoader);
    this.onModelState?.('loading');
    let model: THREE.Group | null = null;

    try {
      const gltf = await loader.loadAsync(WARD_INTERIOR_MODEL_URL);
      model = gltf.scene;
      if (token !== this.wardInteriorModelLoadToken) {
        disposeWardInteriorModel(model);
        return;
      }

      const parts = getWardInteriorAssetParts(model);
      model.name = 'blender-smart-ward-interior';
      prepareWardInteriorModelMaterials(model, {
        envMapIntensity: wardInteriorSceneConfig.appearance.envMapIntensity,
        maxMetalness: wardInteriorSceneConfig.appearance.maxMetalness,
      });
      if (parts.bedPrototype)
        parts.bedPrototype.visible = false;
      hideWardInteriorCeiling(parts.architecture);
      fitWardInteriorEnvironment(parts, this.roomW, this.roomD, ROOM_H);
      if (parts.mode === 'baked' && parts.baseBounds) {
        this.roomW = Math.max(parts.baseBounds.size.x, 4);
        this.roomD = Math.max(parts.baseBounds.size.z, 4);
        this.fitControlsToRoom();
      }

      this.wardInteriorModel = model;
      this.wardInteriorParts = parts;
      this.scene.add(model);
      this.roomGroup.visible = false;
      this.clearBedMeshes();
      this.onModelState?.('ready');

      if (this.ward) {
        this.updateWard(this.ward);
        void this.syncWardBedTemplates(this.ward);
      }
      void this.warmGpu();
      // this.logCameraView('模型就绪');
    }
    catch (error) {
      if (token !== this.wardInteriorModelLoadToken) {
        if (model && model !== this.wardInteriorModel)
          disposeWardInteriorModel(model);
        return;
      }
      if (model) {
        if (this.wardInteriorModel === model) {
          this.clearBedMeshes();
          this.scene.remove(model);
          this.wardInteriorModel = null;
          this.wardInteriorParts = null;
        }
        disposeWardInteriorModel(model);
      }
      this.roomGroup.visible = false;
      this.onModelState?.('fallback');
      console.warn('[WardScene] failed to load room-v1 GLB', error);
    }
    finally {
      dracoLoader.dispose();
    }
  }

  private addAccentStrip(x: number, y: number, z: number, w: number, d: number, rotY = 0) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.04, d),
      new THREE.MeshStandardMaterial({
        color: 0x4caf50,
        emissive: 0x388e3c,
        emissiveIntensity: 0.32,
        metalness: 0.2,
        roughness: 0.45,
      }),
    );
    strip.position.set(x, y, z);
    strip.rotation.y = rotY;
    this.roomGroup.add(strip);
    this.accentStrips.push(strip);
  }

  private disposeObject(obj: THREE.Object3D) {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        const mat = child.material;
        if (Array.isArray(mat))
          mat.forEach(m => m.dispose());
        else
          mat.dispose();
      }
    });
  }

  private disposeMesh(mesh?: THREE.Mesh, disposeGeometry = true) {
    if (!mesh)
      return;
    if (disposeGeometry)
      mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach(material => material.dispose());
  }

  private disposeBedMeshGroup(meshGroup: BedMeshGroup) {
    const token = (this.bedTerminalRefreshToken.get(meshGroup.bedCode) ?? 0) + 1;
    this.bedTerminalRefreshToken.set(meshGroup.bedCode, token);
    meshGroup.bedTerminalTexture?.dispose();
    meshGroup.bedsideMonitorTexture?.dispose();
    meshGroup.label?.removeFromParent();
    meshGroup.deviceTag?.removeFromParent();

    if (meshGroup.group.userData.wardInteriorBakedBed) {
      this.disposeMesh(meshGroup.mattress, false);
      this.disposeMesh(meshGroup.indicator, false);
      this.disposeMesh(meshGroup.bedTerminalScreen, false);
      this.disposeMesh(meshGroup.bedsideMonitor, false);
      this.disposeMesh(meshGroup.infusionPump);
      this.disposeMesh(meshGroup.callRing);
      this.disposeMesh(meshGroup.selectionRing);
      this.disposeMesh(meshGroup.selectionPillar);
      this.disposeMesh(meshGroup.selectionBeam);
      meshGroup.infusionPump = undefined;
      meshGroup.callRing = undefined;
      meshGroup.selectionRing = undefined;
      meshGroup.selectionPillar = undefined;
      meshGroup.selectionBeam = undefined;
      meshGroup.label = undefined;
      meshGroup.deviceTag = undefined;
      delete meshGroup.group.userData.bedCode;
      return;
    }

    if (meshGroup.group.userData.wardInteriorModelBed) {
      this.disposeMesh(meshGroup.mattress, false);
      this.disposeMesh(meshGroup.indicator, false);
      this.disposeMesh(meshGroup.bedTerminalScreen, false);
      this.disposeMesh(meshGroup.bedsideMonitor, false);
      this.disposeMesh(meshGroup.infusionPump);
      this.disposeMesh(meshGroup.callRing);
      this.disposeMesh(meshGroup.selectionRing);
      this.disposeMesh(meshGroup.selectionPillar);
      this.disposeMesh(meshGroup.selectionBeam);
    }
    else {
      this.disposeObject(meshGroup.group);
    }
    this.scene.remove(meshGroup.group);
  }

  private clearBedMeshes() {
    for (const meshGroup of this.bedMeshes.values())
      this.disposeBedMeshGroup(meshGroup);
    this.bedMeshes.clear();
  }

  private clearRoomShell() {
    for (const child of [...this.roomGroup.children]) {
      this.disposeObject(child);
      this.roomGroup.remove(child);
    }
    this.accentStrips = [];
    this.ceilingPanels = [];
  }

  private rebuildRoomShell() {
    this.clearRoomShell();

    const floorTex = this.createFloorTexture();
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(this.roomW, this.roomD),
      new THREE.MeshStandardMaterial({
        map: floorTex,
        color: 0xf2f7f4,
        roughness: 0.78,
        metalness: 0.02,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.roomGroup.add(floor);

    if (this.bedCount >= 4) {
      const aisle = new THREE.Mesh(
        new THREE.PlaneGeometry(2, this.roomD - 2.5),
        new THREE.MeshStandardMaterial({ color: 0xd8e2dc, roughness: 0.75, metalness: 0.02 }),
      );
      aisle.rotation.x = -Math.PI / 2;
      aisle.position.set(0, 0.012, -0.3);
      this.roomGroup.add(aisle);
    }

    const wallTex = this.createWallPanelTexture();
    const wallMat = new THREE.MeshStandardMaterial({
      map: wallTex,
      color: 0xffffff,
      roughness: 0.88,
      metalness: 0.01,
    });
    const baseboardMat = new THREE.MeshStandardMaterial({ color: 0xa8bdb0, roughness: 0.82 });

    const rw = this.roomW;
    const rd = this.roomD;
    this.addSmartWardFloorGuides(rw, rd);

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(rw, ROOM_H, 0.12), wallMat);
    backWall.position.set(0, ROOM_H / 2, -rd / 2);
    backWall.receiveShadow = true;
    this.roomGroup.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.12, ROOM_H, rd), wallMat);
    leftWall.position.set(-rw / 2, ROOM_H / 2, 0);
    this.roomGroup.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.12, ROOM_H, rd), wallMat);
    rightWall.position.set(rw / 2, ROOM_H / 2, 0);
    this.roomGroup.add(rightWall);

    const doorW = 1.6;
    const doorX = rw / 2 - 2.2;
    const frontSegW = (rw - doorW) / 2 - 0.15;
    const frontWallMat = wallMat.clone();
    frontWallMat.transparent = true;
    frontWallMat.opacity = 0.18;
    frontWallMat.depthWrite = false;
    const frontLeft = new THREE.Mesh(new THREE.BoxGeometry(frontSegW, ROOM_H, 0.12), frontWallMat);
    frontLeft.position.set(-rw / 2 + frontSegW / 2, ROOM_H / 2, rd / 2);
    const frontRight = new THREE.Mesh(new THREE.BoxGeometry(frontSegW, ROOM_H, 0.12), frontWallMat.clone());
    frontRight.position.set(rw / 2 - frontSegW / 2, ROOM_H / 2, rd / 2);
    this.roomGroup.add(frontLeft, frontRight);

    const baseH = 0.12;
    const addBaseboard = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), baseboardMat);
      board.position.set(x, y, z);
      this.roomGroup.add(board);
    };
    addBaseboard(rw, baseH, 0.06, 0, baseH / 2, -rd / 2 + 0.07);
    addBaseboard(0.06, baseH, rd, -rw / 2 + 0.07, baseH / 2, 0);
    addBaseboard(0.06, baseH, rd, rw / 2 - 0.07, baseH / 2, 0);

    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(rw, rd),
      new THREE.MeshStandardMaterial({ color: 0xfafbfc, roughness: 0.96 }),
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = ROOM_H;
    this.roomGroup.add(ceiling);

    this.addWardCeilingDetails(rw, rd);
    addHospitalWallBand(this.roomGroup, rw, rd);

    const lightCols = this.bedCount >= 4 ? [-rw * 0.28, rw * 0.28] : [-rw * 0.22, rw * 0.22, 0];
    const lightRows = this.bedCount >= 4 ? [-rd * 0.22, rd * 0.18] : [-rd * 0.12, rd * 0.2];
    const lightPositions: Array<[number, number]> = [];
    for (const x of lightCols) {
      for (const z of lightRows)
        lightPositions.push([x, z]);
    }
    if (this.bedCount === 5)
      lightPositions.push([0, rd * 0.28]);

    for (const [x, z] of lightPositions) {
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(1.4, 0.5),
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: 0xfff8f0,
          emissiveIntensity: 0.38,
          roughness: 0.45,
        }),
      );
      panel.rotation.x = Math.PI / 2;
      panel.position.set(x, ROOM_H - 0.02, z);
      this.roomGroup.add(panel);
      this.ceilingPanels.push(panel);
    }

    this.addAccentStrip(0, 2.95, -rd / 2 + 0.08, rw - 1, 0.06);
    this.addAccentStrip(-rw / 2 + 0.08, 2.95, 0, 0.06, rd - 1, 0);
    this.addAccentStrip(rw / 2 - 0.08, 2.95, 0, 0.06, rd - 1, 0);

    const doorFrameMat = new THREE.MeshStandardMaterial({ color: 0x78909c, metalness: 0.35, roughness: 0.55 });
    const doorFrameL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.6, 0.14), doorFrameMat);
    doorFrameL.position.set(doorX - 0.75, 1.3, rd / 2);
    const doorFrameR = doorFrameL.clone();
    doorFrameR.position.set(doorX + 0.75, 1.3, rd / 2);
    const doorFrameT = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.14), doorFrameMat);
    doorFrameT.position.set(doorX, 2.55, rd / 2);
    this.roomGroup.add(doorFrameL, doorFrameR, doorFrameT);

    const doorGlass = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 2.35, 0.05),
      new THREE.MeshStandardMaterial({
        color: 0xb3e5fc,
        transparent: true,
        opacity: 0.45,
        emissive: 0x0288d1,
        emissiveIntensity: 0.12,
        metalness: 0.1,
        roughness: 0.15,
      }),
    );
    doorGlass.position.set(doorX, 1.25, rd / 2 + 0.04);
    this.roomGroup.add(doorGlass);

    const doorLed = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x76ff03, emissive: 0x76ff03, emissiveIntensity: 1.2 }),
    );
    doorLed.position.set(doorX + 0.85, 2.2, rd / 2 + 0.08);
    this.roomGroup.add(doorLed);

    const winFrameMat = new THREE.MeshStandardMaterial({ color: 0x90a4ae, metalness: 0.3, roughness: 0.5 });
    const winW = 3.2;
    const winH = 1.4;
    const winY = 2.75;
    const winZ = -rd / 2 + 0.08;
    const winX = -rw / 2 + 2.8;
    const winFrame = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.16, winH + 0.16, 0.08), winFrameMat);
    winFrame.position.set(winX, winY, winZ);
    const windowGlass = new THREE.Mesh(
      new THREE.BoxGeometry(winW, winH, 0.04),
      new THREE.MeshStandardMaterial({
        color: 0x81d4fa,
        transparent: true,
        opacity: 0.35,
        emissive: 0x0288d1,
        emissiveIntensity: 0.35,
        metalness: 0.05,
        roughness: 0.1,
      }),
    );
    windowGlass.position.set(winX, winY, winZ + 0.02);
    this.roomGroup.add(winFrame, windowGlass);
    this.addWindowTreatment(winX, winY, winZ, winW, winH);

    const monitorTex = this.createMonitorTexture();
    const monitor = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.58, 0.06),
      new THREE.MeshStandardMaterial({ map: monitorTex, emissive: 0x0a1628, emissiveIntensity: 0.35 }),
    );
    monitor.position.set(-rw / 2 + 1.2, 1.65, -rd / 2 + 0.1);
    this.roomGroup.add(monitor);

    const monitorGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.95, 0.62),
      new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.08 }),
    );
    monitorGlow.position.set(-rw / 2 + 1.2, 1.65, -rd / 2 + 0.14);
    this.roomGroup.add(monitorGlow);
    this.addWardWallDataCards(rd);

    const support = resolveWardSupportLayout(this.bedCount, rw, rd);
    const medCabinet = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1.8, 0.45),
      new THREE.MeshStandardMaterial({ color: 0xf5f7fa, roughness: 0.6, metalness: 0.04 }),
    );
    medCabinet.position.set(support.medCabinet.x, 0.9, support.medCabinet.z);
    medCabinet.castShadow = true;
    this.roomGroup.add(medCabinet);

    const cabinetHandle = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.25, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x90a4ae, metalness: 0.5, roughness: 0.35 }),
    );
    cabinetHandle.position.set(support.medCabinet.x, 0.95, support.medCabinet.z + 0.23);
    this.roomGroup.add(cabinetHandle);

    const medLabel = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.34),
      new THREE.MeshBasicMaterial({
        map: this.createSceneLabelTexture('药品柜', '急救 / 常备', '#1e88e5'),
        transparent: true,
        toneMapped: false,
      }),
    );
    medLabel.position.set(support.medCabinet.x, 1.78, support.medCabinet.z + 0.26);
    this.roomGroup.add(medLabel);

    addHandSanitizer(this.roomGroup, doorX - 0.55, 1.45, rd / 2 - 0.08);
    addOxygenOutlet(this.roomGroup, rw / 2 - 0.5, 1.55, -rd / 2 + 0.1);
    this.addWardComfortDetails(rw, rd);

    if ((this.ward?.beds.length ?? this.bedCount) === 0)
      this.addEmptyWardShowcase(rw, rd);
  }

  private fitControlsToRoom() {
    this.applyOpenWardControls();
    const fogDensity = wardInteriorSceneConfig.appearance.baseFogDensity;
    this.scene.fog = fogDensity > 0
      ? new THREE.FogExp2(
          SCENE_BG,
          fogDensity - Math.max(this.roomW, this.roomD) * wardInteriorSceneConfig.appearance.fogSpanFactor,
        )
      : null;
    this.controls.update();
  }

  private applyOpenWardControls() {
    const limits = resolveWardSceneControlLimits(this.roomW, this.roomD);
    this.controls.minPolarAngle = limits.minPolarAngle;
    this.controls.maxPolarAngle = limits.maxPolarAngle;
    this.controls.minAzimuthAngle = limits.minAzimuthAngle;
    this.controls.maxAzimuthAngle = limits.maxAzimuthAngle;
    this.controls.minDistance = limits.minDistance;
    this.controls.maxDistance = limits.maxDistance;
  }

  private getBedScale() {
    return resolveBedVisualScale(this.bedCount);
  }

  private getRoomViewScale() {
    return Math.max(this.roomW / 14, this.roomD / 12);
  }

  private createBedLabel(bed: TwinBedEntity): CSS2DObject {
    const el = document.createElement('div');
    this.applyBedLabelElement(el, bed);
    const label = new CSS2DObject(el);
    label.position.set(0, this.bedCount >= 4 ? 1.5 : 1.68, 0);
    return label;
  }

  private addBedCaster(group: THREE.Group, x: number, z: number) {
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.05, 12),
      new THREE.MeshStandardMaterial({ color: 0x455a64, metalness: 0.5, roughness: 0.45 }),
    );
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(x, 0.07, z);
    wheel.castShadow = true;
    group.add(wheel);
  }

  private applyBedPose(group: THREE.Group, index: number, total: number) {
    if (group.userData.wardInteriorBakedBed)
      return;
    if (group.userData.wardInteriorModelBed) {
      const pose = resolveWardInteriorModelBedPose(index, total, this.roomW, this.roomD);
      if (!pose)
        return;
      group.position.set(pose.x, 0, pose.z);
      group.rotation.y = pose.rotationY;
      group.scale.setScalar(pose.scale);
      return;
    }
    const pose = this.getBedPose(index, total);
    group.position.set(pose.x, 0, pose.z);
    group.rotation.y = pose.rotationY;
  }

  private createBakedModelBedMesh(bed: TwinBedEntity, index: number, total: number): BedMeshGroup {
    const slot = this.wardInteriorParts?.bakedBeds[index];
    if (!slot)
      return this.createGeneratedBedMesh(bed, index, total);

    const bound = bindWardInteriorBakedBed(slot, bed.bedCode);
    const group = bound.group as THREE.Group;

    const status = resolveBedStatus(bed);
    const bedTerminalTexture = this.createBedTerminalTexture(bed, status);
    configureWardInteriorCanvasTexture(bedTerminalTexture);
    const terminalMaterials = Array.isArray(bound.bedTerminalScreen.material)
      ? bound.bedTerminalScreen.material
      : [bound.bedTerminalScreen.material];
    terminalMaterials.forEach(material => material.dispose());
    bound.bedTerminalScreen.material = new THREE.MeshBasicMaterial({
      map: bedTerminalTexture,
      side: THREE.DoubleSide,
      toneMapped: false,
    });

    const bedsideMonitorTexture = this.createBedsideMonitorTexture(bed, status);
    configureWardInteriorCanvasTexture(bedsideMonitorTexture);
    const monitorMaterials = Array.isArray(bound.bedsideMonitor.material)
      ? bound.bedsideMonitor.material
      : [bound.bedsideMonitor.material];
    monitorMaterials.forEach(material => material.dispose());
    bound.bedsideMonitor.material = new THREE.MeshBasicMaterial({
      map: bedsideMonitorTexture,
      side: THREE.DoubleSide,
      toneMapped: false,
    });

    const label = this.createBedLabel(bed);
    label.position.y = 2.25;
    group.add(label);

    const deviceTag = new CSS2DObject(this.createDeviceTagElement(bed));
    deviceTag.position.set(0.55, 2.05, 0.35);
    group.add(deviceTag);

    const selection = this.createSelectionMeshes(status);
    group.add(selection.ring, selection.pulse, selection.beam);

    return {
      bedCode: bed.bedCode,
      group,
      indicator: bound.indicator,
      mattress: bound.mattress,
      bedTerminalScreen: bound.bedTerminalScreen,
      bedTerminalTexture,
      label,
      selectionRing: selection.ring,
      selectionPillar: selection.pulse,
      selectionBeam: selection.beam,
      deviceTag,
      bedsideMonitor: bound.bedsideMonitor,
      bedsideMonitorTexture,
      curtainPhase: group.position.x * 0.7 + group.position.z * 0.4,
    };
  }

  private createModelBedMesh(bed: TwinBedEntity, index: number, total: number): BedMeshGroup {
    const prototype = this.wardInteriorParts?.bedPrototype;
    if (!prototype)
      throw new Error('Ward interior bed prototype is not ready');

    const cloned = cloneWardInteriorBed(prototype, bed.bedCode);
    const group = cloned.group as THREE.Group;
    group.visible = true;
    group.userData.wardInteriorModelBed = true;
    this.applyBedPose(group, index, total);
    group.traverse((object) => {
      if (!(object instanceof THREE.Mesh))
        return;
      object.castShadow = true;
      object.receiveShadow = true;
    });

    const status = resolveBedStatus(bed);
    const bedTerminalTexture = this.createBedTerminalTexture(bed, status);
    configureWardInteriorCanvasTexture(bedTerminalTexture);
    const terminalMaterials = Array.isArray(cloned.bedTerminalScreen.material)
      ? cloned.bedTerminalScreen.material
      : [cloned.bedTerminalScreen.material];
    terminalMaterials.forEach(material => material.dispose());
    cloned.bedTerminalScreen.material = new THREE.MeshBasicMaterial({
      map: bedTerminalTexture,
      side: THREE.DoubleSide,
      toneMapped: false,
    });

    const bedsideMonitorTexture = this.createBedsideMonitorTexture(bed, status);
    configureWardInteriorCanvasTexture(bedsideMonitorTexture);
    const monitorMaterials = Array.isArray(cloned.bedsideMonitor.material)
      ? cloned.bedsideMonitor.material
      : [cloned.bedsideMonitor.material];
    monitorMaterials.forEach(material => material.dispose());
    cloned.bedsideMonitor.material = new THREE.MeshBasicMaterial({
      map: bedsideMonitorTexture,
      side: THREE.DoubleSide,
      toneMapped: false,
    });

    const label = this.createBedLabel(bed);
    label.position.y = 2.25;
    group.add(label);

    const deviceTag = new CSS2DObject(this.createDeviceTagElement(bed));
    deviceTag.position.set(1.15, 2.05, 0.2);
    group.add(deviceTag);

    const selection = this.createSelectionMeshes(status);
    group.add(selection.ring, selection.pulse, selection.beam);
    this.scene.add(group);

    return {
      bedCode: bed.bedCode,
      group,
      indicator: cloned.indicator,
      mattress: cloned.mattress,
      bedTerminalScreen: cloned.bedTerminalScreen,
      bedTerminalTexture,
      label,
      selectionRing: selection.ring,
      selectionPillar: selection.pulse,
      selectionBeam: selection.beam,
      deviceTag,
      bedsideMonitor: cloned.bedsideMonitor,
      bedsideMonitorTexture,
      curtainPhase: group.position.x * 0.7 + group.position.z * 0.4,
    };
  }

  private createBedMesh(bed: TwinBedEntity, index: number, total: number): BedMeshGroup | null {
    if (!this.wardInteriorParts)
      return null;
    if (this.wardInteriorParts.mode === 'baked') {
      if (index < this.wardInteriorParts.bakedBeds.length)
        return this.createBakedModelBedMesh(bed, index, total);
      return null;
    }
    return this.createModelBedMesh(bed, index, total);
  }

  private createGeneratedBedMesh(bed: TwinBedEntity, index: number, total: number): BedMeshGroup {
    const group = new THREE.Group();
    this.applyBedPose(group, index, total);
    group.userData.bedCode = bed.bedCode;
    group.scale.setScalar(this.getBedScale());

    const showHalo = this.bedCount <= 3;
    const pillowY = 0.756;
    const pillowZ = HEADBOARD_Z + 0.28;

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x90a4ae, metalness: 0.55, roughness: 0.38 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(BED_WIDTH, 0.24, BED_DEPTH), frameMat);
    frame.position.y = 0.4;
    frame.castShadow = true;
    group.add(frame);

    [
      [-BED_WIDTH / 2 + 0.1, -BED_DEPTH / 2 + 0.18],
      [BED_WIDTH / 2 - 0.1, -BED_DEPTH / 2 + 0.18],
      [-BED_WIDTH / 2 + 0.1, BED_DEPTH / 2 - 0.18],
      [BED_WIDTH / 2 - 0.1, BED_DEPTH / 2 - 0.18],
    ].forEach(([x, z]) => this.addBedCaster(group, x, z));

    const status = resolveBedStatus(bed);
    const isEmpty = status.state === 'empty';
    const mattressGlow = this.getMattressEmissive(status, isEmpty);
    const mattress = new THREE.Mesh(
      new THREE.BoxGeometry(BED_WIDTH - 0.12, 0.18, BED_DEPTH - 0.22),
      new THREE.MeshStandardMaterial({
        color: isEmpty ? 0xb0bec5 : 0xf5f7fa,
        emissive: new THREE.Color(mattressGlow.color),
        emissiveIntensity: mattressGlow.intensity,
        roughness: 0.9,
        transparent: isEmpty,
        opacity: isEmpty ? 0.65 : 1,
      }),
    );
    mattress.position.y = 0.58;
    mattress.castShadow = true;
    group.add(mattress);

    const quiltMatOptions: THREE.MeshStandardMaterialParameters = {
      color: isEmpty ? 0xcfd8dc : 0xffffff,
      roughness: 0.94,
      metalness: 0,
      transparent: isEmpty,
      opacity: isEmpty ? 0.5 : 1,
    };
    if (!isEmpty)
      quiltMatOptions.map = this.getQuiltTexture();
    const quiltMat = new THREE.MeshStandardMaterial(quiltMatOptions);
    const quilt = new THREE.Mesh(new THREE.BoxGeometry(BED_WIDTH - 0.18, 0.04, BED_DEPTH - 0.34), quiltMat);
    quilt.position.set(0, 0.692, 0.06);
    group.add(quilt);

    if (!isEmpty) {
      const duvet = new THREE.Mesh(
        new THREE.BoxGeometry(BED_WIDTH - 0.24, 0.028, BED_DEPTH * 0.58),
        new THREE.MeshStandardMaterial({
          map: this.getQuiltTexture(),
          color: 0xf8fafc,
          roughness: 0.96,
        }),
      );
      duvet.position.set(0, 0.718, 0.26);
      group.add(duvet);

      const nursingColor = bed.nursingColor ?? bed.sickInfo?.nursingColor;
      if (nursingColor) {
        const band = new THREE.Mesh(
          new THREE.BoxGeometry(BED_WIDTH - 0.28, 0.012, 0.06),
          new THREE.MeshStandardMaterial({
            color: new THREE.Color(nursingColor),
            roughness: 0.85,
          }),
        );
        band.position.set(0, 0.726, -0.1);
        group.add(band);
      }
    }

    const headboard = new THREE.Mesh(
      new THREE.BoxGeometry(BED_WIDTH + 0.12, 0.78, 0.1),
      new THREE.MeshStandardMaterial({
        color: isEmpty ? 0x9e9e9e : 0x607d8b,
        metalness: 0.25,
        roughness: 0.55,
        transparent: isEmpty,
        opacity: isEmpty ? 0.55 : 1,
      }),
    );
    headboard.position.set(0, 0.76, HEADBOARD_Z);
    group.add(headboard);

    const { screen: bedTerminalScreen, texture: bedTerminalTexture } = this.addHeadboardAssembly(
      group,
      bed,
      status,
      isEmpty,
    );
    this.addHeadwallUtilities(group, status, isEmpty);
    this.addBedSafetyDetails(group, status, isEmpty);
    const bedsideMonitor = this.addBedsideMonitor(group, bed, status, isEmpty);
    const bedsideMonitorTexture = bedsideMonitor?.userData.monitorTexture as THREE.CanvasTexture | undefined;

    if (!isEmpty) {
      const caseMat = new THREE.MeshStandardMaterial({
        map: this.getPillowcaseTexture(),
        color: 0xffffff,
        roughness: 0.93,
      });
      const pillow = new THREE.Mesh(new THREE.BoxGeometry(BED_WIDTH - 0.28, 0.1, 0.34), caseMat);
      pillow.position.set(0, pillowY, pillowZ);
      pillow.castShadow = true;
      group.add(pillow);

      const pillowCore = new THREE.Mesh(
        new THREE.BoxGeometry(BED_WIDTH - 0.38, 0.06, 0.26),
        new THREE.MeshStandardMaterial({ color: 0xf0f4f8, roughness: 0.98 }),
      );
      pillowCore.position.set(0, pillowY - 0.008, pillowZ);
      group.add(pillowCore);

      const pillowLip = new THREE.Mesh(
        new THREE.BoxGeometry(BED_WIDTH - 0.34, 0.018, 0.3),
        new THREE.MeshStandardMaterial({ color: 0xeceff1, roughness: 0.95 }),
      );
      pillowLip.position.set(0, pillowY + 0.052, pillowZ + 0.05);
      pillowLip.rotation.x = -0.18;
      group.add(pillowLip);

      addBedsideCabinet(group, 0, 0);
      if (status.state !== 'infusing')
        addIvStand(group, 0, 0);
      this.addOverbedTable(group, isEmpty);
    }

    if (showHalo) {
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(0.95, 1.15, 32),
        new THREE.MeshBasicMaterial({
          color: status.color,
          transparent: true,
          opacity: isEmpty ? 0.08 : 0.18,
          side: THREE.DoubleSide,
        }),
      );
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = 0.02;
      halo.scale.set(0.62, 1.24, 1);
      group.add(halo);
    }

    const indicator = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 16, 16),
      new THREE.MeshStandardMaterial({
        color: status.color,
        emissive: new THREE.Color(status.emissive),
        emissiveIntensity: 0.85,
      }),
    );
    indicator.position.set(-BED_WIDTH / 2 + 0.14, 1.42, HEADBOARD_Z + 0.22);
    group.add(indicator);

    const label = this.createBedLabel(bed);
    group.add(label);

    const deviceTag = new CSS2DObject(this.createDeviceTagElement(bed));
    deviceTag.position.set(BED_WIDTH / 2 + 0.18, 1.55, 0.2);
    group.add(deviceTag);

    const curtainPanels = this.addBedCurtain(group, this.getCurtainMode());

    let infusionPump: THREE.Mesh | undefined;
    if (status.state === 'infusing') {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 1.6, 8),
        new THREE.MeshStandardMaterial({ color: 0x78909c, metalness: 0.55, roughness: 0.35 }),
      );
      pole.position.set(BED_WIDTH / 2 + 0.28, 0.95, 0.45);
      group.add(pole);

      infusionPump = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.32, 0.14),
        new THREE.MeshStandardMaterial({ color: 0x455a64, emissive: 0xff9800, emissiveIntensity: 0.45 }),
      );
      infusionPump.position.set(BED_WIDTH / 2 + 0.28, 0.55, 0.45);
      group.add(infusionPump);
    }

    if (bed.nursingLabels?.length) {
      bed.nursingLabels.forEach((tag, i) => {
        const tagMesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.06, 8, 8),
          new THREE.MeshStandardMaterial({
            color: tag.labelColor,
            emissive: tag.labelColor,
            emissiveIntensity: 0.55,
          }),
        );
        tagMesh.position.set(-BED_WIDTH / 2 + 0.18 + i * 0.16, 1.32, 0.35);
        group.add(tagMesh);
      });
    }

    let callRing: THREE.Mesh | undefined;
    if (bed.isCalling) {
      callRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.32, 0.035, 8, 24),
        new THREE.MeshStandardMaterial({
          color: 0xe91e63,
          emissive: 0xff1744,
          emissiveIntensity: 0.85,
        }),
      );
      callRing.rotation.x = Math.PI / 2;
      callRing.position.set(0, 1.32, 0);
      group.add(callRing);
    }

    this.scene.add(group);
    const selection = this.createSelectionMeshes(status);
    group.add(selection.ring, selection.pulse, selection.beam);
    return {
      bedCode: bed.bedCode,
      group,
      indicator,
      mattress,
      bedTerminalScreen,
      bedTerminalTexture,
      infusionPump,
      callRing,
      label,
      selectionRing: selection.ring,
      selectionPillar: selection.pulse,
      selectionBeam: selection.beam,
      deviceTag,
      bedsideMonitor,
      bedsideMonitorTexture,
      curtainPanels,
      curtainPhase: group.position.x * 0.7 + group.position.z * 0.4,
    };
  }

  updateWard(ward: TwinWardEntity) {
    this.ward = ward;

    const count = Math.max(1, ward.beds.length);
    if (count !== this.lastBedCount) {
      this.bedCount = count;
      this.lastBedCount = count;
      if (this.wardInteriorParts?.mode !== 'baked') {
        const { w, d } = getWardRoomSize(count);
        if (w !== this.roomW || d !== this.roomD) {
          this.roomW = w;
          this.roomD = d;
          this.rebuildRoomShell();
          if (this.wardInteriorParts)
            fitWardInteriorEnvironment(this.wardInteriorParts, this.roomW, this.roomD, ROOM_H);
        }
      }
      this.fitControlsToRoom();
      this.clearBedMeshes();
    }

    const existingCodes = new Set(this.bedMeshes.keys());
    const newCodes = new Set(ward.beds.map(b => b.bedCode));

    for (const code of existingCodes) {
      if (!newCodes.has(code)) {
        const mesh = this.bedMeshes.get(code)!;
        this.disposeBedMeshGroup(mesh);
        this.bedMeshes.delete(code);
      }
    }

    for (const [index, bed] of ward.beds.entries()) {
      if (!this.bedMeshes.has(bed.bedCode)) {
        const created = this.createBedMesh(bed, index, ward.beds.length);
        if (created)
          this.bedMeshes.set(bed.bedCode, created);
      }
      const meshGroup = this.bedMeshes.get(bed.bedCode);
      if (meshGroup)
        this.applyBedPose(meshGroup.group, index, ward.beds.length);
      this.updateBedVisual(bed);
    }
    if (this.wardInteriorParts)
      syncWardInteriorBakedBedVisibility(this.wardInteriorParts, ward.beds.length);
    this.updateAllBedSelectionVisuals();
  }

  private updateBedVisual(bed: TwinBedEntity) {
    const meshGroup = this.bedMeshes.get(bed.bedCode);
    if (!meshGroup)
      return;

    const status = resolveBedStatus(bed);
    const isEmpty = status.state === 'empty';
    const mat = meshGroup.mattress.material as THREE.MeshStandardMaterial;
    const mattressGlow = this.getMattressEmissive(status, isEmpty);
    mat.color.set(isEmpty ? 0xb0bec5 : 0xf5f7fa);
    mat.emissive.set(mattressGlow.color);
    mat.emissiveIntensity = mattressGlow.intensity;

    const indicatorMat = meshGroup.indicator.material as THREE.MeshStandardMaterial;
    indicatorMat.color.set(status.color);
    indicatorMat.emissive.set(status.emissive);

    if (meshGroup.bedTerminalScreen)
      void this.refreshBedTerminal(bed);

    if (meshGroup.label?.element)
      this.applyBedLabelElement(meshGroup.label.element as HTMLElement, bed);
    if (meshGroup.deviceTag?.element)
      this.applyDeviceTagElement(meshGroup.deviceTag.element as HTMLElement, bed);
    if (meshGroup.label)
      meshGroup.label.visible = this.shouldShowBedOverlay(bed);
    if (meshGroup.deviceTag)
      meshGroup.deviceTag.visible = this.shouldShowBedOverlay(bed);

    if (meshGroup.bedsideMonitor) {
      const oldTexture = meshGroup.bedsideMonitorTexture;
      const newTexture = this.createBedsideMonitorTexture(bed, status);
      if (meshGroup.group.userData.wardInteriorModelBed)
        configureWardInteriorCanvasTexture(newTexture);
      const monitorMat = meshGroup.bedsideMonitor.material as THREE.MeshBasicMaterial;
      monitorMat.map = newTexture;
      monitorMat.needsUpdate = true;
      meshGroup.bedsideMonitorTexture = newTexture;
      oldTexture?.dispose();
    }

    const isInfusing = status.state === 'infusing';
    if (isInfusing && !meshGroup.infusionPump) {
      const pump = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.5, 0.2),
        new THREE.MeshStandardMaterial({ color: 0x607d8b, emissive: 0xff9800, emissiveIntensity: 0.3 }),
      );
      pump.position.set(1.1, 0.5, 0.3);
      meshGroup.group.add(pump);
      meshGroup.infusionPump = pump;
    }
    else if (!isInfusing && meshGroup.infusionPump) {
      meshGroup.group.remove(meshGroup.infusionPump);
      this.disposeMesh(meshGroup.infusionPump);
      meshGroup.infusionPump = undefined;
    }

    if (bed.isCalling && !meshGroup.callRing) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.35, 0.04, 8, 24),
        new THREE.MeshStandardMaterial({
          color: 0xe91e63,
          emissive: 0xff1744,
          emissiveIntensity: 0.8,
        }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 1.35, 0);
      meshGroup.group.add(ring);
      meshGroup.callRing = ring;
    }
    else if (!bed.isCalling && meshGroup.callRing) {
      meshGroup.group.remove(meshGroup.callRing);
      this.disposeMesh(meshGroup.callRing);
      meshGroup.callRing = undefined;
    }
    this.updateBedSelectionVisual(bed);
  }

  private updateBedSelectionVisual(bed: TwinBedEntity) {
    const meshGroup = this.bedMeshes.get(bed.bedCode);
    if (!meshGroup)
      return;

    const selected = this.selectedBedCode === bed.bedCode;
    const status = resolveBedStatus(bed);
    for (const mesh of [meshGroup.selectionRing, meshGroup.selectionPillar, meshGroup.selectionBeam]) {
      if (!mesh)
        continue;
      mesh.visible = selected;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.color.set(status.color);
    }

    if (meshGroup.label?.element)
      this.applyBedLabelElement(meshGroup.label.element as HTMLElement, bed);
    if (meshGroup.label)
      meshGroup.label.visible = this.shouldShowBedOverlay(bed);
    if (meshGroup.deviceTag)
      meshGroup.deviceTag.visible = this.shouldShowBedOverlay(bed);
  }

  private updateAllBedSelectionVisuals() {
    if (!this.ward)
      return;
    for (const bed of this.ward.beds)
      this.updateBedSelectionVisual(bed);
  }

  private usesNativeCameraPose() {
    return this.wardInteriorParts?.mode !== 'prototype';
  }

  setCameraPreset(presetId: CameraPresetId) {
    if (this.activePresetId === presetId && !this.cameraTransition)
      return;

    this.activePresetId = presetId;
    const preset = getCameraPreset(presetId);
    const toPos = new THREE.Vector3(...preset.position);
    const toTarget = new THREE.Vector3(...preset.target);
    if (!this.usesNativeCameraPose()) {
      const scale = this.getRoomViewScale();
      const viewportScale = resolveWardCameraViewportScale(this.camera.aspect);
      const cameraScale = (presetId === 'door' ? Math.min(1.08, scale) : scale) * viewportScale;
      toPos.set(
        preset.position[0] * cameraScale,
        preset.position[1] * (0.92 + scale * 0.08) * viewportScale,
        preset.position[2] * cameraScale,
      );
      toTarget.set(
        preset.target[0],
        preset.target[1],
        preset.target[2] * (presetId === 'door' ? 1 : scale > 1 ? 0.85 : 1),
      );
    }
    this.cameraTransition = {
      elapsed: 0,
      duration: wardInteriorSceneConfig.camera.presetTransitionDuration,
      fromPos: this.camera.position.clone(),
      toPos,
      fromTarget: this.controls.target.clone(),
      toTarget,
    };
  }

  setEnvAlertLevel(level: EnvAlertLevel) {
    if (this.alertLevel === level)
      return;
    this.alertLevel = level;
    const tint = getEnvSceneTint(level);
    this.scene.background = new THREE.Color(tint);
    this.scene.fog = new THREE.FogExp2(tint, 0.028);
  }

  setSelectedBedCode(bedCode: string | null) {
    if (this.selectedBedCode === bedCode)
      return;
    this.selectedBedCode = bedCode;
    this.updateAllBedSelectionVisuals();
    if (bedCode)
      this.focusSelectedBed(bedCode);
  }

  private focusSelectedBed(bedCode: string) {
    const meshGroup = this.bedMeshes.get(bedCode);
    if (!meshGroup)
      return;

    const target = meshGroup.group.position.clone();
    target.y = 0.78;
    const offset = new THREE.Vector3(1.8, 2.25, 3.2);
    const viewportScale = resolveWardCameraViewportScale(this.camera.aspect);
    offset.multiplyScalar(viewportScale);
    const toPos = target.clone().add(offset);
    this.activePresetId = null;
    this.cameraTransition = {
      elapsed: 0,
      duration: wardInteriorSceneConfig.camera.bedFocusTransitionDuration,
      fromPos: this.camera.position.clone(),
      toPos,
      fromTarget: this.controls.target.clone(),
      toTarget: target,
    };
  }

  private handleClick = (event: MouseEvent) => {
    if (!this.ward || this.suppressBedClick) {
      this.suppressBedClick = false;
      return;
    }

    const rect = this.container.getBoundingClientRect();
    if (!rect.width || !rect.height)
      return;

    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const groups = [
      ...[...this.bedMeshes.values()].map(m => m.group),
      ...(this.wardInteriorModel ? [this.wardInteriorModel] : []),
    ];
    const intersects = this.raycaster.intersectObjects(groups, true);

    if (intersects.length > 0) {
      const hit = intersects[0];
      // console.info('[WardScene] 射线命中', {
      //   name: hit.object.name || '(unnamed)',
      //   parent: hit.object.parent?.name || '(none)',
      //   point: hit.point.toArray().map(value => Number(value.toFixed(3))),
      //   camera: this.camera.position.toArray().map(value => Number(value.toFixed(3))),
      //   target: this.controls.target.toArray().map(value => Number(value.toFixed(3))),
      // });
      let obj: THREE.Object3D | null = hit.object;
      while (obj && !obj.userData.bedCode)
        obj = obj.parent;
      if (obj?.userData.bedCode) {
        const bed = this.ward.beds.find(b => b.bedCode === obj!.userData.bedCode);
        if (bed)
          this.onBedClick?.(bed);
      }
    }
  };

  private handleResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width <= 0 || height <= 0)
      return;
    const previousViewportScale = resolveWardCameraViewportScale(this.camera.aspect);
    this.camera.aspect = width / height;
    const nextViewportScale = resolveWardCameraViewportScale(this.camera.aspect);
    if (
      this.wardInteriorParts?.mode !== 'baked'
      && Math.abs(nextViewportScale - previousViewportScale) > 0.001
    ) {
      this.cameraTransition = null;
      this.camera.position
        .sub(this.controls.target)
        .multiplyScalar(nextViewportScale / previousViewportScale)
        .add(this.controls.target);
      this.controls.update();
    }
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.labelRenderer.setSize(width, height);
    this.styleRendererLayers();
    this.styleLabelLayer();
  }

  setActive(active: boolean) {
    if (this.isActive === active)
      return;
    this.isActive = active;
    this.controls.enabled = active;
    if (active) {
      this.clock.getDelta();
      this.handleResize();
      if (!this.animationId)
        this.animate();
      return;
    }
    cancelAnimationFrame(this.animationId);
    this.animationId = 0;
  }

  private async warmGpu() {
    try {
      await this.renderer.compileAsync(this.scene, this.camera);
    }
    catch {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private animate = () => {
    if (!this.isActive)
      return;
    this.animationId = requestAnimationFrame(this.animate);
    if (this.pageHidden)
      return;

    const delta = this.clock.getDelta();
    const elapsed = this.clock.elapsedTime;

    if (this.cameraTransition) {
      this.cameraTransition.elapsed += delta;
      const t = easeOutCubic(this.cameraTransition.elapsed / this.cameraTransition.duration);
      this.camera.position.lerpVectors(this.cameraTransition.fromPos, this.cameraTransition.toPos, t);
      this.controls.target.lerpVectors(this.cameraTransition.fromTarget, this.cameraTransition.toTarget, t);
      if (t >= 1)
        this.cameraTransition = null;
    }

    const envPulse = 0.38 + Math.sin(elapsed * 1.2) * 0.06;
    for (const strip of this.accentStrips) {
      const mat = strip.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = envPulse;
    }
    for (const panel of this.ceilingPanels) {
      const mat = panel.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.34 + Math.sin(elapsed * 1.5 + 1) * 0.04;
    }

    if (this.ward) {
      for (const bed of this.ward.beds) {
        const meshGroup = this.bedMeshes.get(bed.bedCode);
        if (!meshGroup)
          continue;
        const status = resolveBedStatus(bed);
        if (status.state === 'infusing') {
          const pulse = 0.55 + Math.sin(elapsed * 2.5) * 0.15;
          const indicatorMat = meshGroup.indicator.material as THREE.MeshStandardMaterial;
          indicatorMat.emissiveIntensity = pulse;
          if (meshGroup.infusionPump) {
            const pumpMat = meshGroup.infusionPump.material as THREE.MeshStandardMaterial;
            pumpMat.emissiveIntensity = 0.25 + pulse * 0.25;
          }
        }
        if (bed.isCalling && meshGroup.callRing) {
          const ringMat = meshGroup.callRing.material as THREE.MeshStandardMaterial;
          ringMat.emissiveIntensity = 0.55 + Math.sin(elapsed * 4) * 0.25;
          meshGroup.callRing.rotation.z = elapsed * 1.2;
          meshGroup.callRing.scale.setScalar(1 + Math.sin(elapsed * 4) * 0.04);
        }

        if (this.selectedBedCode === bed.bedCode) {
          const selectPulse = 1 + Math.sin(elapsed * 2.8) * 0.08;
          const selectAlpha = 0.42 + Math.sin(elapsed * 3.2) * 0.12;
          if (meshGroup.selectionRing) {
            meshGroup.selectionRing.rotation.z = elapsed * 0.55;
            meshGroup.selectionRing.scale.set(1.35 * selectPulse, 0.78 * selectPulse, 1);
            const mat = meshGroup.selectionRing.material as THREE.MeshBasicMaterial;
            mat.opacity = selectAlpha;
          }
          if (meshGroup.selectionPillar) {
            const pillarScale = 1.08 + Math.sin(elapsed * 2.4) * 0.16;
            meshGroup.selectionPillar.scale.set(1.35 * pillarScale, 0.78 * pillarScale, 1);
            const mat = meshGroup.selectionPillar.material as THREE.MeshBasicMaterial;
            mat.opacity = 0.22 + Math.sin(elapsed * 2.6) * 0.08;
          }
          if (meshGroup.selectionBeam) {
            meshGroup.selectionBeam.rotation.y = elapsed * 0.45;
            const mat = meshGroup.selectionBeam.material as THREE.MeshBasicMaterial;
            mat.opacity = 0.075 + Math.sin(elapsed * 2.2) * 0.025;
          }
        }

        if (meshGroup.label?.element) {
          const dist = this.camera.position.distanceTo(meshGroup.group.position);
          const minScale = this.bedCount >= 5 ? 0.5 : this.bedCount >= 4 ? 0.55 : 0.65;
          const selected = this.selectedBedCode === bed.bedCode;
          const labelScale = THREE.MathUtils.clamp(
            dist / (12 + this.bedCount * 0.5) * (selected ? 1.12 : 1),
            selected ? Math.max(minScale, 0.78) : minScale,
            selected ? 1.18 : 1,
          );
          (meshGroup.label.element as HTMLElement).style.transform = `translate(-50%, -100%) scale(${labelScale})`;
        }

        if (meshGroup.curtainPanels?.length) {
          const phase = meshGroup.curtainPhase ?? 0;
          const sway = Math.sin(elapsed * 0.45 + phase) * 0.014;
          const sway2 = Math.sin(elapsed * 0.38 + phase + 1.2) * 0.008;
          const headBaseZ = HEADBOARD_Z - 0.24 - 0.045;
          meshGroup.curtainPanels.forEach((panel, idx) => {
            if (idx === 0) {
              panel.position.z = headBaseZ + sway;
              panel.rotation.x = sway2 * 0.35;
            }
            else {
              panel.rotation.z = (idx % 2 === 0 ? 1 : -1) * sway * 0.4;
            }
          });
        }
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  };

  dispose() {
    ++this.wardInteriorModelLoadToken;
    this.clearBedMeshes();
    if (this.wardInteriorModel) {
      this.scene.remove(this.wardInteriorModel);
      disposeWardInteriorModel(this.wardInteriorModel);
      this.wardInteriorModel = null;
      this.wardInteriorParts = null;
    }
    this.clearRoomShell();
    this.quiltTexture?.dispose();
    this.pillowcaseTexture?.dispose();
    this.quiltTexture = null;
    this.pillowcaseTexture = null;
    this.environmentTexture?.dispose();
    this.environmentTexture = null;
    this.scene.environment = null;
    cancelAnimationFrame(this.animationId);
    this.resizeObserver?.disconnect();
    this.controls.removeEventListener('start', this.onControlsStart);
    this.controls.removeEventListener('change', this.onControlsChange);
    this.controls.removeEventListener('end', this.onControlsEnd);
    window.clearTimeout(this.cameraViewLogTimer);
    this.container.removeEventListener('click', this.handleClick);
    this.container.removeEventListener('wheel', this.cancelCameraTransition);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labelRenderer.domElement.remove();
  }
}
