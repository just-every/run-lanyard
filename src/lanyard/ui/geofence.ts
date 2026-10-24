import {h,rows} from './shared'
import {shiftForClock} from '../domain/clockrules'
import {LOCATION_NOTICE} from '../domain/geofence'
export function locationFields(s:any,now=Date.now()){
 const open=rows(s,'clocks').find(k=>k.staffId===s.actor.staffId&&k.status==='open'),shift=open?rows(s,'shifts').find(x=>x.id===open.shiftId):shiftForClock(s,s.actor.staffId,new Date(now).toISOString()),site=open?.transfers?.at(-1)?.site||shift?.site||rows(s,'staff').find(p=>p.id===s.actor.staffId)?.site||''
 if(!rows(s,'geofences').some(r=>r.site===site&&r.enabled))return ''
 return `<fieldset data-punch-location><legend>Punch location notice</legend><p>${h(LOCATION_NOTICE)}</p><label class="check"><input type="checkbox" name="locationNoticeSeen"> I have read this site's location notice</label><label class="check"><input type="checkbox" name="locationConsent"> I consent to location capture for this punch</label><p class="note">Location is requested once when you clock in or out. Declining or unavailable location keeps the punch with a named exception.</p></fieldset>`
}
export function locationReview(r:any){
 return r.locationReview?.length?`<div class="punch-locations">${r.locationReview.map((p:any)=>`<p class="note"><strong>${h(p.name)} · ${h(p.status)}</strong><br>Captured ${h(p.capturedAt)}${p.latitude!==undefined?`<br>Location ${h(p.latitude)}, ${h(p.longitude)} · accuracy ${h(p.accuracyMeters)} m · distance ${h(Math.round(p.distanceMeters))} m`:''}${p.erasedAt?'<br>Coordinates erased; punch facts retained':''}${p.hold?'<br>Retention hold':''}${(p.reviews??[]).map((v:any)=>`<br>Owner review: ${h(v.reason)}`).join('')}</p>`).join('')}</div>`:''
}
