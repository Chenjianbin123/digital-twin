import { resolveBedStatus } from '@/core/bed-status';
import { buildMainStaffList } from '@/core/door-staff';
import { displayPatientName } from '@/utils/mask-patient';
import { getWardBedStats, type TwinBedEntity, type TwinWardEntity } from '@/types/twin';

export interface PlanRendererOptions {
  canvas: HTMLCanvasElement;
  onBedClick?: (bed: TwinBedEntity) => void;
}

interface BedRect {
  bed: TwinBedEntity;
  x: number;
  y: number;
  w: number;
  h: number;
}

const FONT = '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
const PULSE_STATES = new Set(['calling', 'infusing', 'offline', 'lowBattery']);

export class PlanRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private ward: TwinWardEntity | null = null;
  private bedRects: BedRect[] = [];
  private onBedClick?: (bed: TwinBedEntity) => void;
  private resizeObserver: ResizeObserver | null = null;
  private dpr = window.devicePixelRatio || 1;
  private selectedBedCode: string | null = null;
  private hoveredBedCode: string | null = null;
  private pulsePhase = 0;
  private animId: number | null = null;
  private fontScale = 1.25;

  /** 按画布尺寸放大字号，保证侧栏场景里可读 */
  private px(base: number): number {
    return Math.round(base * this.fontScale);
  }

  constructor(options: PlanRendererOptions) {
    this.canvas = options.canvas;
    this.onBedClick = options.onBedClick;
    const ctx = this.canvas.getContext('2d');
    if (!ctx)
      throw new Error('Canvas 2D not supported');
    this.ctx = ctx;

    this.canvas.addEventListener('click', this.handleClick);
    this.canvas.addEventListener('mousemove', this.handleMove);
    this.canvas.addEventListener('mouseleave', this.handleLeave);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas.parentElement ?? this.canvas);
    this.resize();
  }

  updateWard(ward: TwinWardEntity) {
    this.ward = ward;
    this.draw();
    this.scheduleAnim();
  }

  setSelectedBed(bed: TwinBedEntity | null) {
    const code = bed?.bedCode ?? null;
    if (code === this.selectedBedCode)
      return;
    this.selectedBedCode = code;
    this.draw();
  }

  private resize() {
    const parent = this.canvas.parentElement;
    if (!parent)
      return;
    const { clientWidth, clientHeight } = parent;
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = clientWidth * this.dpr;
    this.canvas.height = clientHeight * this.dpr;
    this.canvas.style.width = `${clientWidth}px`;
    this.canvas.style.height = `${clientHeight}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.draw();
    this.scheduleAnim();
  }

  private needsAnim(): boolean {
    if (!this.ward)
      return false;
    return this.ward.beds.some((bed) => {
      const state = resolveBedStatus(bed).state;
      return PULSE_STATES.has(state);
    });
  }

  private scheduleAnim() {
    if (this.animId !== null)
      return;
    if (this.needsAnim())
      this.animId = requestAnimationFrame(this.tick);
  }

  private tick = () => {
    this.pulsePhase += 0.05;
    this.draw();
    if (this.needsAnim())
      this.animId = requestAnimationFrame(this.tick);
    else
      this.animId = null;
  };

  private draw() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const ctx = this.ctx;
    this.bedRects = [];

    ctx.clearRect(0, 0, w, h);
    this.fontScale = Math.max(1.22, Math.min(1.7, Math.min(w, h) / 360));
    this.drawBackground(w, h);

    if (!this.ward) {
      this.drawEmptyHint(w, h, '暂无病房数据');
      return;
    }

    const pad = Math.max(12, Math.min(w, h) * 0.018);
    const headerH = Math.min(186, Math.max(this.px(155), h * 0.26));
    const footerH = this.px(34);

    this.drawHeader(pad, pad, w - pad * 2, headerH);
    const roomY = pad + headerH + 10;
    const roomH = h - roomY - pad - footerH;
    const roomX = pad;
    const roomW = w - pad * 2;
    this.drawRoomShell(roomX, roomY, roomW, roomH);
    this.drawBeds(roomX, roomY, roomW, roomH);
    this.drawFooter(pad, h - pad - footerH + 4, w - pad * 2, footerH);
  }

  private drawBackground(w: number, h: number) {
    const ctx = this.ctx;
    const g = ctx.createRadialGradient(w * 0.5, h * 0.35, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
    g.addColorStop(0, '#243447');
    g.addColorStop(0.55, '#1a2533');
    g.addColorStop(1, '#121a24');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(79, 195, 247, 0.04)';
    ctx.lineWidth = 1;
    const step = 28;
    for (let x = 0; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  private drawHeader(x: number, y: number, w: number, h: number) {
    const ctx = this.ctx;
    const ward = this.ward!;
    const stats = getWardBedStats(ward);
    const occRate = stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0;

    let calling = 0;
    let infusing = 0;
    for (const bed of ward.beds) {
      const state = resolveBedStatus(bed).state;
      if (bed.isCalling)
        calling++;
      else if (state === 'infusing')
        infusing++;
    }

    this.fillRoundRect(x, y, w, h, 12, 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.1)');

    ctx.save();
    ctx.beginPath();
    this.roundRectPath(x, y, w, h, 12);
    ctx.clip();
    const accent = ctx.createLinearGradient(x, y, x + w, y);
    accent.addColorStop(0, 'rgba(79,195,247,0.12)');
    accent.addColorStop(1, 'rgba(79,195,247,0)');
    ctx.fillStyle = accent;
    ctx.fillRect(x, y, w, h * 0.5);
    ctx.restore();

    const leftX = x + 14;
    const staffPanelW = Math.min(this.px(184), w * 0.44);
    const leftW = w - staffPanelW - this.px(22);
    const staffPanelX = x + w - staffPanelW - 14;

    ctx.fillStyle = '#f0f4f8';
    ctx.font = `700 ${this.px(20)}px ${FONT}`;
    ctx.fillText(ward.sickroomName, leftX, y + this.px(28));

    ctx.fillStyle = 'rgba(79,195,247,0.25)';
    ctx.font = `700 ${this.px(10)}px ${FONT}`;
    const roomTag = '2.5D';
    const roomTagW = ctx.measureText(roomTag).width + this.px(12);
    const roomTagX = leftX + ctx.measureText(ward.sickroomName).width + this.px(10);
    this.fillRoundRect(roomTagX, y + this.px(14), roomTagW, this.px(18), 6, 'rgba(79,195,247,0.18)', 'rgba(79,195,247,0.35)');
    ctx.fillStyle = '#4fc3f7';
    ctx.fillText(roomTag, roomTagX + this.px(6), y + this.px(27));

    ctx.fillStyle = '#8fa3b8';
    const metaEntries: string[] = [];
    if (ward.sickroomCode)
      metaEntries.push(`编码 ${ward.sickroomCode}`);
    const snIp = [`SN ${ward.deviceCode}`, ward.deviceIp ? `IP ${ward.deviceIp}` : ''].filter(Boolean).join('  ·  ');
    metaEntries.push(snIp);

    const metaBlockY = y + this.px(46);
    const metaBottom = this.drawInfoBlock(
      leftX,
      metaBlockY,
      Math.min(leftW, this.px(220)),
      metaEntries,
      12,
      { text: '#8fa3b8', bg: 'rgba(0,0,0,0.2)', border: 'rgba(255,255,255,0.08)' },
      6,
    );

    const chipY = metaBottom + this.px(8);
    const chipW = this.px(72);
    const chipGap = this.px(8);
    let chipX = leftX;
    this.drawStatChip(chipX, chipY, chipW, `${stats.occupied}/${stats.total}`, '在床', '#81c784');
    chipX += chipW + chipGap;
    this.drawStatChip(chipX, chipY, chipW, `${stats.empty}`, '空床', '#b0bec5');
    chipX += chipW + chipGap;
    if (chipX + chipW < leftX + leftW) {
      this.drawStatChip(chipX, chipY, chipW, `${occRate}%`, '入住率', '#4fc3f7');
      chipX += chipW + chipGap;
    }
    if (calling && chipX + chipW < leftX + leftW)
      this.drawStatChip(chipX, chipY, chipW, `${calling}`, '呼叫', '#e91e63');
    else if (infusing && chipX + chipW < leftX + leftW)
      this.drawStatChip(chipX, chipY, chipW, `${infusing}`, '输液', '#ff9800');

    this.drawHeaderStaffPanel(staffPanelX, y + this.px(8), staffPanelW, h - this.px(34));

    const env = ward.doorEnvData;
    const envY = y + h - this.px(30);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(leftX, envY - this.px(8), leftW, 1);

    if (env) {
      let ex = leftX;
      if (env.temp != null && env.temp !== '')
        ex = this.drawEnvChip(ex, envY, `${env.temp}°C`, '温度');
      if (env.relativeHumid)
        ex = this.drawEnvChip(ex + this.px(6), envY, env.relativeHumid, '湿度');
      if (env.airQuality)
        ex = this.drawEnvChip(ex + this.px(6), envY, env.airQuality, '空气');
      if (env.noiseLevel)
        this.drawEnvChip(ex + this.px(6), envY, env.noiseLevel, '噪音');
    }
  }

  /** 通用信息块：多行条目、条目间留白、自动换行，返回块底部 Y */
  private drawInfoBlock(
    x: number,
    y: number,
    maxW: number,
    entries: string[],
    fontPx: number,
    colors: { text: string; bg: string; border?: string },
    entryGap = 4,
  ): number {
    if (!entries.length)
      return y;

    const ctx = this.ctx;
    const font = this.px(fontPx);
    ctx.font = `600 ${font}px ${FONT}`;
    const lineH = this.relaxedLineHeight(fontPx);
    const padH = this.px(8);
    const padV = this.px(10);
    const innerW = maxW - padH * 2;
    const entryGapPx = this.px(entryGap);

    type Segment = { kind: 'line' | 'gap'; text?: string };
    const segments: Segment[] = [];
    for (let i = 0; i < entries.length; i++) {
      if (i > 0)
        segments.push({ kind: 'gap' });
      for (const line of this.wrapLines(ctx, entries[i], innerW))
        segments.push({ kind: 'line', text: line });
    }

    let contentH = 0;
    for (const seg of segments) {
      if (seg.kind === 'gap')
        contentH += entryGapPx;
      else
        contentH += lineH;
    }
    const blockH = contentH + padV * 2;
    this.fillRoundRect(x, y, maxW, blockH, 6, colors.bg, colors.border ?? 'transparent');

    ctx.save();
    ctx.textBaseline = 'top';
    ctx.fillStyle = colors.text;
    let ty = y + padV;
    for (const seg of segments) {
      if (seg.kind === 'gap') {
        ty += entryGapPx;
        continue;
      }
      ctx.fillText(seg.text!, x + padH, ty);
      ty += lineH;
    }
    ctx.restore();
    return y + blockH;
  }

  /** 入院时间拆成日期 + 时间两行，便于阅读 */
  private formatAdmissionEntries(raw?: string): string[] {
    const trimmed = raw?.trim();
    if (!trimmed)
      return [];
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2)
      return [`入院 ${parts[0]}`, parts.slice(1).join(' ')];
    return [`入院 ${trimmed}`];
  }

  /** 顶栏 / 信息块等需要更松行距的场景 */
  private relaxedLineHeight(fontPx: number, leading = 1.55): number {
    const font = this.px(fontPx);
    return Math.max(font + this.px(6), Math.round(font * leading));
  }

  /** 顶栏医护卡片行高（科主任 / 护士长） */
  private staffPanelLineHeight(fontPx: number): number {
    return this.relaxedLineHeight(fontPx, 1.62);
  }

  /** 顶栏右侧：科主任 + 护士长一行并排 */
  private drawHeaderStaffPanel(x: number, y: number, w: number, h: number) {
    const staff = buildMainStaffList(this.ward!.doorStaff, { primaryOnly: true });
    if (!staff.length)
      return;

    const ctx = this.ctx;
    const cols = staff.length;
    const gap = this.px(8);
    const colW = (w - this.px(20) - gap * (cols - 1)) / cols;
    const rowY = y + this.px(30);
    const roleFont = this.px(12);
    const nameFont = this.px(14);
    const roleRowH = this.staffPanelLineHeight(12);
    const nameRowH = this.staffPanelLineHeight(14);
    const roleNameGap = this.px(14);
    const cellPadTop = this.px(10);
    const cellPadBottom = this.px(6);

    const layout = staff.map((person) => {
      ctx.font = `700 ${nameFont}px ${FONT}`;
      const nameLines = this.wrapLines(ctx, person.name, colW - this.px(16));
      const textBlockH = roleRowH + roleNameGap + nameLines.length * nameRowH;
      const cellH = textBlockH + cellPadTop + cellPadBottom;
      return { person, nameLines, textBlockH, cellH };
    });

    const contentH = layout.reduce((max, item) => Math.max(max, item.cellH), 0);
    const panelH = Math.max(h, rowY - y + contentH + this.px(8));
    this.fillRoundRect(x, y, w, panelH, 10, 'rgba(0,0,0,0.28)', 'rgba(255,255,255,0.1)');

    ctx.fillStyle = '#8fa3b8';
    ctx.font = `600 ${this.px(10)}px ${FONT}`;
    ctx.fillText('医护值班', x + this.px(10), y + this.px(16));

    layout.forEach(({ person, nameLines, textBlockH }, i) => {
      const cx = x + this.px(10) + i * (colW + gap);
      const centerX = cx + colW / 2;
      const accent = person.roleKey === 'deptDirector' ? '#4fc3f7' : '#f48fb1';
      const startY = rowY + cellPadTop + (contentH - textBlockH - cellPadTop - cellPadBottom) / 2;

      this.fillRoundRect(cx, rowY, colW, contentH, 8, 'rgba(0,0,0,0.18)', `${accent}44`);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = accent;
      ctx.font = `700 ${roleFont}px ${FONT}`;
      ctx.fillText(person.role, centerX, startY);

      ctx.fillStyle = '#f0f4f8';
      ctx.font = `700 ${nameFont}px ${FONT}`;
      let ny = startY + roleRowH + roleNameGap;
      for (const line of nameLines) {
        ctx.fillText(line, centerX, ny);
        ny += nameRowH;
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    });
  }

  private drawEnvChip(x: number, y: number, value: string, label: string): number {
    const ctx = this.ctx;
    ctx.font = `600 ${this.px(12)}px ${FONT}`;
    const valW = ctx.measureText(value).width;
    ctx.font = `500 ${this.px(10)}px ${FONT}`;
    const w = Math.max(this.px(56), valW + this.px(28));
    this.fillRoundRect(x, y, w, this.px(28), 8, 'rgba(0,0,0,0.2)', 'rgba(255,255,255,0.08)');
    ctx.fillStyle = '#cfd8dc';
    ctx.font = `700 ${this.px(12)}px ${FONT}`;
    ctx.fillText(value, x + this.px(10), y + this.px(14));
    ctx.fillStyle = '#8fa3b8';
    ctx.font = `500 ${this.px(10)}px ${FONT}`;
    ctx.fillText(label, x + this.px(10), y + this.px(25));
    return x + w;
  }

  private drawStatChip(x: number, y: number, w: number, val: string, label: string, color: string) {
    const ctx = this.ctx;
    const h = this.px(40);
    this.fillRoundRect(x, y, w, h, 8, 'rgba(0,0,0,0.22)', 'rgba(255,255,255,0.08)');
    ctx.fillStyle = color;
    ctx.font = `700 ${this.px(18)}px ${FONT}`;
    ctx.fillText(val, x + this.px(10), y + this.px(20));
    ctx.fillStyle = '#8fa3b8';
    ctx.font = `500 ${this.px(11)}px ${FONT}`;
    ctx.fillText(label, x + this.px(10), y + this.px(34));
  }

  private drawRoomShell(x: number, y: number, w: number, h: number) {
    const ctx = this.ctx;
    const depth = 8;

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    this.fillRoundRect(x + depth, y + depth, w, h, 14, 'rgba(0,0,0,0.35)');

    const wallGrad = ctx.createLinearGradient(x, y, x, y + h);
    wallGrad.addColorStop(0, '#d8dce2');
    wallGrad.addColorStop(1, '#b8bec8');
    this.strokeRoundRect(x, y, w, h, 14, wallGrad, 3);

    const floorX = x + 10;
    const floorY = y + 10;
    const floorW = w - 20;
    const floorH = h - 20;
    const floorGrad = ctx.createLinearGradient(floorX, floorY, floorX + floorW, floorY + floorH);
    floorGrad.addColorStop(0, '#ebe4d8');
    floorGrad.addColorStop(0.5, '#e2dbd0');
    floorGrad.addColorStop(1, '#d8d0c4');
    this.fillRoundRect(floorX, floorY, floorW, floorH, 10, floorGrad);

    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    const tile = 36;
    for (let tx = floorX + tile; tx < floorX + floorW; tx += tile) {
      ctx.beginPath();
      ctx.moveTo(tx, floorY);
      ctx.lineTo(tx, floorY + floorH);
      ctx.stroke();
    }
    for (let ty = floorY + tile; ty < floorY + floorH; ty += tile) {
      ctx.beginPath();
      ctx.moveTo(floorX, ty);
      ctx.lineTo(floorX + floorW, ty);
      ctx.stroke();
    }

    const doorW = Math.min(56, floorW * 0.14);
    const doorX = floorX + (floorW - doorW) / 2;
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(doorX, floorY + floorH - 5, doorW, 5);

    ctx.fillStyle = 'rgba(79,195,247,0.55)';
    ctx.fillRect(floorX + floorW - 48, floorY + 16, 36, 6);
    ctx.fillStyle = 'rgba(135,206,250,0.25)';
    ctx.fillRect(floorX + floorW - 46, floorY + 22, 32, 28);

    ctx.fillStyle = '#8fa3b8';
    ctx.font = `600 ${this.px(12)}px ${FONT}`;
    ctx.fillText('门口', doorX + doorW / 2 - this.px(12), floorY + floorH - this.px(10));
    ctx.fillText('窗', floorX + floorW - this.px(38), floorY + this.px(16));
  }

  private drawBeds(roomX: number, roomY: number, roomW: number, roomH: number) {
    const ward = this.ward!;
    const floorX = roomX + 10;
    const floorY = roomY + 10;
    const floorW = roomW - 20;
    const floorH = roomH - 20;

    const cols = ward.beds.length === 3 ? 3 : ward.beds.length <= 2 ? ward.beds.length : 2;
    const padX = this.px(12);
    const padY = this.px(12);
    const bedW = (floorW - padX * (cols + 1)) / cols;
    const rows = Math.ceil(ward.beds.length / cols);
    const bedH = (floorH - padY * (rows + 1)) / rows;

    ward.beds.forEach((bed, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = floorX + padX + col * (bedW + padX);
      const y = floorY + padY + row * (bedH + padY);
      const isSelected = bed.bedCode === this.selectedBedCode;
      const isHovered = bed.bedCode === this.hoveredBedCode;
      this.drawBed2_5D(bed, x, y, bedW, bedH, isSelected, isHovered);
      this.bedRects.push({ bed, x, y, w: bedW, h: bedH });
    });
  }

  /** 按宽度自动换行，尽量展示完整内容 */
  private cleanCareField(label: string, raw?: string): string | null {
    const trimmed = raw?.trim();
    if (!trimmed)
      return null;
    let value = trimmed;
    while (value.startsWith(label))
      value = value.slice(label.length);
    value = value.trim();
    if (!value)
      return null;
    return `${label}${value}`;
  }

  /** 按宽度自动换行，尽量展示完整内容 */
  private wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines = 48): string[] {
    if (!text)
      return [];
    const lines: string[] = [];
    let rest = text;
    while (rest.length > 0 && lines.length < maxLines) {
      if (ctx.measureText(rest).width <= maxW) {
        lines.push(rest);
        break;
      }
      let cut = rest.length;
      while (cut > 1 && ctx.measureText(rest.slice(0, cut)).width > maxW)
        cut--;
      if (cut <= 0)
        cut = 1;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    return lines;
  }

  /** 绘制多行文本，返回绘制后的 Y */
  private drawTextBlock(
    x: number,
    startY: number,
    maxW: number,
    bottomY: number,
    lineH: number,
    text: string,
  ): number {
    const ctx = this.ctx;
    let cy = startY;
    for (const line of this.wrapLines(ctx, text, maxW)) {
      if (cy + lineH > bottomY)
        break;
      ctx.fillText(line, x, cy);
      cy += lineH;
    }
    return cy;
  }

  /** 文本行高：按字号比例计算，多行换行时紧凑可读 */
  private rowHeight(fontPx: number): number {
    const font = this.px(fontPx);
    const leading = fontPx >= 16 ? 1.34 : fontPx >= 13 ? 1.36 : 1.4;
    return Math.max(font + this.px(3), Math.round(font * leading));
  }

  private drawBed2_5D(
    bed: TwinBedEntity,
    x: number,
    y: number,
    w: number,
    h: number,
    isSelected: boolean,
    isHovered: boolean,
  ) {
    const ctx = this.ctx;
    const status = resolveBedStatus(bed);
    const depth = Math.min(8, w * 0.04);
    const pulse = PULSE_STATES.has(status.state)
      ? 0.5 + Math.sin(this.pulsePhase) * 0.5
      : 0;
    const footerReserve = this.px(28);
    const accentW = this.px(5);
    const pad = this.px(10);
    const textX = x + accentW + pad;
    const innerRight = x + w - pad;
    const maxTextW = innerRight - textX;
    const contentBottom = y + h - footerReserve;

    if (pulse > 0) {
      ctx.save();
      ctx.shadowColor = status.color;
      ctx.shadowBlur = 10 + pulse * 14;
      this.fillRoundRect(x - 2, y - 2, w + depth + 4, h + depth + 4, 12, `${status.color}${Math.round(pulse * 60).toString(16).padStart(2, '0')}`);
      ctx.restore();
    }

    this.fillRoundRect(x + depth, y + depth, w, h, 10, 'rgba(0,0,0,0.18)');

    const bodyGrad = ctx.createLinearGradient(x, y, x, y + h);
    bodyGrad.addColorStop(0, bed.isOccupied ? '#faf8f5' : '#f2f2f2');
    bodyGrad.addColorStop(1, bed.isOccupied ? '#ece6dc' : '#e0e0e0');
    this.fillRoundRect(x, y, w, h, 10, bodyGrad, isSelected ? '#4fc3f7' : isHovered ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.12)', isSelected ? 2 : 1);

    ctx.fillStyle = status.color;
    this.fillRoundRect(x, y + this.px(8), accentW, h - this.px(16), 2);

    const statusBadgeH = this.px(22);
    const occupied = bed.isOccupied && !!bed.sickInfo?.sickName?.trim();
    const displayStatus = occupied ? status : { ...status, label: '空床', color: '#9e9e9e' };
    const statusBadgeW = this.measureBadge(displayStatus.label) + this.px(16);
    const badgeX = x + w - statusBadgeW - pad;
    this.drawStatusBadge(badgeX, y + pad, statusBadgeW, statusBadgeH, displayStatus.label, displayStatus.color, occupied ? pulse : 0);

    let cy = y + this.px(28);
    const nameMaxW = badgeX - textX - this.px(4);

    ctx.fillStyle = '#263238';
    ctx.font = `700 ${this.px(16)}px ${FONT}`;
    cy = this.drawTextBlock(textX, cy, Math.max(nameMaxW, maxTextW), contentBottom, this.rowHeight(16), bed.bedName);
    cy += this.px(5);

    if (occupied && bed.sickInfo) {
      const info = bed.sickInfo;

      ctx.fillStyle = '#1a237e';
      ctx.font = `700 ${this.px(15)}px ${FONT}`;
      cy = this.drawPatientNameRow(
        textX,
        cy,
        innerRight,
        maxTextW,
        contentBottom,
        displayPatientName(info.sickName, true),
        bed.nursingLevel,
        bed.nursingColor,
      );
      cy += this.px(5);

      const metaEntries: string[] = [];
      const demo = [info.sickSex, info.sickAge ? `${info.sickAge}岁` : '', info.sickNo ? `No.${info.sickNo}` : ''].filter(Boolean).join(' · ');
      if (demo)
        metaEntries.push(demo);
      metaEntries.push(...this.formatAdmissionEntries(info.sickInTime));

      cy = this.drawInfoBlock(
        textX - this.px(4),
        cy,
        maxTextW + this.px(8),
        metaEntries,
        12,
        { text: '#546e7a', bg: 'rgba(0,0,0,0.045)', border: 'rgba(0,0,0,0.06)' },
        8,
      );
      cy += this.px(6);

      ctx.save();
      ctx.beginPath();
      ctx.rect(x + accentW, cy, w - accentW - this.px(2), contentBottom - cy);
      ctx.clip();

      if (info.visitDoctorName || info.dutyNurseName) {
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.beginPath();
        ctx.moveTo(textX, cy);
        ctx.lineTo(innerRight, cy);
        ctx.stroke();
        cy += this.px(10);

        const staffRow = this.relaxedLineHeight(12);
        if (info.visitDoctorName)
          cy = this.drawLabeledLine(textX, cy, '主治医生', info.visitDoctorName, maxTextW, staffRow, contentBottom, true);
        if (info.dutyNurseName)
          cy = this.drawLabeledLine(textX, cy, '责任护士', info.dutyNurseName, maxTextW, staffRow, contentBottom, true);
      }

      const careRow = this.relaxedLineHeight(12);
      for (const note of [this.cleanCareField('饮食', info.sickDiet), this.cleanCareField('隔离', info.sickIsolation)]) {
        if (!note)
          continue;
        cy = this.drawLabeledLine(textX, cy, note.slice(0, 2), note.slice(2), maxTextW, careRow, contentBottom, true);
      }

      if (info.sickAllergy?.trim()) {
        cy += this.px(6);
        ctx.fillStyle = '#c62828';
        ctx.font = `700 ${this.px(12)}px ${FONT}`;
        cy = this.drawTextBlock(textX, cy, maxTextW, contentBottom, careRow, `⚠ 过敏 ${info.sickAllergy.trim()}`);
      }
      if (info.sickSafetyPrecautions?.trim()) {
        cy += this.px(6);
        ctx.fillStyle = '#ef6c00';
        ctx.font = `600 ${this.px(12)}px ${FONT}`;
        cy = this.drawTextBlock(textX, cy, maxTextW, contentBottom, careRow, `⚠ ${info.sickSafetyPrecautions.trim()}`);
      }

      ctx.restore();
    }
    else {
      ctx.fillStyle = '#90a4ae';
      ctx.font = `700 ${this.px(15)}px ${FONT}`;
      ctx.fillText('空床', textX, cy);
      cy += this.rowHeight(15);
      ctx.fillStyle = '#b0bec5';
      ctx.font = `600 ${this.px(13)}px ${FONT}`;
      ctx.fillText('待入住', textX, cy);
    }

    const footerY = y + h - this.px(12);
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(x + pad, footerY - this.px(16), w - pad * 2, 1);

    ctx.fillStyle = '#78909c';
    ctx.font = `600 ${this.px(10)}px ${FONT}`;
    ctx.fillText(`SN ${bed.deviceCode}`, textX, footerY);

    const statusText = bed.isCalling
      ? '● 呼叫中'
      : status.state === 'infusing'
        ? '● 输液中'
        : (status.state === 'offline' || status.state === 'lowBattery')
            ? `● ${status.label}`
            : '';
    if (statusText) {
      ctx.fillStyle = bed.isCalling ? '#e91e63' : status.state === 'infusing' ? '#ff9800' : status.color;
      ctx.font = `700 ${this.px(10)}px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText(statusText, innerRight, footerY);
      ctx.textAlign = 'left';
    }
  }

  /** 患者姓名 + 右侧护理级别徽章（同一行，姓名可换行） */
  private drawPatientNameRow(
    textX: number,
    startY: number,
    innerRight: number,
    maxTextW: number,
    contentBottom: number,
    patientName: string,
    nursingLevel?: string,
    nursingColor?: string,
  ): number {
    const ctx = this.ctx;
    const nameFont = 15;
    const rowH = this.rowHeight(nameFont);
    const level = nursingLevel?.trim();
    const badgeGap = this.px(6);

    let badgeW = 0;
    let badgeH = 0;
    let badgeLabel = '';
    if (level) {
      const measured = this.measureNursingBadge(level, Math.min(this.px(96), maxTextW * 0.42));
      badgeW = measured.w;
      badgeH = measured.h;
      badgeLabel = measured.label;
    }

    const nameMaxW = badgeW > 0 ? Math.max(this.px(48), maxTextW - badgeW - badgeGap) : maxTextW;

    ctx.fillStyle = '#1a237e';
    ctx.font = `700 ${this.px(nameFont)}px ${FONT}`;
    const endY = this.drawTextBlock(textX, startY, nameMaxW, contentBottom, rowH, patientName);

    if (level && badgeW > 0) {
      const badgeX = innerRight - badgeW;
      const badgeY = startY - this.px(12);
      const bg = nursingColor ?? '#ffb74d';
      this.fillRoundRect(badgeX, badgeY, badgeW, badgeH, 6, bg, 'rgba(0,0,0,0.08)');
      ctx.fillStyle = '#fff';
      ctx.font = `700 ${this.px(10)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeLabel, badgeX + badgeW / 2, badgeY + badgeH / 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    return endY;
  }

  private measureNursingBadge(text: string, maxW: number): { w: number; h: number; label: string } {
    const ctx = this.ctx;
    const h = this.px(20);
    ctx.font = `700 ${this.px(10)}px ${FONT}`;
    let label = text;
    if (ctx.measureText(label).width + this.px(12) > maxW) {
      while (label.length > 1 && ctx.measureText(`${label}…`).width + this.px(12) > maxW)
        label = label.slice(0, -1);
      label = `${label}…`;
    }
    const w = Math.min(maxW, ctx.measureText(label).width + this.px(12));
    return { w, h, label };
  }

  /** 去掉姓名里重复的角色前缀 */
  private stripRolePrefix(name: string, label: string): string {
    let value = name.trim();
    const prefixes = [label];
    if (label === '主治医生')
      prefixes.push('主治');
    if (label === '责任护士')
      prefixes.push('责护');
    let changed = true;
    while (changed) {
      changed = false;
      for (const prefix of prefixes) {
        if (value.startsWith(prefix)) {
          value = value.slice(prefix.length).trim();
          changed = true;
        }
      }
    }
    return value;
  }

  /** 标签 + 内容分行绘制，避免与上方徽章重叠 */
  private drawLabeledLine(
    x: number,
    y: number,
    label: string,
    value: string,
    maxW: number,
    lineH: number,
    bottomY = Number.POSITIVE_INFINITY,
    trailingGap = false,
  ): number {
    const ctx = this.ctx;
    const cleanValue = this.stripRolePrefix(value, label);
    const labelText = `${label} `;
    ctx.font = `600 ${this.px(12)}px ${FONT}`;
    const labelW = ctx.measureText(labelText).width;
    const valueLines = this.wrapLines(ctx, cleanValue, maxW - labelW - this.px(4));
    let cy = y;
    let drawn = 0;

    for (let i = 0; i < valueLines.length; i++) {
      if (cy + lineH > bottomY)
        break;
      if (i === 0) {
        ctx.fillStyle = '#78909c';
        ctx.fillText(labelText, x, cy);
        ctx.fillStyle = '#37474f';
        ctx.fillText(valueLines[i], x + labelW, cy);
      }
      else {
        ctx.fillStyle = '#37474f';
        ctx.fillText(valueLines[i], x + labelW, cy);
      }
      cy += lineH;
      drawn++;
    }
    if (drawn > 0 && trailingGap)
      cy += this.px(4);
    return cy;
  }

  private drawStatusBadge(x: number, y: number, w: number, h: number, label: string, color: string, pulse: number) {
    const alpha = pulse > 0 ? 0.25 + pulse * 0.35 : 0.22;
    this.fillRoundRect(x, y, w, h, 9, `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`, `${color}88`);
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.font = `700 ${this.px(11)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, y + h - this.px(7));
    ctx.textAlign = 'left';
  }

  private measureBadge(text: string): number {
    this.ctx.font = `700 ${this.px(11)}px ${FONT}`;
    return this.ctx.measureText(text).width;
  }

  private drawFooter(x: number, y: number, w: number, _h: number) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(143,163,184,0.85)';
    ctx.font = `600 ${this.px(13)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('点击床位查看详情  ·  异常态（呼叫 / 输液）会闪烁高亮', x + w / 2, y + this.px(14));
    ctx.textAlign = 'left';
  }

  private drawEmptyHint(w: number, h: number, text: string) {
    const ctx = this.ctx;
    ctx.fillStyle = '#8fa3b8';
    ctx.font = `600 ${this.px(16)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(text, w / 2, h / 2);
    ctx.textAlign = 'left';
  }

  private roundRectPath(x: number, y: number, w: number, h: number, r: number) {
    const ctx = this.ctx;
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
  }

  private fillRoundRect(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill?: string | CanvasGradient,
    stroke?: string,
    lineWidth = 1,
  ) {
    const ctx = this.ctx;
    this.roundRectPath(x, y, w, h, r);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  private strokeRoundRect(x: number, y: number, w: number, h: number, r: number, stroke: string | CanvasGradient, lineWidth = 1) {
    const ctx = this.ctx;
    this.roundRectPath(x, y, w, h, r);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  private handleClick = (e: MouseEvent) => {
    const hit = this.hitTest(e);
    if (hit)
      this.onBedClick?.(hit.bed);
  };

  private handleMove = (e: MouseEvent) => {
    const hit = this.hitTest(e);
    const code = hit?.bed.bedCode ?? null;
    if (code !== this.hoveredBedCode) {
      this.hoveredBedCode = code;
      this.canvas.style.cursor = hit ? 'pointer' : 'default';
      this.draw();
    }
  };

  private handleLeave = () => {
    if (this.hoveredBedCode) {
      this.hoveredBedCode = null;
      this.canvas.style.cursor = 'default';
      this.draw();
    }
  };

  private hitTest(e: MouseEvent): BedRect | undefined {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return this.bedRects.find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  }

  dispose() {
    if (this.animId !== null)
      cancelAnimationFrame(this.animId);
    this.resizeObserver?.disconnect();
    this.canvas.removeEventListener('click', this.handleClick);
    this.canvas.removeEventListener('mousemove', this.handleMove);
    this.canvas.removeEventListener('mouseleave', this.handleLeave);
  }
}
