import assert from 'node:assert/strict';
import {
  collectAlertTasks,
  createAlertAckState,
  findAlertTaskForTarget,
  resolveNextAlertTarget,
  type AlertAckState,
} from '../src/core/alert-workflow.ts';

const area = {
  areaName: '病区一',
  areaCode: 'A001',
  deptName: '普通外科',
  rooms: [
    {
      sickroomName: '11房',
      sickroomCode: 'R001',
      sickroomId: '101',
      deviceCode: 'D001',
      doorEnvData: { temp: '31', relativeHumid: '58', airQuality: '优', noiseLevel: '44' },
      beds: [
        {
          bedCode: 'B001',
          bedName: '1',
          deviceCode: 'BED001',
          position: { x: 0, z: 0 },
          isOccupied: true,
          isOnline: true,
          isCalling: true,
          sickInfo: { sickName: '张三' },
        },
        {
          bedCode: 'B002',
          bedName: '2',
          deviceCode: 'BED002',
          position: { x: 1, z: 0 },
          isOccupied: true,
          isOnline: true,
          statusBarInfo: { status: '300' },
          sickInfo: { sickName: '李四' },
        },
      ],
    },
    {
      sickroomName: '12房',
      sickroomCode: 'R002',
      sickroomId: '102',
      deviceCode: 'D002',
      beds: [
        {
          bedCode: 'B003',
          bedName: '1',
          deviceCode: 'BED003',
          position: { x: 0, z: 0 },
          isOccupied: true,
          isOnline: true,
          statusBarInfo: { status: '304' },
          sickInfo: { sickName: '王五' },
        },
      ],
    },
  ],
};

const tasks = collectAlertTasks(area);

assert.deepEqual(
  tasks.map(task => `${task.severity}:${task.type}:${task.roomName}:${task.bedName ?? '-'}`),
  [
    'critical:call:11房:1',
    'critical:env:11房:-',
    'high:offline:12房:1',
    'medium:infusion:11房:2',
  ],
);

const initialAck: AlertAckState = {};
assert.equal(tasks[0].status, 'pending');
const handling = createAlertAckState(initialAck, tasks[0].id, 'handling');
assert.equal(collectAlertTasks(area, handling)[0].status, 'handling');

const resolved = createAlertAckState(handling, tasks[0].id, 'resolved');
assert.equal(collectAlertTasks(area, resolved).some(task => task.id === tasks[0].id), false);

assert.deepEqual(resolveNextAlertTarget(tasks[0]), {
  sceneType: 'ward-interior',
  roomIndex: 0,
  bedCode: 'B001',
});
assert.deepEqual(resolveNextAlertTarget(tasks[1]), {
  sceneType: 'ward',
  roomIndex: 0,
});

assert.equal(
  findAlertTaskForTarget(tasks, {
    sceneType: 'ward-interior',
    roomIndex: 0,
    bedCode: 'B001',
  })?.id,
  tasks[0].id,
);

assert.equal(
  findAlertTaskForTarget(tasks, {
    sceneType: 'ward-interior',
    roomIndex: 0,
    bedCode: 'B002',
  })?.id,
  tasks[3].id,
);

assert.equal(
  findAlertTaskForTarget(tasks, {
    sceneType: 'ward',
    roomIndex: 0,
  })?.id,
  tasks[1].id,
);

assert.equal(
  findAlertTaskForTarget(tasks, {
    sceneType: 'ward-interior',
    roomIndex: 0,
    bedCode: 'B999',
  }),
  null,
);

assert.equal(
  findAlertTaskForTarget(tasks, {
    sceneType: 'nurse-station',
    roomIndex: -1,
  }),
  null,
);

const namedBedArea = {
  areaName: '病区一',
  areaCode: 'A001',
  deptName: '普通外科',
  rooms: [
    {
      sickroomName: '18',
      sickroomCode: 'R018',
      sickroomId: '118',
      deviceCode: 'D018',
      beds: [
        {
          bedCode: 'B008',
          bedName: '008床',
          deviceCode: 'BED008',
          position: { x: 0, z: 0 },
          isOccupied: true,
          isOnline: true,
          isCalling: true,
          sickInfo: { sickName: '赵六' },
        },
      ],
    },
  ],
};

assert.equal(
  collectAlertTasks(namedBedArea)[0].description,
  '18 008床正在呼叫护士站',
);

const area192Tasks = collectAlertTasks(area, {}, '192');
const area193Tasks = collectAlertTasks(area, {}, '193');
assert.ok(area192Tasks.every(task => task.id.startsWith('area:192:')));
assert.equal(area192Tasks.some(task => area193Tasks.some(other => other.id === task.id)), false);
