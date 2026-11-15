import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
export async function checkMonitoring({request,source,alice,workspace}) {
  const auth=alice.accessToken;
  const code=await request('POST','/devices/enrolments',201,null,{workspaceId:workspace.id,installationId:randomUUID(),platform:'ANDROID'},auth);
  const pair=await request('POST','/devices/enrol',201,null,{token:code.token,name:'Synthetic measurement phone',disclosureVersion:'device-enrolment-v1',accepted:true},auth);
  const id=pair.device.id, path=`/devices/${id}/measurements`;
  const consent=await request('POST',`/devices/${id}/consent`,201,'RegisteredDevice',{disclosureVersion:'monitoring-v2',accepted:true,scopes:['network_usage']},auth);
  const now=new Date().toISOString();
  await request('POST',`/devices/${id}/heartbeat`,201,'DeviceConfiguration',{generation:consent.generation,permissionStatus:'granted',capabilityReport:{schemaVersion:1,workspaceId:workspace.id,deviceId:id,reportedAt:now,capabilities:[{id:'network.mobile_data',status:'supported',reason:'Synthetic test capability',source:'os',checkedAt:now,requiredSetup:[],availableActions:['measure']}]}},pair.deviceToken);
  // Fixture clock: move the consent epoch back so intervals can cross UTC midnight.
  const end=new Date();end.setUTCHours(0,0,0,0);const start=new Date(end.getTime()-3600000);const finish=new Date(end.getTime()+3600000);
  await source.query('UPDATE registered_devices SET "enrolledAt"=$2 WHERE id=$1',[id,new Date(start.getTime()-1000)]);
  await source.query("UPDATE device_events SET \"createdAt\"=$2 WHERE \"deviceId\"=$1 AND kind='consent_granted'",[id,new Date(start.getTime()-1000)]);
  // At the first UTC hour use yesterday's boundary to keep the full fixture in the past.
  if(finish>new Date()){start.setUTCDate(start.getUTCDate()-1);finish.setUTCDate(finish.getUTCDate()-1);await source.query('UPDATE registered_devices SET "enrolledAt"=$2 WHERE id=$1',[id,new Date(start.getTime()-1000)]);await source.query("UPDATE device_events SET \"createdAt\"=$2 WHERE \"deviceId\"=$1 AND kind='consent_granted'",[id,new Date(start.getTime()-1000)]);}
  const event={schemaVersion:1,eventId:randomUUID(),workspaceId:workspace.id,deviceId:id,metric:'mobile_data_bytes',value:101,unit:'bytes',source:{kind:'android',collectorVersion:'synthetic-1'},intervalStart:start.toISOString(),intervalEnd:finish.toISOString(),collectedAt:now,quality:'measured'};
  const batch={schemaVersion:1,batchId:randomUUID(),generation:consent.generation,events:[event],gaps:[]};
  const accepted=await request('POST',path,201,'MeasurementReceipt',batch,pair.deviceToken);assert.equal(accepted.accepted,1);
  const replay=await request('POST',path,201,'MeasurementReceipt',batch,pair.deviceToken);assert.equal(replay.replayed,true);
  await request('POST',path,409,'ApiError',{...batch,events:[{...event,value:102}]},pair.deviceToken);
  const duplicate=await request('POST',path,201,'MeasurementReceipt',{...batch,batchId:randomUUID()},pair.deviceToken);assert.equal(duplicate.duplicates,1);
  await request('POST',path,409,'ApiError',{...batch,batchId:randomUUID(),events:[{...event,eventId:randomUUID()}]},pair.deviceToken);
  await request('POST',path,403,'ApiError',{...batch,batchId:randomUUID(),events:[{...event,eventId:randomUUID(),source:{kind:'router',collectorVersion:'synthetic-1'}}]},pair.deviceToken);
  const totals=await source.query('SELECT value,"coverageMs" FROM daily_usage WHERE "deviceId"=$1 ORDER BY "localDate"',[id]);assert.equal(totals.length,2);assert.deepEqual(totals.map(x=>x.value),['50.500000','50.500000']);
  const gap={gapId:randomUUID(),metric:event.metric,intervalStart:start.toISOString(),intervalEnd:finish.toISOString(),reason:'offline'};
  await request('POST',path,201,'MeasurementReceipt',{...batch,batchId:randomUUID(),events:[],gaps:[gap]},pair.deviceToken);
  // A storage failure must roll back raw data, dedup receipts and aggregates together.
  await source.query(`CREATE FUNCTION fixture_reject_aggregate() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic storage failure'; END $$`);
  await source.query('CREATE TRIGGER fixture_reject_aggregate BEFORE INSERT ON daily_usage FOR EACH ROW EXECUTE FUNCTION fixture_reject_aggregate()');
  const next={...event,eventId:randomUUID(),intervalStart:finish.toISOString(),intervalEnd:new Date(finish.getTime()+1000).toISOString(),value:2};
  const failing={...batch,batchId:randomUUID(),events:[next]};
  await request('POST',path,500,'ApiError',failing,pair.deviceToken);
  assert.equal((await source.query('SELECT count(*)::int AS n FROM measurement_receipts WHERE "eventId"=$1',[next.eventId]))[0].n,0);
  await source.query('DROP TRIGGER fixture_reject_aggregate ON daily_usage');await source.query('DROP FUNCTION fixture_reject_aggregate()');
  await request('POST',path,201,'MeasurementReceipt',failing,pair.deviceToken);
  await request('POST',`/devices/${id}/pause`,201,'RegisteredDevice',{},auth);
  await request('POST',path,409,'ApiError',batch,pair.deviceToken);
  await request('DELETE',`/devices/${id}/data`,200,null,null,auth);
  for(const table of ['measurements','measurement_receipts','measurement_batches','collection_gaps','daily_usage','monitoring_runs']) assert.equal((await source.query(`SELECT count(*)::int AS n FROM ${table} WHERE "deviceId"=$1`,[id]))[0].n,0);
  await request('POST',path,401,'ApiError',batch,pair.deviceToken);
  console.log('Passed synthetic measurement replay, conflict, midnight split, gap, rollback/recovery and deletion checks.');
}
