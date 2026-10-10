import * as THREE from 'three';
import referenceDashboardUrl from '@/assets/nurse-station/reference-dashboard.png';

/** 主屏按指定参考图展示，保留原始像素，避免重排字体或主题改色。 */
export function createReferenceDashboardTexture(target?: THREE.CanvasTexture) {
  if (target?.userData.referenceDashboard) return target;

  const canvas = document.createElement('canvas');
  canvas.width = 2556;
  canvas.height = 1306;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#e5ebf9';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const texture = target ?? new THREE.CanvasTexture(canvas);
  texture.image = canvas;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.userData.referenceDashboard = 'loading';
  texture.needsUpdate = true;

  const image = new Image();
  const dispose = () => {
    image.onload = null;
    image.onerror = null;
    texture.removeEventListener('dispose', dispose);
  };
  texture.addEventListener('dispose', dispose);
  image.onload = () => {
    // 参考图覆盖完整 UV，按屏幕宽高铺满，不再加入任何留边。
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    ctx.drawImage(image, 0, 0);
    texture.userData.referenceContent = { x: 0, y: 0, width: canvas.width, height: canvas.height };
    texture.userData.referenceDashboard = 'ready';
    texture.needsUpdate = true;
    dispose();
  };
  image.onerror = () => {
    ctx.fillStyle = '#173a62';
    ctx.font = '40px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('看板加载失败，请刷新重试', canvas.width / 2, canvas.height / 2);
    texture.userData.referenceDashboard = 'error';
    texture.needsUpdate = true;
    dispose();
  };
  image.src = referenceDashboardUrl;
  return texture;
}
