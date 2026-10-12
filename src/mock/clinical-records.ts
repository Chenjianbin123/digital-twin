import { MOCK_DOOR_DEVICE_LIST } from './door-device-list.ts';
import { readSwpRecordPage } from '../core/swp-page-coverage.ts';
import type { SwpAlarmRecord, SwpCallRecord, SwpResponseTimelinessRecord } from '../types/swp-events.ts';
import type { SwpInspectionRecord } from '../types/inspection.ts';

const startedAt = new Date(Date.now() - 120_000).toISOString();

function locations(areaId: number) {
  return MOCK_DOOR_DEVICE_LIST.data.filter(room => room.doorDeviceInfo.areaId === areaId)
    .map(room => ({
      areaId,
      sickroomId: room.doorDeviceInfo.sickroomId,
      sickroomCode: room.doorDeviceInfo.sickroomCode,
      sickroomName: room.doorDeviceInfo.sickroomName,
      bedCode: room.bedDeviceList[0]?.bedCode,
      bedName: room.bedDeviceList[0]?.bedName,
      deviceCode: room.bedDeviceList[0]?.deviceCode,
    }));
}

export function mockCalls(areaId: number): SwpCallRecord[] {
  return locations(areaId).slice(0, 2).map((location, index) => ({
    areaId, sickroomCode: location.sickroomCode, bedCode: location.bedCode, deviceCode: location.deviceCode,
    id: `mock-call-${index}`, eventStatus: '0',
    callStartTime: startedAt, callModeName: '普通呼叫', callMessage: '患者呼叫',
  }));
}

export function mockAlarms(areaId: number): SwpAlarmRecord[] {
  return locations(areaId).slice(2, 3).map(location => ({
    areaId, sickroomCode: location.sickroomCode, bedCode: location.bedCode, deviceCode: location.deviceCode,
    id: 'mock-infusion-1', eventStatus: '0',
    alarmStartTime: startedAt, alarmType: '输液报警', deviceType: '输液设备',
  }));
}

export function mockResponses(areaId: number): SwpResponseTimelinessRecord[] {
  return locations(areaId).slice(0, 4).map((location, index) => ({
    ...location, id: `mock-response-${index}`, callStartTime: startedAt,
    callModeName: '普通呼叫', swpUwbTimeOfArrivalVoList: [{
      timeOfArrival: new Date(Date.parse(startedAt) + (30 + index * 15) * 1000).toISOString(),
      efficiencyOfResponse: 30 + index * 15, personnelOnArrival: '责任护士',
    }],
  }));
}

export function mockInspections(areaId: number): SwpInspectionRecord[] {
  return locations(areaId).map((location, index) => ({
    ...location, id: `mock-inspection-${index}`, doorUserRealname: '责任护士',
    swipeState: index === 2 ? '巡视超时' : index === 1 ? '待巡视' : '已巡视',
    swipeTime: startedAt, intervalSwipeDuration: 30,
  }));
}

export function mockPage<T>(records: T[], pageNum = 1, pageSize = 200) {
  return readSwpRecordPage({
    records: structuredClone(records.slice((pageNum - 1) * pageSize, pageNum * pageSize)),
    total: records.length, pageNum, pageSize, pages: Math.max(1, Math.ceil(records.length / pageSize)),
  });
}
