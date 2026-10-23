import {h} from './shared'
export function locationReview(r:any){
 return r.locationReview?.length?`<div class="punch-locations">${r.locationReview.map((p:any)=>`<p class="note"><strong>${h(p.name)} · ${h(p.status)}</strong><br>Captured ${h(p.capturedAt)}${p.latitude!==undefined?`<br>Location ${h(p.latitude)}, ${h(p.longitude)} · accuracy ${h(p.accuracyMeters)} m · distance ${h(Math.round(p.distanceMeters))} m`:''}${p.erasedAt?'<br>Coordinates erased; punch facts retained':''}${p.hold?'<br>Retention hold':''}${(p.reviews??[]).map((v:any)=>`<br>Owner review: ${h(v.reason)}`).join('')}</p>`).join('')}</div>`:''
}
