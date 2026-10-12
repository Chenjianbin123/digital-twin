import assert from 'node:assert/strict';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { createServer } from 'vite';

const storage = new Map();
globalThis.window = { setTimeout, clearTimeout, localStorage: {
  getItem:key=>storage.get(key)??null, setItem:(key,value)=>storage.set(key,value), removeItem:key=>storage.delete(key),
} };
const records = { call: [], alarm: [] }, requests = [];
let failProcessed = false, delayNext = false, release;
// This backend is wholly in-memory. Every unexpected request fails closed; no hospital writes or network traffic.
globalThis.fetch = async (url, options) => {
  const source = String(url).includes('querySwpCallInfo') ? 'call' : String(url).includes('querySwpAlarmInfo') ? 'alarm' : null;
  assert.ok(source, `unexpected API request: ${new URL(String(url),'http://local').pathname}`);
  const query = JSON.parse(options.body);
  requests.push({source,...query});
  assert.equal(query.pageSize,200);
  assert.ok(['0','1'].includes(query.eventStatus));
  if (delayNext) { delayNext=false; await new Promise(resolve=>{release=resolve;}); }
  if (failProcessed && query.eventStatus === '1') throw Error('synthetic reconciliation failure');
  const filtered = records[source].filter(record=>record.areaId===query.areaId && record.eventStatus===query.eventStatus);
  return {ok:true,status:200,json:async()=>({code:200,data:{records:filtered,total:query.eventStatus==='0'?501:filtered.length,current:query.pageNum,size:200,pages:query.eventStatus==='0'?3:1}})};
};
const server = await createServer({server:{middlewareMode:true},appType:'custom'});
let controller;
try {
  const api = await server.ssrLoadModule('/src/api/swp-events.ts');
  const {createSwpEventSnapshotLoader} = await server.ssrLoadModule('/src/core/swp-event-loader.ts');
  const {createSwpEventPollingController} = await server.ssrLoadModule('/src/core/swp-event-polling-controller.ts');
  const {useTwinStore} = await server.ssrLoadModule('/src/stores/twin-store.ts');
  const {buildNurseStationViewModel} = await server.ssrLoadModule('/src/core/nurse-station-view-model.ts');
  const {summarizeArea} = await server.ssrLoadModule('/src/core/area-summary.ts');
  setActivePinia(createPinia());
  const store = useTwinStore();
  store.selectedAreaId=8;
  store.area={areaName:'合成病区8',areaCode:'T8',deptName:'测试',rooms:[{sickroomId:'81',sickroomCode:'R81',sickroomName:'合成房',beds:[{bedCode:'B81',bedName:'1床',isOccupied:false,isOnline:true,deviceCode:'D81',position:{x:0,z:0}}]}]};
  const vm=()=>buildNurseStationViewModel({areaId:store.selectedAreaId,area:store.area,roomSummaries:summarizeArea(store.area.rooms),alertTasks:store.alertTasks,swpEvents:store.swpEvents,swpEventSync:store.swpEventSync});
  const load=createSwpEventSnapshotLoader({fetchCalls:api.fetchActiveSwpCalls,fetchAlarms:api.fetchActiveSwpAlarms,fetchProcessedCalls:api.fetchProcessedSwpCalls,fetchProcessedAlarms:api.fetchProcessedSwpAlarms});
  controller=createSwpEventPollingController({loadSnapshot:load,schedule:()=>1,cancelSchedule:()=>{},visibility:{isVisible:()=>true,subscribe:()=>()=>{}}});
  await controller.start(store);
  assert.equal(store.swpEvents.length,0);
  const call={id:101,areaId:8,sickroomId:81,bedCode:'B81',eventStatus:'0',callStartTime:'2026-09-30 09:00:00'};
  records.call.push(call);
  const names=['低电量报警','输液即将完成','输液完成','输液事件结束','异常离线报警','滴速过慢','滴速过快'];
  [9,301,302,303,304,305,306].forEach((alarmType,index)=>records.alarm.push({id:200+index,areaId:8,sickroomId:81,bedCode:'B81',eventStatus:'0',alarmType,alarmStartTime:'2026-09-30 09:00:00'}));
  await controller.refreshNow(); await nextTick();
  assert.equal(store.swpEvents.length,8);
  assert.equal(vm().alertTasks.filter(task=>task.source==='swp-call').length,1);
  assert.equal(store.swpEvents[0].location.roomCode,'R81');
  assert.equal(store.swpEvents[0].location.bedCode,'B81');
  assert.deepEqual(new Set(store.swpEvents.filter(event=>event.source==='swp-alarm').map(event=>event.title)),new Set(names));
  const callId=store.swpEvents.find(event=>event.source==='swp-call').id;
  const beforeAckRequests=requests.length;
  store.markAlertHandling(callId); await nextTick();
  assert.equal(requests.length,beforeAckRequests,'local confirmation must not send a backend processing request');
  assert.ok(store.swpEvents.some(event=>event.id===callId));
  assert.equal(call.eventStatus,'0');
  call.eventStatus='1'; records.alarm.forEach(record=>record.eventStatus='1');
  failProcessed=true;
  await controller.refreshNow(); await nextTick();
  assert.equal(store.swpEvents.length,8,'failed reconciliation must retain last known occurrences');
  assert.ok(store.swpEvents.every(event=>event.retained));
  failProcessed=false;
  await controller.refreshNow(); await nextTick();
  assert.equal(store.swpEvents.length,0);
  assert.equal(vm().alertTasks.filter(task=>task.source?.startsWith('swp-')).length,0);
  assert.equal(store.alertAckRecords[callId],undefined,'processed occurrence must clear its local acknowledgement');
  // Reused source IDs with new start times are new occurrences, not already processed events.
  records.call.push({...call,eventStatus:'0',callStartTime:'2026-09-30 10:00:00'});
  await controller.refreshNow();
  assert.equal(store.swpEvents.length,1);
  assert.notEqual(store.swpEvents[0].id,callId);
  delayNext=true;
  const oldResponse=controller.refreshNow();
  while(!release) await new Promise(resolve=>setTimeout(resolve,0));
  store.selectedAreaId=9; store.swpEvents=[];
  release(); await oldResponse;
  assert.equal(store.swpEvents.length,0,'old ward response must not contaminate the new ward');
  controller.stop();
  // A successful query can still be partial after the store enforces its retention limit.
  const cappedEvents = Array.from({length:2001}, (_, index) => ({
    id:`synthetic-cap-${index}`,source:'swp-alarm',areaId:9,taskType:'infusion',severity:'high',
    startedAt:'2026-09-30 10:00:00',timestampMs:index+1,title:'合成上限事件',description:'测试',
    location:null,locationStatus:'missing-identifiers',locationLabel:'合成病区9',
  }));
  controller=createSwpEventPollingController({
    loadSnapshot:async()=>({events:cappedEvents,refreshedSources:['swp-call','swp-alarm']}),
    schedule:()=>1,cancelSchedule:()=>{},visibility:{isVisible:()=>true,subscribe:()=>()=>{}},
  });
  await controller.start(store);
  assert.equal(store.swpEvents.length,2000);
  assert.equal(store.swpEventSync.phase,'partial');
  assert.match(store.swpEventSync.warning,/2000 条上限/);
  assert.equal((await controller.refreshDetailed(9)).status,'partial','manual refresh must report the applied store limitation');
  controller.stop();
  console.log('Closure passed: real API adapters -> status-filtered synthetic backend -> polling -> store -> view model, seven names, exact location, local ack, failure preservation, processed removal, recurrence and ward isolation.');
}
finally { controller?.stop(); await server.close(); }
