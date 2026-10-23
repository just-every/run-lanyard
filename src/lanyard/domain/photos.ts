// CLOCK-005: consented stills only; existing employee/owner custody is preserved.
// @ts-ignore Pinned portability module has no declarations.
import {createPortability} from '@runeditrun/rer/modules/portability'
// @ts-ignore Archive policy is shared with the pinned JavaScript CLI.
import archivePolicy from '../archive-policy.mjs'
import {type Context,type State,type Row,keys,text,need,integer,put,self} from './model'
import {checkClockIn} from './clockrules'
import {currentOf} from './transfers'
export const PHOTO_NOTICE='A still photo is captured only at this punch with your consent. No face matching or template is made. Only you and the owner can read it. It remains until the owner explicitly erases eligible photos under the site retention rule; punch facts and exceptions remain.'
export const photoRule=(s:State,site:string)=>s.photopolicies.find(p=>p.site===site)
export function photoSite(c:Context,name:string,p:any){const open=c.s.clocks.find(k=>k.staffId===c.a.staffId&&k.status==='open'),shift=name==='clock.in'?c.s.shifts.find(x=>x.id===checkClockIn(c.s,c.a.staffId!,p.capturedAt).shiftId):undefined;return shift?.site||(open?currentOf(c.s,open).site:c.s.staff.find(w=>w.id===c.a.staffId)?.site)||''}
export function photoBefore(c:Context,name:string,p:any){
 if(c.kiosk||!['clock.in','clock.out','clock.breakStart','clock.breakEnd'].includes(name))return null
 const fields={photo:p.photo,consent:p.photoConsent===true,failure:p.photoFailure,notice:p.photoNoticeSeen===true}
 for(const key of ['photo','photoConsent','photoFailure','photoNoticeSeen'])delete p[key]
 const site=photoSite(c,name,p),policy=photoRule(c.s,site),required=Boolean(policy?.native&&(name==='clock.in'||name==='clock.out'||policy.breaks))
 if(!required){need(!fields.photo&&!fields.failure,'Photo collection is disabled for this capture',403);return null}
 self(c.a)
 need(fields.notice,'Read and acknowledge the photo notice before capture',403)
 need(!fields.photo||!fields.failure,'Provide a photo or a named camera exception')
 if(fields.failure)need(['camera denied','camera failed','photo consent declined'].includes(fields.failure),'Choose a named camera failure')
 need(fields.failure||fields.consent&&typeof fields.photo==='string','Explicit consent or a named photo exception is required',403)
 if(fields.photo){need(fields.consent&&fields.photo.length<=134000&&/^[A-Za-z0-9+/]*={0,2}$/.test(fields.photo),'Invalid photo');const bytes=Uint8Array.from(atob(fields.photo),x=>x.charCodeAt(0));need(bytes.length<=100000&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255,'Use a JPEG still up to 100 KB')}
 return {...fields,site,policyId:policy!.id,policyRevision:policy!.revision}
}
export function photoReceipt(c:Context,name:string,p:any,result:any,photo:any){
 if(!photo)return result
 const entity=c.entity,photoId=photo.photo?crypto.randomUUID():null
 if(photoId)c.sql.push(c.db.prepare('INSERT INTO l_kiosk_photos(id,staff_id,device_id,command_id,bytes,created_at) VALUES(?,?,?,?,?,?)').bind(photoId,c.a.staffId,'native',p.commandId,Uint8Array.from(atob(photo.photo),x=>x.charCodeAt(0)),c.now))
 if(!c.s.photonotices.some(n=>n.staffId===c.a.staffId&&n.site===photo.site))put(c,'photonotices',{staffId:c.a.staffId,site:photo.site,text:PHOTO_NOTICE,version:1,seenAt:c.now,by:c.a.id})
 const receipt=put(c,'photoreceipts',{staffId:c.a.staffId,site:photo.site,name,entityId:entity,commandId:p.commandId,capturedAt:p.capturedAt,receivedAt:c.now,photoId,photoConsent:Boolean(photo.photo&&photo.consent),photoException:photo.failure??null,policyId:photo.policyId,policyRevision:photo.policyRevision})
 if(photo.failure){const message='punch photo unavailable: '+photo.failure,clock=c.s.clocks.find(k=>k.id===entity||k.timesheetId===entity)
  if(clock){const changed=put(c,'clocks',{...clock,exceptions:[...new Set([...(clock.exceptions??[]),message])]},clock);if(result.clock)result={...result,clock:changed};else if(result.id===clock.id)result=changed
   const t=c.s.timesheets.find(t=>t.id===clock.timesheetId);if(t){const updated=put(c,'timesheets',{...t,exceptions:[...new Set([...(t.exceptions??[]),message])]},t);if(result.timesheet)result={...result,timesheet:updated}}}
 }
 c.entity=entity;return {...result,photoReceipt:receipt}
}
export function photosForTime(s:State,t:Row){
 const clock=s.clocks.find(k=>k.id===t.clockId||k.timesheetId===t.id||k.timesheetId===t.rootId),ids=new Set([t.id,t.rootId,clock?.id,clock?.timesheetId])
 return [...s.kioskreceipts,...s.photoreceipts].filter(r=>r.staffId===t.staffId&&ids.has(r.entityId)).sort((a,b)=>a.capturedAt.localeCompare(b.capturedAt)||a.name.localeCompare(b.name)).map(r=>({name:r.name,capturedAt:r.capturedAt,photoId:r.photoId,photoException:r.photoException,erasedAt:r.erasedAt}))
}
export async function photoCommand(c:Context,name:string,p:any){
 if(!['photo.save','photo.hold','photo.erase'].includes(name))return
 need(c.a.role==='owner','Only the owner administers photo custody',403)
 if(name==='photo.save'){
  keys(p,['site','native','breaks','retentionDays','consent','revision']);const site=text(p.site,'site',80),old=photoRule(c.s,site);if(old)need(Number(p.revision)===old.revision,'Photo policy changed; reload',409)
  need(p.consent===true||p.consent==='on','Explicit employer approval is required',403)
  const {versions,...prior}:any=old??{}
  return put(c,'photopolicies',{site,native:p.native===true||p.native==='true',breaks:p.breaks===true||p.breaks==='true',retentionDays:integer(Number(p.retentionDays),'retention days',1,3650),by:c.a.id,at:c.now,versions:old?[...(versions??[]),prior]:[]},old)
 }
 const staffId=text(p.staffId,'staff ID'),person=c.s.staff.find(p=>p.id===staffId);need(person,'Person not found',404)
 if(name==='photo.hold'){
  keys(p,['staffId','hold','reason']);need(typeof p.hold==='boolean'||['true','false'].includes(p.hold),'Choose hold or release');const old=c.s.photoholds.find(h=>h.staffId===staffId)
  return put(c,'photoholds',{staffId,hold:p.hold===true||p.hold==='true',reason:text(p.reason,'hold reason',500),by:c.a.id,at:c.now,changes:[...(old?.changes??[]),{by:c.a.id,at:c.now,hold:old?.hold??false,reason:old?.reason??''}]},old)
 }
 keys(p,['staffId','mode','reason','consent']);need(p.consent===true||p.consent==='on','Explicit reviewed erasure consent is required',403);need(['retention','former'].includes(p.mode),'Choose expired retention or former employee')
 need(!c.s.photoholds.some(h=>h.staffId===staffId&&h.hold),'A photo hold prevents erasure',409);if(p.mode==='former')need(!person.active,'Deactivate the former employee first',409)
 const reason=text(p.reason,'erasure reason',500),erased:string[]=[]
 for(const kind of ['kioskreceipts','photoreceipts'] as const)for(const r of c.s[kind].filter(r=>r.staffId===staffId&&r.photoId)){
  const policy=photoRule(c.s,r.site);if(!policy||Date.parse(r.capturedAt)>Date.parse(c.now)-policy.retentionDays*86400000)continue
  erased.push(r.photoId);c.sql.push(c.db.prepare('DELETE FROM l_kiosk_photos WHERE id=? AND staff_id=?').bind(r.photoId,staffId));put(c,kind,{...r,photoId:null,erasedAt:c.now,erasedBy:c.a.id,erasureReason:reason},r)
 }
 if(erased.length){const portability=await createPortability({db:c.db,buckets:{FILES:c.files!},policy:archivePolicy});c.sql.push(...await portability.redactionStatements(),...await portability.invalidateTransfersStatements())}
 c.entity=staffId;return {staffId,erased:erased.length,punchFactsRetained:true}
}
