import * as THREE from 'three';

export interface CorridorSignData {
  mode: 'area' | 'clock';
  theme?: 'light' | 'dark';
  areaName: string;
  aspect?: number;
}

/** Draw in physical screen proportions; never squeeze glyphs to fit a wide mesh. */
export function createCorridorSignTexture(data: CorridorSignData): THREE.CanvasTexture {
  const aspect = Number.isFinite(data.aspect) && data.aspect! > 0 ? data.aspect! : 4;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(1600 * Math.min(1, aspect)));
  canvas.height = Math.max(1, Math.round(1600 / Math.max(1, aspect)));
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width, h = canvas.height;
  // Both hanging displays share one palette; mode changes content, not the theme.
  const light = data.theme === 'light';
  const colors = light
    ? { surface: '#edf3f4', text: '#294c60', secondary: '#526f7e', frame: '#a6bac4', highlight: '#f8fbfc', trim: '#c6d8df' }
    : { surface: '#20343f', text: '#e8f0f3', secondary: '#b0c5d0', frame: '#536f7e', highlight: '#385360', trim: '#304d5c' };
  const edge = Math.max(2, Math.round(h * 0.025));
  const trim = Math.max(3, Math.round(h * 0.045));
  ctx.fillStyle = colors.frame;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = colors.surface;
  ctx.fillRect(edge, edge, w - edge * 2, h - edge * 2);
  ctx.fillStyle = colors.highlight;
  ctx.fillRect(edge, edge, w - edge * 2, Math.max(1, edge * 0.3));
  ctx.fillStyle = colors.trim;
  ctx.fillRect(edge, h - edge - trim, w - edge * 2, trim);
  const inset = Math.min(w * 0.06, h * 0.22);
  ctx.fillStyle = colors.text;
  ctx.textBaseline = 'middle';
  if (data.mode === 'area') {
    const text = data.areaName.trim() || '病区';
    const available = w - inset * 4;
    let size = h * 0.48;
    ctx.font = `600 ${size}px "Microsoft YaHei", sans-serif`;
    // Uniform font scaling retains glyph proportions, including long ward names.
    const measured = ctx.measureText(text).width;
    if (measured > available) size *= available / measured;
    ctx.font = `600 ${size}px "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(text, w / 2, (h - trim) / 2);
  }
  else {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    const main = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const seconds = pad(now.getSeconds());
    let size = h * 0.65;
    const mainFont = () => `600 ${size}px "Consolas", monospace`;
    const secondFont = () => `500 ${size * 0.38}px "Consolas", monospace`;
    ctx.font = mainFont();
    let mainWidth = ctx.measureText(main).width;
    ctx.font = secondFont();
    let secondsWidth = ctx.measureText(seconds).width;
    const available = w - inset * 4;
    const ratio = Math.min(1, available / (mainWidth + secondsWidth + size * 0.2));
    size *= ratio;
    mainWidth *= ratio;
    secondsWidth *= ratio;
    const gap = size * 0.2;
    const x = (w - mainWidth - secondsWidth - gap) / 2;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const baseline = (h - trim) / 2 + size * 0.34;
    ctx.font = mainFont();
    ctx.fillText(main, x, baseline);
    ctx.font = secondFont();
    ctx.fillStyle = colors.secondary;
    ctx.fillText(seconds, x + mainWidth + gap, baseline);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  return texture;
}
