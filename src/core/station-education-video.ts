import * as THREE from 'three';

/** Owns one TV overlay, media element and textures; no URL means no media request. */
export function bindStationEducationVideo(model: THREE.Object3D, url: string = '') {
  const source = model.getObjectByName('Screen_Video');
  if (!(source instanceof THREE.Mesh) || !source.geometry.getAttribute('uv'))
    throw new Error('护士站模型缺少独立视频屏幕或 UV: Screen_Video');
  const canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = 540;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法创建护士站电视占位画布');
  const idle = new THREE.CanvasTexture(canvas);
  idle.colorSpace = THREE.SRGBColorSpace;
  idle.flipY = false;
  const material = new THREE.MeshBasicMaterial({ map: idle, toneMapped: false });
  const screen = new THREE.Mesh(source.geometry.clone(), material);
  screen.name = 'nurse-station-education-video';
  screen.position.copy(source.position);
  screen.quaternion.copy(source.quaternion);
  screen.scale.copy(source.scale);
  const sourceVisible = source.visible;
  source.visible = false;
  source.parent!.add(screen);
  const video = url.trim() ? document.createElement('video') : null;
  let texture: THREE.VideoTexture | null = null;
  let active = false, disposed = false, dark = false, failed = false, generation = 0;
  let status = video ? '视频加载中' : '暂无视频';

  function draw() {
    context!.fillStyle = dark ? '#0d263b' : '#e9f3f7';
    context!.fillRect(0, 0, 960, 540);
    context!.strokeStyle = dark ? '#3985a5' : '#91bccc';
    context!.lineWidth = 2;
    context!.strokeRect(26, 26, 908, 488);
    context!.fillStyle = dark ? '#82d5ed' : '#28758d';
    context!.font = '32px Microsoft YaHei, sans-serif';
    context!.textAlign = 'center';
    context!.fillText('健康宣教', 480, 125);
    context!.fillStyle = dark ? '#edf8ff' : '#173a51';
    context!.font = 'bold 52px Microsoft YaHei, sans-serif';
    context!.fillText(status, 480, 287);
    context!.fillStyle = dark ? '#9ebccc' : '#587385';
    context!.font = '25px Microsoft YaHei, sans-serif';
    context!.fillText(video ? '院内宣教 · 静音播放' : '配置宣教素材后在此播放', 480, 408);
    idle.needsUpdate = true;
  }
  function fallback(label: string) {
    status = label;
    material.map = idle;
    material.needsUpdate = true;
    draw();
  }
  function playing() {
    if (!video || disposed) return;
    if (!active || failed) { video.pause(); return; }
    if (!texture) {
      texture = new THREE.VideoTexture(video);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = false;
    }
    material.map = texture;
    material.needsUpdate = true;
    status = '播放中';
  }
  function error() {
    if (disposed) return;
    failed = true;
    generation++;
    video?.pause();
    fallback('视频加载失败');
  }
  if (video) {
    video.crossOrigin = 'anonymous';
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'none';
    video.addEventListener('playing', playing);
    video.addEventListener('error', error);
    video.src = url;
  }
  draw();
  return {
    setActive(value: boolean) {
      if (disposed || value === active) return;
      active = value;
      const token = ++generation;
      if (!video) return;
      if (!value) { video.pause(); return; }
      if (failed) return;
      void video.play().then(() => {
        if (disposed || !active) { video.pause(); return; }
        if (token === generation) playing();
      }).catch(() => {
        if (!disposed && active && token === generation && !failed) fallback('视频无法自动播放');
      });
    },
    setTheme(value: boolean) { if (!disposed) { dark = value; draw(); } },
    dispose() {
      if (disposed) return;
      disposed = true;
      active = false;
      generation++;
      if (video) {
        video.removeEventListener('playing', playing);
        video.removeEventListener('error', error);
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
      texture?.dispose();
      idle.dispose();
      screen.removeFromParent();
      screen.geometry.dispose();
      material.dispose();
      source.visible = sourceVisible;
    },
  };
}
