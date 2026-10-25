import {privacyHeld,privacyExpired} from './privacy'
// CLOCK-003: native event-only evidence; no background location collection.
// @ts-ignore Pinned portability module has no declarations.
import {createPortability} from '@runeditrun/rer/modules/portability'
// @ts-ignore Shared archive policy.
import archivePolicy from '../archive-policy.mjs'
import {type Context,type State,type Row,keys,text,need,integer,put,get,exact,instant} from './model'
import {photoSite} from './photos'
export const LOCATION_NOTICE='Location is recorded only with this punch and your explicit consent. Only you and the owner can read coordinates. No background tracking occurs. The owner reviews exceptions and explicitly erases eligible coordinates after retention; punch facts remain.'
const number=(v:any,label:string,min:number,max:number)=>{need(typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max,`Invalid ${label}`);return v as number}
export function locationReplay(s:State,result:any,net:Context['net']){
 const id=result?.result?.locationReceiptId,receipt=s.georeceipts.find(r=>r.id===id)
 if(receipt)need(net?.browsers.some(b=>b.id===receipt.deviceId&&b.site===receipt.site),'Location clock device revoked; use an enrolled device',403)
}
export function locationBefore(c:Context,name:string,p:any){
 if(!['clock.in','clock.out'].includes(name))return null
 const location=p.location;delete p.location
 if(c.kiosk){need(location===undefined,'Kiosk location collection is unavailable',403);return null}
 const site=photoSite(c,name,p),rule=c.s.geofences.find(r=>r.site===site&&r.enabled)
 if(!rule){need(location===undefined,'Location collection is disabled for this site',403);return null}
 const device=c.net?.browsers.find(b=>b.site===site)
 need(device,'Enroll this location clock device before capture',403)
 const common={site,deviceId:device.id,policyId:rule.id,policyRevision:rule.revision,retentionDays:rule.retentionDays,geofence:{latitude:rule.latitude,longitude:rule.longitude,radiusMeters:rule.radiusMeters,maxAccuracyMeters:rule.maxAccuracyMeters}}
 if(location===undefined)return {...common,status:'location unavailable',consent:false}
 need(location&&typeof location==='object'&&!Array.isArray(location),'Invalid punch location');keys(location,['latitude','longitude','accuracyMeters','observedAt','consent','noticeSeen','failure'])
 need(location.noticeSeen===true,'Read the punch location notice before capture',403)
 if(location.failure){need(['permission denied','unavailable','consent declined'].includes(location.failure),'Choose a named location failure');need(location.latitude===undefined&&location.longitude===undefined&&location.accuracyMeters===undefined&&location.observedAt===undefined,'A failed location capture cannot include coordinates');return {...common,status:'location '+location.failure,consent:false}}
 need(location.consent===true,'Explicit consent is required for punch coordinates',403)
 const latitude=number(location.latitude,'latitude',-90,90),longitude=number(location.longitude,'longitude',-180,180),accuracyMeters=number(location.accuracyMeters,'location accuracy',0,100000)
 const observedAt=instant(location.observedAt,'location observation'),at=instant(p.capturedAt,'capture time')
 need(Math.abs(Date.parse(observedAt)-Date.parse(at))<=60000,'Location must be observed within one minute of the punch',409)
 const radians=(n:number)=>n*Math.PI/180,dLat=radians(latitude-rule.latitude),dLon=radians(longitude-rule.longitude)
 const hav=Math.sin(dLat/2)**2+Math.cos(radians(rule.latitude))*Math.cos(radians(latitude))*Math.sin(dLon/2)**2
 const distanceMeters=6371000*2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,hav))))
 // The whole uncertainty circle must fit; an ambiguous edge is not verified inside.
 const status=accuracyMeters>rule.maxAccuracyMeters?'poor location accuracy':distanceMeters-accuracyMeters>rule.radiusMeters?'out-of-zone punch':distanceMeters+accuracyMeters<=rule.radiusMeters?'inside geofence':'geofence boundary uncertain'
 return {...common,latitude,longitude,accuracyMeters,observedAt,distanceMeters,status,consent:true,notice:LOCATION_NOTICE}
}
export function locationReceipt(c:Context,name:string,p:any,result:any,location:any){
 if(!location)return result
 const entity=c.entity,receipt=put(c,'georeceipts',{...location,staffId:c.a.staffId,name,entityId:entity,commandId:p.commandId,capturedAt:p.capturedAt,receivedAt:c.now})
 if(location.status!=='inside geofence'){
  const clock=c.s.clocks.find(k=>k.id===entity||k.timesheetId===entity)
  if(clock){const changed=put(c,'clocks',{...clock,exceptions:[...new Set([...(clock.exceptions??[]),location.status])]},clock);if(result.clock)result={...result,clock:changed};else if(result.id===clock.id)result=changed
   const time=c.s.timesheets.find(t=>t.id===clock.timesheetId);if(time){const changed=put(c,'timesheets',{...time,exceptions:[...new Set([...(time.exceptions??[]),location.status])]},time);if(result.timesheet)result={...result,timesheet:changed}}}
 }
 c.entity=entity
 // Command receipts contain a reference, never a second copy of private coordinates.
 return {...result,locationReceiptId:receipt.id}
}
export function locationsForTime(s:State,t:Row){
 const clock=s.clocks.find(k=>k.id===t.clockId||k.timesheetId===t.rootId||k.timesheetId===t.id),ids=new Set([t.id,t.rootId,clock?.id,clock?.timesheetId])
 return s.georeceipts.filter(r=>r.staffId===t.staffId&&ids.has(r.entityId)).sort((a,b)=>a.capturedAt.localeCompare(b.capturedAt))
}
export async function geofenceCommand(c:Context,name:string,p:any){
 if(!['geofence.save','location.review','location.hold','location.erase'].includes(name))return
 need(c.a.role==='owner','Only the owner administers punch location evidence',403)
 if(name==='geofence.save'){
  keys(p,['site','latitude','longitude','radiusMeters','maxAccuracyMeters','retentionDays','enabled','consent','revision'])
  const site=text(p.site,'site',80),old=c.s.geofences.find(r=>r.site===site)
  if(old)exact(old,p)
  need(p.consent===true&&typeof p.enabled==='boolean','Explicit employer location policy approval is required',403)
  const latitude=number(p.latitude,'latitude',-90,90),longitude=number(p.longitude,'longitude',-180,180),radiusMeters=number(p.radiusMeters,'radius',1,100000),maxAccuracyMeters=number(p.maxAccuracyMeters,'maximum accuracy',1,10000)
  return put(c,'geofences',{site,latitude,longitude,radiusMeters,maxAccuracyMeters,retentionDays:integer(p.retentionDays,'retention days',1,3650),enabled:p.enabled,notice:LOCATION_NOTICE,by:c.a.id,at:c.now},old)
 }
 const r=get(c.s,'georeceipts',p.id);exact(r,p)
 if(name==='location.review'){
  keys(p,['id','revision','reason']);const reviewed=put(c,'georeceipts',{...r,reviews:[...(r.reviews??[]),{reason:text(p.reason,'review reason',500),by:c.a.id,at:c.now}]},r)
  return {id:reviewed.id,revision:reviewed.revision,review:reviewed.reviews.at(-1)}
 }
 if(name==='location.hold'){
  keys(p,['id','revision','hold','reason']);need(typeof p.hold==='boolean','Choose hold or release');const held=put(c,'georeceipts',{...r,hold:p.hold,holds:[...(r.holds??[]),{hold:p.hold,reason:text(p.reason,'hold reason',500),by:c.a.id,at:c.now}]},r)
  return {id:held.id,revision:held.revision,hold:held.hold}
 }
 keys(p,['id','revision','reason','consent']);need(p.consent===true,'Explicit reviewed erasure consent is required',403);need(!privacyHeld(c.s,r.staffId,'location'),'A legal hold prevents location erasure',409);need(!r.hold,'Location hold prevents erasure',409)
 need(privacyExpired(c.s,'location',r.capturedAt,c.now),'Location retention review period has not expired',409)
 need(Date.parse(r.capturedAt)<=Date.parse(c.now)-r.retentionDays*86400000,'Location retention has not expired',409)
 need(!r.erasedAt,'Location coordinates already erased',409)
 const {latitude,longitude,accuracyMeters,observedAt,distanceMeters,...facts}=r
 const erased=put(c,'georeceipts',{...facts,erasedAt:c.now,erasedBy:c.a.id,erasureReason:text(p.reason,'erasure reason',500)},r)
 const portability=await createPortability({db:c.db,buckets:{FILES:c.files!},policy:archivePolicy});c.sql.push(...await portability.redactionStatements(),...await portability.invalidateTransfersStatements())
 return {id:erased.id,revision:erased.revision,erasedAt:erased.erasedAt,punchFactsRetained:true}
}
