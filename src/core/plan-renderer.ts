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

    const pad = Math.max(16, Math.min(w, h) * 0.018);
    const topChromeReserve = Math.max(this.px(104), Math.min(h * 0.16, this.px(138)));
    const bottomNavReserve = Math.max(this.px(106), Math.min(h * 0.14, this.px(132)));
    const headerH = this.px(74);
    const abnormalBeds = this.getAbnormalBeds(this.ward.beds);
    const abnormalH = abnormalBeds.length ? this.px(34) : 0;

    this.drawHeader(pad, topChromeReserve, w - pad * 2, headerH);
    if (abnormalBeds.length)
      this.drawAbnormalSummary(pad, topChromeReserve + headerH + this.px(8), w - pad * 2, abnormalH, abnormalBeds);
    const roomY = topChromeReserve + headerH + this.px(14) + abnormalH;
    const roomH = h - roomY - bottomNavReserve;
    const roomX = pad;
    const roomW = w - pad * 2;
    this.drawRoomShell(roomX, roomY, roomW, roomH);
    this.drawBeds(roomX, roomY, roomW, roomH);
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

    const panelGrad = ctx.createLinearGradient(x, y, x + w, y + h);
    panelGrad.addColorStop(0, 'rgba(10,34,52,0.74)');
    panelGrad.addColorStop(1, 'rgba(6,18,32,0.42)');
    this.fillRoundRect(x, y, w, h, 14, panelGrad, 'rgba(83,213,255,0.24)');

    ctx.save();
    ctx.beginPath();
    this.roundRectPath(x, y, w, h, 14);
    ctx.clip();
    const glow = ctx.createLinearGradient(x, y, x + w, y);
    glow.addColorStop(0, 'rgba(83,213,255,0.16)');
    glow.addColorStop(0.42, 'rgba(83,213,255,0.04)');
    glow.addColorStop(1, 'rgba(255,128,171,0.08)');
    ctx.fillStyle = glow;
    ctx.fillRect(x, y, w, h);
    ctx.restore();

    const leftX = x + this.px(18);
    const centerY = y + h / 2;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f3fbff';
    ctx.font = `800 ${this.px(22)}px ${FONT}`;
    ctx.fillText(ward.sickroomName, leftX, centerY - this.px(10));

    this.drawHeaderStaffSummary(leftX, centerY + this.px(17), w * 0.48);

    const chipH = this.px(50);
    const chipY = y + (h - chipH) / 2;
    const chipW = this.px(84);
    const chipGap = this.px(8);
    const chips: Array<[string, string, string]> = [
      [`${stats.occupied}/${stats.total}`, '在床', '#73e0a9'],
      [`${stats.empty}`, '空床', '#b8c7d4'],
      [`${occRate}%`, '入住率', '#53d5ff'],
    ];
    if (calling)
      chips.push([`${calling}`, '呼叫', '#ff5c8a']);
    else if (infusing)
      chips.push([`${infusing}`, '输液', '#ffb74d']);

    let chipX = x + w - chipW * chips.length - chipGap * (chips.length - 1) - this.px(18);
    for (const [value, label, color] of chips) {
      this.drawHeaderMetricChip(chipX, chipY, chipW, chipH, value, label, color);
      chipX += chipW + chipGap;
    }

    ctx.textBaseline = 'alphabetic';
  }

  private drawHeaderStaffSummary(x: number, y: number, maxW: number) {
    const ctx = this.ctx;
    const staff = buildMainStaffList(this.ward?.doorStaff, { primaryOnly: true });
    const summary = staff.length
      ? staff.map(item => `${item.role} ${item.name}`).join('   ·   ')
      : '医护信息 暂无';
    ctx.fillStyle = 'rgba(196,221,236,0.78)';
    ctx.font = `700 ${this.px(12)}px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(this.ellipsisText(summary, maxW), x, y);
    ctx.textBaseline = 'alphabetic';
  }

  private drawHeaderMetricChip(x: number, y: number, w: number, h: number, val: string, label: string, color: string) {
    const ctx = this.ctx;
    this.fillRoundRect(x, y, w, h, 9, 'rgba(5,14,28,0.34)', 'rgba(255,255,255,0.08)');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.font = `800 ${this.px(19)}px ${FONT}`;
    ctx.fillText(val, x + w / 2, y + h * 0.4);
    ctx.fillStyle = 'rgba(196,221,236,0.72)';
    ctx.font = `700 ${this.px(11)}px ${FONT}`;
    ctx.fillText(label, x + w / 2, y + h * 0.74);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
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

    this.sortBedsForPlan(ward.beds).forEach((bed, i) => {
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

  private getAbnormalBeds(beds: TwinBedEntity[]): TwinBedEntity[] {
    return beds.filter((bed) => {
      const state = resolveBedStatus(bed).state;
      return PULSE_STATES.has(state);
    });
  }

  private sortBedsForPlan(beds: TwinBedEntity[]): TwinBedEntity[] {
    return [...beds].sort((a, b) => {
      const aAbnormal = this.getAbnormalBeds([a]).length;
      const bAbnormal = this.getAbnormalBeds([b]).length;
      if (aAbnormal !== bAbnormal)
        return bAbnormal - aAbnormal;
      return 0;
    });
  }

  private drawAbnormalSummary(x: number, y: number, w: number, h: number, beds: TwinBedEntity[]) {
    const ctx = this.ctx;
    const firstItems = beds.slice(0, 3).map((bed) => {
      const status = resolveBedStatus(bed);
      return `${bed.bedName} ${status.label}`;
    });
    const more = beds.length > firstItems.length ? `，另 ${beds.length - firstItems.length} 项` : '';
    const text = `异常状态：${firstItems.join('  ·  ')}${more}`;
    this.fillRoundRect(x, y, w, h, 12, 'rgba(255,77,141,0.12)', 'rgba(255,77,141,0.36)');
    ctx.fillStyle = '#ff8db8';
    ctx.font = `800 ${this.px(13)}px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(this.ellipsisText(text, w - this.px(24)), x + this.px(14), y + h / 2);
    ctx.textBaseline = 'alphabetic';
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
    const accentW = this.px(5);
    const pad = this.px(14);
    const textX = x + accentW + pad;
    const innerRight = x + w - pad;
    const maxTextW = innerRight - textX;
    const contentBottom = y + h - this.px(14);

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

    let cy = y + this.px(30);
    const nameMaxW = Math.max(this.px(92), badgeX - textX - this.px(8));

    ctx.fillStyle = '#263238';
    ctx.font = `800 ${this.px(18)}px ${FONT}`;
    cy = this.drawTextBlock(textX, cy, nameMaxW, contentBottom, this.rowHeight(18), bed.bedName);
    cy += this.px(8);

    if (occupied && bed.sickInfo) {
      const info = bed.sickInfo;

      cy = this.drawCompactBedMeta(textX, cy, innerRight, contentBottom, info, bed.nursingLevel, bed.nursingColor);
      cy += this.px(8);

      ctx.save();
      ctx.beginPath();
      ctx.rect(x + accentW, cy, w - accentW - this.px(2), contentBottom - cy);
      ctx.clip();

      cy = this.drawCompactStaffChips(textX, cy, maxTextW, contentBottom, info.visitDoctorName, info.dutyNurseName);

      if (info.sickAllergy?.trim()) {
        cy += this.px(8);
        this.drawWarningPill(textX, cy, Math.min(maxTextW, this.px(210)), `过敏 ${info.sickAllergy.trim()}`, '#f44336');
      }
      else if (info.sickSafetyPrecautions?.trim()) {
        cy += this.px(8);
        this.drawWarningPill(textX, cy, Math.min(maxTextW, this.px(210)), info.sickSafetyPrecautions.trim(), '#ff9800');
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

    const statusText = bed.isCalling
      ? '● 呼叫中'
      : status.state === 'infusing'
        ? '● 输液中'
        : (status.state === 'offline' || status.state === 'lowBattery')
            ? `● ${status.label}`
            : '';
    if (statusText) {
      const footerY = y + h - this.px(14);
      ctx.fillStyle = bed.isCalling ? '#e91e63' : status.state === 'infusing' ? '#ff9800' : status.color;
      ctx.font = `700 ${this.px(10)}px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText(statusText, innerRight, footerY);
      ctx.textAlign = 'left';
    }
  }

  private drawCompactBedMeta(
    x: number,
    y: number,
    innerRight: number,
    bottomY: number,
    info: NonNullable<TwinBedEntity['sickInfo']>,
    nursingLevel?: string,
    nursingColor?: string,
  ): number {
    const ctx = this.ctx;
    const maxW = innerRight - x;
    const patientName = displayPatientName(info.sickName, true);
    const level = nursingLevel?.trim();
    const badgeW = level ? Math.min(this.px(92), this.measureBadge(level) + this.px(20)) : 0;
    const nameW = badgeW > 0 ? maxW - badgeW - this.px(8) : maxW;

    ctx.fillStyle = '#14212b';
    ctx.font = `800 ${this.px(17)}px ${FONT}`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(this.ellipsisText(patientName, nameW), x, y);

    if (level && badgeW > 0)
      this.drawNursingPill(innerRight - badgeW, y - this.px(22), badgeW, level, nursingColor ?? '#9c27b0');

    const meta = [info.sickSex, info.sickAge ? `${info.sickAge}岁` : '', info.sickNo ? `No.${info.sickNo}` : '']
      .filter(Boolean)
      .join(' · ');
    const admissionDate = info.sickInTime?.trim()?.split(/\s+/)[0] ?? '';
    const metaText = [meta, admissionDate ? `入院 ${admissionDate}` : ''].filter(Boolean).join('   ');

    ctx.fillStyle = '#607d8b';
    ctx.font = `700 ${this.px(12)}px ${FONT}`;
    const metaY = y + this.px(25);
    if (metaY < bottomY)
      ctx.fillText(this.ellipsisText(metaText, maxW), x, metaY);

    return metaY + this.px(18);
  }

  private drawCompactStaffChips(
    x: number,
    y: number,
    maxW: number,
    bottomY: number,
    doctor?: string,
    nurse?: string,
  ): number {
    const entries: Array<readonly [string, string, string]> = [];
    if (doctor?.trim())
      entries.push(['医生', this.stripRolePrefix(doctor, '主治医生'), '#4fc3f7']);
    if (nurse?.trim())
      entries.push(['护士', this.stripRolePrefix(nurse, '责任护士'), '#73e0a9']);
    if (!entries.length || y + this.px(26) > bottomY)
      return y;

    let cx = x;
    const gap = this.px(8);
    for (const [label, value, color] of entries) {
      const text = `${label} ${value}`;
      const chipW = Math.min(this.px(148), this.measureTextWidth(text, 12) + this.px(22));
      if (cx + chipW > x + maxW)
        break;
      this.drawSoftPill(cx, y, chipW, this.px(24), this.ellipsisText(text, chipW - this.px(18)), color);
      cx += chipW + gap;
    }
    return y + this.px(30);
  }

  private drawNursingPill(x: number, y: number, w: number, text: string, color: string) {
    this.fillRoundRect(x, y, w, this.px(24), 8, `${color}26`, `${color}99`);
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.font = `800 ${this.px(12)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.ellipsisText(text, w - this.px(12)), x + w / 2, y + this.px(12));
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  private drawSoftPill(x: number, y: number, w: number, h: number, text: string, color: string) {
    this.fillRoundRect(x, y, w, h, h / 2, `${color}18`, `${color}55`);
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.font = `800 ${this.px(12)}px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + this.px(10), y + h / 2);
    ctx.textBaseline = 'alphabetic';
  }

  private drawWarningPill(x: number, y: number, w: number, text: string, color: string) {
    this.drawSoftPill(x, y, w, this.px(24), `⚠ ${this.ellipsisText(text, w - this.px(30))}`, color);
  }

  private measureTextWidth(text: string, fontPx: number): number {
    this.ctx.font = `700 ${this.px(fontPx)}px ${FONT}`;
    return this.ctx.measureText(text).width;
  }

  private ellipsisText(text: string, maxW: number): string {
    const ctx = this.ctx;
    if (!text || ctx.measureText(text).width <= maxW)
      return text;
    let value = text;
    while (value.length > 1 && ctx.measureText(`${value}…`).width > maxW)
      value = value.slice(0, -1);
    return `${value}…`;
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
