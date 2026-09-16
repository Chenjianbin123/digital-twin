import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { reactive, toRaw } from 'vue';
import { wardBedPatientKey } from '../src/core/ward-data-binding.ts';
import { stripTypeScriptTypes } from 'node:module';
import { applyBedDeviceInfoToTwinBed, isBedDeviceResponseApplicable, shouldWarnForMissingBedDevice } from '../src/core/bed-device-mapping.ts';
let serial = 0;
async function loader(query) {
  const key='__bedRequestTest'+serial++;
  globalThis[key]={queryBedDeviceInfo:query,toRaw,wardBedPatientKey,applyBedDeviceInfoToTwinBed,isBedDeviceResponseApplicable,shouldWarnForMissingBedDevice,loadParsedTemplate:async()=>({})};
  const source=stripTypeScriptTypes(fs.readFileSync(new URL('../src/services/bed-device-loader.ts',import.meta.url),'utf8')).replace(/import[\s\S]*?from\s+['"][^'"]+['"];\s*/g,'');
  const code=`const {queryBedDeviceInfo,toRaw,wardBedPatientKey,applyBedDeviceInfoToTwinBed,isBedDeviceResponseApplicable,shouldWarnForMissingBedDevice,loadParsedTemplate}=globalThis.${key};\n`+source;
  try{return await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));}finally{delete globalThis[key];}
}
const bed=(id='1')=>({bedCode:id,bedName:id,deviceCode:'SN'+id,position:{x:0,z:0},isOccupied:true,isOnline:true});
const response=(deviceCode='SN1',patient='A')=>({bedDeviceInfoVo:{deviceCode,bedCode:deviceCode.slice(2),templateId:1,isOnline:'1'},bedSickInfoVo:{sickNo:patient,sickName:'测试'+patient}});

test('area load followed by current-room and view refresh reuses applied snapshots',async()=>{
 const calls=[];const m=await loader(async id=>{calls.push(id);return response(id)});const beds=[bed('1'),bed('2'),bed('3')];
 await m.loadBedDeviceDetails(beds,()=>true,{forceRefresh:true});
 await m.loadBedDeviceDetails(reactive(beds).slice(0,2));await m.loadBedDeviceDetails(reactive(beds).slice(0,2));
 assert.deepEqual(calls,['SN1','SN2','SN3']);
 await m.loadBedDeviceDetails(beds.slice(0,2),()=>true,{forceRefresh:true});assert.equal(calls.length,5);
});
test('concurrent forced requests share network work but not mutable response objects',async()=>{
 let complete,calls=0;const m=await loader(()=>{calls++;return new Promise(r=>complete=r)});const a=bed(),b=bed();
 const first=m.loadBedDeviceDetails([a],()=>true,{forceRefresh:true}),second=m.loadBedDeviceDetails([b],()=>true,{forceRefresh:true});
 assert.equal(calls,1);complete(response());await Promise.all([first,second]);a.sickInfo.sickName='changed';assert.notEqual(b.sickInfo.sickName,'changed');
});
test('changed patient, new room snapshot and expired data request fresh information',async()=>{
 let calls=0;const m=await loader(async id=>{calls++;return response(id,'P'+calls)});const a=bed();await m.loadBedDeviceDetails([a]);
 a.sickInfo.sickNo='new-patient';await m.loadBedDeviceDetails([a]);assert.equal(calls,2);
 await m.loadBedDeviceDetails([bed()]);assert.equal(calls,3);
 const now=Date.now;try{Date.now=()=>now()+31_000;await m.loadBedDeviceDetails([a]);assert.equal(calls,4);}finally{Date.now=now;}
});
test('failed force refresh does not leave fresh data or a rejected promise cached',async()=>{
 let calls=0;const m=await loader(async id=>{if(++calls===2)throw Error('offline');return response(id)});const a=bed();await m.loadBedDeviceDetails([a]);
 assert.equal((await m.loadBedDeviceDetails([a],()=>true,{forceRefresh:true})).failed,1);
 await m.loadBedDeviceDetails([a]);assert.equal(calls,3);
});
test('late responses cannot overwrite a changed patient or a cleared session',async()=>{
 const pending=[];const m=await loader(()=>new Promise(r=>pending.push(r)));const a=bed();let request=m.loadBedDeviceDetails([a]);a.sickInfo={sickNo:'B'};pending.shift()(response());await request;assert.equal(a.sickInfo.sickNo,'B');
 request=m.loadBedDeviceDetails([a]);m.clearBedDeviceInfoCache();const b=bed();const next=m.loadBedDeviceDetails([b]);assert.equal(pending.length,2);pending.shift()(response('SN1','OLD'));await request;assert.equal(a.sickInfo.sickNo,'B');pending.shift()(response('SN1','NEW'));await next;assert.equal(b.sickInfo.sickNo,'NEW');
});

test('a new patient does not join the previous patient request on the same device',async()=>{
 const pending=[];const m=await loader(()=>new Promise(r=>pending.push(r)));const a=bed();a.sickInfo={sickNo:'A'};
 const old=m.loadBedDeviceDetails([a]);a.sickInfo={sickNo:'B'};const fresh=m.loadBedDeviceDetails([a]);assert.equal(pending.length,2);
 pending[0](response('SN1','A'));await old;assert.equal(a.sickInfo.sickNo,'B');pending[1](response('SN1','B'));await fresh;assert.equal(a.sickInfo.sickNo,'B');
});
