import {html,t as tr} from '../localization'
import {h,rows,card,person,manager,form,exact,field,moment} from './shared'
// Original capture facts stay alongside the review; resolution never silently applies time.
export function offlineCard(s:any,tz:string,back:string) {
 const issues=rows(s,'clockissues');if(!issues.length)return ''
 return card(tr(s,'Offline capture review'),html(s)`<p class="note">Device-reported captures below did not become time. Review the original facts and record missing or corrected time separately before resolving.</p><ul class="swap-list">${issues.map(r=>html(s)`<li><strong>${h(person(s,r.staffId))}</strong> · ${h(r.capture.name)} · captured ${moment(r.capture.input.capturedAt,tz,s)} · received ${moment(r.receivedAt,tz,s)}<p>${h(r.error)} · ${h(r.status)}</p><details><summary>Original capture</summary><pre>${h(JSON.stringify(r.capture,null,2))}</pre></details>${r.resolution?html(s)`<p>Resolved: ${h(r.resolution.reason)}</p>`:manager(s)&&r.staffId!==s.actor.staffId?form('clockissue.resolve',back,exact(r)+field('reason',tr(s,'Resolution'),'','text','required maxlength="500"'),tr(s,'Resolve capture'),'','secondary'):''}</li>`).join('')}</ul>`,'','offline-review')
}

export function captureReceipts(s:any,clock:any,tz:string) {
 const events=[{label:tr(s,'Clock in'),at:clock.start,received:clock.receivedAt},...(clock.breaks??[]).flatMap((b:any)=>[{label:html(s)`Start ${tr(s,b.kind)} break`,at:b.start,received:b.receivedAt},...(b.end?[{label:html(s)`End ${tr(s,b.kind)} break`,at:b.end,received:b.endReceivedAt}]:[])]),...(clock.transfers??[]).map((t:any)=>({label:tr(s,'Change job'),at:t.at,received:t.receivedAt})),...(clock.end?[{label:tr(s,'Clock out'),at:clock.end,received:clock.closedReceivedAt}]:[])].sort((a,b)=>a.at.localeCompare(b.at))
 return html(s)`<details><summary>Capture receipts</summary><ul>${events.map(e=>html(s)`<li>${h(e.label)}: captured ${moment(e.at,tz,s)}; received ${e.received?moment(e.received,tz,s):tr(s,'not recorded on this older capture')}</li>`).join('')}</ul></details>`
}
