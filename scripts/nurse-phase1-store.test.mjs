import assert from 'node:assert/strict';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { createServer } from 'vite';

process.env.VITE_ALERT_ACK_PATH = '/synthetic-phase1-ack';
const storage = new Map();
globalThis.window = {
  setTimeout, clearTimeout,
  localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key,value) => storage.set(key,value), removeItem: key => storage.delete(key) },
};
const response = code => ({ok:true,status:200,json:async () => ({code,message:code === 200 ? 'ok' : '业务拒绝'})});
// All requests in this test are synthetic; never contact the configured hospital backend.
globalThis.fetch = async () => response(500);
const server = await createServer({server:{middlewareMode:true},appType:'custom'});
try {
  const {syncAlertAck} = await server.ssrLoadModule('/src/api/alert-ack.ts');
  await assert.rejects(syncAlertAck({taskId:'test',status:'handling',operator:'合成测试',updatedAt:'2026-09-30',syncState:'pending'}), error => {
    assert.equal(error.kind, 'business');
    assert.equal(error.businessCode, 500);
    assert.doesNotMatch(error.message, /业务拒绝/);
    return true;
  });
  const {useTwinStore} = await server.ssrLoadModule('/src/stores/twin-store.ts');
  setActivePinia(createPinia());
  const store = useTwinStore();
  store.selectedAreaId = 8;
  store.area = {areaName:'合成病区',areaCode:'TEST',deptName:'测试',rooms:[]};
  const association = {received:2,matched:1,unmatched:1,issues:[{roomName:'未匹配房',bedName:'',reason:'病房标识缺失、冲突或未匹配'}]};
  store.applyInspectionSnapshot(8, [], '2026-09-30T10:00:00Z', {received:2,total:2,current:1,size:200,pages:1,complete:true}, association);
  assert.equal(store.inspectionSync.phase,'partial');
  assert.equal(store.inspectionSync.association.unmatched,1);
  assert.match(store.inspectionSync.warning,/无法关联/);
  assert.equal(store.applyInspectionSnapshot(9, [], '2026-09-30T10:00:00Z'),false);
  const partialInspection = {received:1,total:300,current:1,size:200,pages:2,complete:false};
  const previousInspection = {id:'old',roomIndex:0,roomCode:'T',roomName:'测试房',bedCode:'bed',state:'overdue',stateLabel:'巡视超时',occurredAt:'2026-09-30 09:00:00',timestampMs:1};
  store.applyInspectionSnapshot(8, [previousInspection], '2026-09-30T10:00:00Z', partialInspection);
  store.applyInspectionSnapshot(8, [{...previousInspection,id:'new',state:'normal',stateLabel:'已巡视',timestampMs:2}], '2026-09-30T10:01:00Z', partialInspection);
  assert.equal(store.inspectionRecords.length,1,'newer normal inspection must replace old overdue occurrence of the same bed');
  assert.equal(store.inspectionRecords[0].state,'normal');
  const event = {id:'swp:alarm:8:test',source:'swp-alarm',areaId:8,taskType:'infusion',severity:'high',startedAt:'2026-09-30 10:00:00',timestampMs:1,title:'合成事件',description:'测试',location:null,locationStatus:'missing-identifiers',locationLabel:'测试病区'};
  store.applySwpEventSnapshot(8,{events:[event],refreshedSources:['swp-call','swp-alarm']});
  store.applySwpEventSnapshot(8,{events:[],refreshedSources:['swp-call'],warning:'未确认完整'});
  assert.equal(store.swpEvents[0].retained,true);
  assert.equal(store.swpEventSync.phase,'partial');
  assert.equal(store.applySwpEventSnapshot(9,{events:[]}),false);
  store.failSwpEventSync(8,'模拟断网');
  assert.equal(store.swpEvents.length,1);
  assert.equal(store.swpEventSync.phase,'error');
  let resolveResponse;
  let signalStarted;
  const started = new Promise(resolve => { signalStarted=resolve; });
  globalThis.fetch = () => { signalStarted(); return new Promise(resolve => { resolveResponse=resolve; }); };
  store.markAlertHandling(event.id);
  await started;
  store.selectedAreaId = 9;
  const pending = {...store.alertAckRecords[event.id],syncState:'pending'};
  store.alertAckRecords = {[event.id]:pending};
  resolveResponse(response(200));
  await new Promise(resolve => setTimeout(resolve,0));
  assert.notEqual(store.alertAckRecords[event.id]?.syncState,'synced');
  store.selectedAreaId = 8;
  await nextTick();
  store.applySwpEventSnapshot(8,{events:[],refreshedSources:['swp-alarm'],warning:'其他源未确认完整'});
  await nextTick();
  assert.equal(store.statusHistory.some(item => item.label.includes('状态已恢复')),false);
  store.applySwpEventSnapshot(8,{events:[],refreshedSources:['swp-call','swp-alarm']});
  assert.equal(store.swpEvents.length,0);
  console.log('Phase 1 store: business failure, partial preservation, offline, stale success and complete recovery passed.');
}
finally { await server.close(); }
