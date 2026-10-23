import {type Context,need,keys,self,put,sha,text} from './model'
import {checkClockIn} from './clockrules'
import {siteOf} from './team'
import {currentOf} from './transfers'
export function clockLanguage(c:Context,name:string,p:Record<string,any>){if(name!=='clocklanguage.save')return;keys(p,['language']);need(['en','es'].includes(p.language),'Choose English or Spanish');const staffId=self(c.a)!,old=c.s.clocklanguages.find(x=>x.staffId===staffId);return put(c,'clocklanguages',{staffId,language:p.language},old)}
/** This runs before saved-command lookup, so a revoked device cannot replay even an old result. */
export async function kioskCheck(c:Context,name:string,p:Record<string,any>){
 const k=c.kiosk;if(!k)return
 const current=await c.db.prepare(`SELECT 1 FROM l_kiosk_sessions k JOIN l_kiosk_devices d ON d.id=k.device_id JOIN l_staff s ON s.id=k.staff_id JOIN l_kiosk_pins p ON p.staff_id=s.id WHERE k.token_hash=? AND d.id=? AND k.revoked_at IS NULL AND k.expires_at>? AND d.revoked_at IS NULL AND d.locked=0 AND s.active=1 AND s.erased_at IS NULL AND s.version=k.staff_version AND p.version=k.pin_version AND s.site=d.site`).bind(k.sessionHash,k.deviceId,Date.now()).first()
 need(current,'Kiosk access was revoked',403)
 const open=c.s.clocks.find(x=>x.staffId===c.a.staffId&&x.status==='open'),shift=name==='clock.in'?c.s.shifts.find(x=>x.id===checkClockIn(c.s,c.a.staffId!,String(p.capturedAt)).shiftId):undefined
 const site=name==='clock.in'?(shift?siteOf(c.s,shift):c.s.staff.find(x=>x.id===c.a.staffId)?.site):open?currentOf(c.s,open).site:k.site
 need(site===k.site,'Device is not approved for this shift cafe',403)
 need(!k.photo||k.photoRequired,'Photo collection is disabled on this device',403)
 if(k.photoFailure)need(k.photoRequired&&!k.photo&&['camera denied','camera failed','photo consent declined'].includes(k.photoFailure),'Choose an explicit photo failure')
 need(!k.photoRequired||k.photoFailure||k.photoConsent&&typeof k.photo==='string','Explicit photo consent and a photo are required for this punch',403)
 if(k.photo){need(k.photoConsent&&typeof k.photo==='string'&&k.photo.length<=134000&&/^[A-Za-z0-9+/]*={0,2}$/.test(k.photo),'Invalid punch photo');const bytes=Uint8Array.from(atob(k.photo),x=>x.charCodeAt(0));need(bytes.length<=100000&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255,'Use a JPEG photo up to 100 KB')}
}
export function kioskReceipt(c:Context,name:string,p:Record<string,any>,result:any){
 const k=c.kiosk;if(!k)return
 const id=crypto.randomUUID(),entity=c.entity,photoId=k.photo?crypto.randomUUID():null
 if(k.photo){const bytes=Uint8Array.from(atob(k.photo),x=>x.charCodeAt(0));c.sql.push(c.db.prepare('INSERT INTO l_kiosk_photos(id,staff_id,device_id,command_id,bytes,created_at) VALUES(?,?,?,?,?,?)').bind(photoId,c.a.staffId,k.deviceId,p.commandId,bytes,c.now))}
 if(k.photo&&k.photoConsent&&!c.s.photonotices.some(n=>n.staffId===c.a.staffId&&n.site===k.site))put(c,'photonotices',{staffId:c.a.staffId,site:k.site,text:k.language==='es'?'Doy mi consentimiento para guardar esta foto de forma privada para mí y el propietario hasta que se elimine explícitamente.':'I consent to this punch photo being stored privately for me and the owner until explicitly deleted.',version:1,seenAt:c.now,by:c.a.id,source:'kiosk notice'})
 const receipt=put(c,'kioskreceipts',{staffId:c.a.staffId,deviceId:k.deviceId,site:k.site,language:k.language,name,commandId:p.commandId,capturedAt:p.capturedAt,receivedAt:c.now,photoId,entityId:entity,photoConsent:Boolean(k.photo&&k.photoConsent),photoException:k.photoFailure??null})
 if(k.photoFailure){
  const message='punch photo unavailable: '+k.photoFailure,clock=c.s.clocks.find(x=>x.staffId===c.a.staffId&&(x.id===entity||x.timesheetId===entity))
  if(clock){const flags=[...new Set([...(clock.exceptions??[]),message])],updated=put(c,'clocks',{...clock,exceptions:flags},clock)
   if(result.clock)result={...result,clock:updated};else if(result.id===clock.id)result=updated
   const time=c.s.timesheets.find(t=>t.id===clock.timesheetId)
   if(time){const updatedTime=put(c,'timesheets',{...time,exceptions:[...new Set([...(time.exceptions??[]),message])]},time);if(result.timesheet)result={...result,timesheet:updatedTime}}
  }
 }
 c.entity=entity;return {receipt,result}
}
