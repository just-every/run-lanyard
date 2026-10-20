import {h,rows,card,person,manager,form,exact,field,moment} from './shared'
// Original capture facts stay alongside the review; resolution never silently applies time.
export function offlineCard(s:any,tz:string,back:string) {
 const issues=rows(s,'clockissues');if(!issues.length)return ''
 return card('Offline capture review',`<p class="note">Device-reported captures below did not become time. Review the original facts and record missing or corrected time separately before resolving.</p><ul class="swap-list">${issues.map(r=>`<li><strong>${h(person(s,r.staffId))}</strong> · ${h(r.capture.name)} · captured ${moment(r.capture.input.capturedAt,tz)} · received ${moment(r.receivedAt,tz)}<p>${h(r.error)} · ${h(r.status)}</p><details><summary>Original capture</summary><pre>${h(JSON.stringify(r.capture,null,2))}</pre></details>${r.resolution?`<p>Resolved: ${h(r.resolution.reason)}</p>`:manager(s)&&r.staffId!==s.actor.staffId?form('clockissue.resolve',back,exact(r)+field('reason','Resolution','','text','required maxlength="500"'),'Resolve capture','','secondary'):''}</li>`).join('')}</ul>`,'','offline-review')
}

export function captureReceipts(clock:any,tz:string) {
 const events=[{label:'Clock in',at:clock.start,received:clock.receivedAt},...(clock.breaks??[]).flatMap((b:any)=>[{label:`Start ${b.kind} break`,at:b.start,received:b.receivedAt},...(b.end?[{label:`End ${b.kind} break`,at:b.end,received:b.endReceivedAt}]:[])]),...(clock.transfers??[]).map((t:any)=>({label:'Change job',at:t.at,received:t.receivedAt})),...(clock.end?[{label:'Clock out',at:clock.end,received:clock.closedReceivedAt}]:[])].sort((a,b)=>a.at.localeCompare(b.at))
 return `<details><summary>Capture receipts</summary><ul>${events.map(e=>`<li>${h(e.label)}: captured ${moment(e.at,tz)}; received ${e.received?moment(e.received,tz):'not recorded on this older capture'}</li>`).join('')}</ul></details>`
}
