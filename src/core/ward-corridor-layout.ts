export interface CorridorRoom {
  sickroomCode: string;
  sickroomName: string;
  sickroomId?: string;
  deviceCode?: string;
}

export interface CorridorRoomBinding {
  roomCode: string;
  doorNode: string;
  deviceNode: string;
}

export interface CorridorSlot {
  slotIndex: number;
  roomIndex: number | null;
  roomCode: string | null;
  label: string;
  interactive: boolean;
  doorNode: string;
  deviceNode: string;
}

export interface CorridorLayoutState {
  mode: 'schematic' | 'physical';
  page: number;
  pageCount: number;
  slots: CorridorSlot[];
  issues: string[];
}

/** Assignments belong to one area instance. Refreshes never move another room into a vacant slot. */
export class WardCorridorLayout {
  private assignments: string[] = [];
  private page = 0;
  private readonly doors: readonly string[];
  private readonly devices: readonly string[];
  private readonly physical?: readonly CorridorRoomBinding[];

  constructor(
    doors: readonly string[], devices: readonly string[], physical?: readonly CorridorRoomBinding[],
  ) {
    if (!doors.length || doors.length !== devices.length) throw new Error('门和门口机数量必须一致且非空');
    this.doors = doors;
    this.devices = devices;
    this.physical = physical;
  }

  resolve(rooms: readonly CorridorRoom[], requestedPage = this.page, focusIndex?: number): CorridorLayoutState {
    const issues: string[] = [];
    const codeCounts = new Map<string, number>();
    for (const room of rooms) {
      const code = room.sickroomCode.trim();
      if (code) codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1);
    }
    for (const [code, count] of codeCounts)
      if (count > 1) issues.push(`病房编号 ${code} 重复，已暂停该房间的模型绑定`);
    const byCode = new Map<string, number[]>();
    rooms.forEach((room, index) => {
      if ((codeCounts.get(room.sickroomCode.trim()) ?? 0) > 1) return;
      const code = this.roomKey(room);
      if (!code) { issues.push('病房缺少可用标识，无法定位到模型'); return; }
      byCode.set(code, [...(byCode.get(code) ?? []), index]);
    });
    const unique = new Map<string, number>();
    for (const [code, indices] of byCode) {
      if (indices.length === 1) unique.set(code, indices[0]!);
      else issues.push('病房标识重复，已暂停相关房间的模型绑定');
    }
    if (this.physical) {
      const roomCounts = new Map<string, number>();
      const doorCounts = new Map<string, number>();
      const deviceCounts = new Map<string, number>();
      for (const item of this.physical) {
        roomCounts.set(item.roomCode, (roomCounts.get(item.roomCode) ?? 0) + 1);
        doorCounts.set(item.doorNode, (doorCounts.get(item.doorNode) ?? 0) + 1);
        deviceCounts.set(item.deviceNode, (deviceCounts.get(item.deviceNode) ?? 0) + 1);
      }
      const valid = this.physical.filter(item => {
        const accepted = !!item.roomCode.trim() && roomCounts.get(item.roomCode) === 1
          && doorCounts.get(item.doorNode) === 1 && deviceCounts.get(item.deviceNode) === 1
          && this.doors.includes(item.doorNode) && this.devices.includes(item.deviceNode);
        if (!accepted) issues.push(`门位配置 ${item.doorNode} 无效或重复，已暂停绑定`);
        return accepted;
      });
      for (const code of unique.keys()) {
        if (!valid.some(item => item.roomCode === code)) issues.push(`病房 ${code} 尚未配置门位，可通过病房列表进入`);
      }
      for (const item of valid) {
        if (!byCode.has(item.roomCode)) issues.push(`已配置病房 ${item.roomCode} 当前没有数据`);
      }
      this.page = 0;
      return {
        mode: 'physical', page: 0, pageCount: 1, issues,
        slots: this.doors.map((doorNode, slotIndex) => {
          const mapping = valid.find(item => item.doorNode === doorNode);
          return this.slot(slotIndex, mapping?.roomCode, mapping?.deviceNode, rooms, unique);
        }),
      };
    }

    const additions = [...unique.keys()].filter(code => !this.assignments.includes(code))
      .sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }));
    this.assignments.push(...additions);
    const pageCount = Math.max(1, Math.ceil(this.assignments.length / this.doors.length));
    const focusedCode = focusIndex === undefined || !rooms[focusIndex] ? undefined : this.roomKey(rooms[focusIndex]!);
    const focusedSlot = focusedCode && unique.has(focusedCode) ? this.assignments.indexOf(focusedCode) : -1;
    this.page = focusedSlot >= 0 ? Math.floor(focusedSlot / this.doors.length)
      : Math.max(0, Math.min(pageCount - 1, Math.trunc(requestedPage) || 0));
    return {
      mode: 'schematic', page: this.page, pageCount, issues,
      slots: this.doors.map((_, slotIndex) => this.slot(slotIndex,
        this.assignments[this.page * this.doors.length + slotIndex], undefined, rooms, unique)),
    };
  }

  private roomKey(room: CorridorRoom): string {
    const code = room.sickroomCode.trim();
    if (this.physical) return code;
    // Remote detail responses may omit roomCode. Never invent one or bind by array order.
    const id = room.sickroomId?.trim();
    const device = room.deviceCode?.trim();
    return id ? JSON.stringify(['id', id]) : device ? JSON.stringify(['device', device])
      : code ? JSON.stringify(['code', code]) : '';
  }

  private slot(index: number, code: string | undefined, device: string | undefined,
    rooms: readonly CorridorRoom[], unique: Map<string, number>): CorridorSlot {
    const roomIndex = code ? unique.get(code) ?? null : null;
    return {
      slotIndex: index, roomIndex,
      roomCode: roomIndex === null ? (this.physical ? code ?? null : null) : rooms[roomIndex]!.sickroomCode.trim() || null,
      label: roomIndex === null ? (code ? '暂无数据' : '未配置') : rooms[roomIndex]!.sickroomName,
      interactive: roomIndex !== null, doorNode: this.doors[index]!, deviceNode: device ?? this.devices[index]!,
    };
  }
}
