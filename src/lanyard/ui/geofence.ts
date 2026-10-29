import {captureName,punchFlag,html,t as tr} from '../localization'
import {h,rows,moment} from './shared'
import {shiftForClock} from '../domain/clockrules'
import {LOCATION_NOTICE} from '../domain/geofence'
export function locationFields(s:any,now=Date.now()){
 const open=rows(s,'clocks').find(k=>k.staffId===s.actor.staffId&&k.status==='open'),shift=open?rows(s,'shifts').find(x=>x.id===open.shiftId):shiftForClock(s,s.actor.staffId,new Date(now).toISOString()),site=open?.transfers?.at(-1)?.site||shift?.site||rows(s,'staff').find(p=>p.id===s.actor.staffId)?.site||''
 if(!rows(s,'geofences').some(r=>r.site===site&&r.enabled))return ''
 return html(s)`<fieldset data-punch-location><legend>Punch location notice</legend><p>${h(tr(s,LOCATION_NOTICE))}</p><label class="check"><input type="checkbox" name="locationNoticeSeen"> I have read this site's location notice</label><label class="check"><input type="checkbox" name="locationConsent"> I consent to location capture for this punch</label><p class="note">Location is requested once when you clock in or out. Declining or unavailable location keeps the punch with a named exception.</p></fieldset>`
}
export function locationReview(s:any,r:any){
 return r.locationReview?.length?html(s)`<div class="punch-locations">${r.locationReview.map((p:any)=>html(s)`<p class="note"><strong>${h(captureName(s,p.name))} · ${h(punchFlag(s,p.status))}</strong><br>Captured ${moment(p.capturedAt,s.settings.timezone,s)}${p.latitude!==undefined?html(s)`<br>Location ${h(p.latitude)}, ${h(p.longitude)} · accuracy ${h(p.accuracyMeters)} m · distance ${h(Math.round(p.distanceMeters))} m`:''}${p.erasedAt?html(s)`<br>Coordinates erased; punch facts retained`:''}${p.hold?html(s)`<br>Retention hold`:''}${(p.reviews??[]).map((v:any)=>html(s)`<br>Owner review: ${h(v.reason)}`).join('')}</p>`).join('')}</div>`:''
}
