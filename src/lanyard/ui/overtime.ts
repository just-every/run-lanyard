// COST-002 on the schedule: managers' overtime risk card for the week shown (recorded plus remaining
// scheduled hours, the premium estimate and qualified substitutes for each remaining shift), and the
// projected-overtime line shown on a pending pickup or swap before approval.
import {h,rows,form,hidden,card,person} from './shared'
import {dateKey,day,hours,money,span} from './format'

const premiumHours=(c:any)=>`${hours(c.overtimeMinutes)} hr overtime${c.policy?` · ${hours(c.doubleMinutes)} hr double time`:''}`
/** Policy inputs stay on manager cost views and are folded beside their estimate. */
function policyTrace(c:any) {
 if(!c.policy)return ''
 const rules=new Map<string,any>()
 for(const r of c.policy.sources??(c.policy.parts??[]).flatMap((p:any)=>p.rules))rules.set(`${r.id}:${r.revision}`,r)
 return `<details class="note"><summary>Policy and estimate inputs</summary><p>${h(c.policy.label)}. Overtime basis: ${h(c.policy.overtimeBasis)}. Premium only: half the weighted regular rate for overtime, the full rate for double time.${c.policy.weightedRateCents===null?'':` Weighted regular rate: ${h(money(c.policy.weightedRateCents))} per hour.`}${c.policy.classificationIncomplete?' Consecutive-hours estimate is conservative because qualifying meal timing is not recorded.':''}</p><ul>${[...rules.values()].map(r=>`<li>${h(r.label)} · revision ${h(r.revision)} · <a href="${h(r.source)}">Rule source</a></li>`).join('')}</ul><ul>${(c.policy.parts??[]).map((p:any)=>`<li>${h(p.date)} · ${h(p.site||'Home cafe')} · ${h(hours(p.minutes))} hrs · ${h(hours(p.overtimeMinutes))} overtime · ${h(hours(p.doubleMinutes))} double time · record ${h(p.timeId)} revision ${h(p.revision)}</li>`).join('')}</ul></details>`
}
/** One pending move's projection, including daily and double time before approval. */
export function costNote(s:any,list:any[]|undefined) {
 return (list??[]).filter((c:any)=>c.overtimeMinutes>0||c.doubleMinutes>0).map((c:any)=>`<p class="note">Projected overtime: ${h(person(s,c.staffId))} would reach ${h(hours(c.projectedMinutes))} hrs this workweek · ${h(premiumHours(c))}${c.premiumCents===null?' · no hourly rate on file for an estimate':` · est. premium ${h(money(c.premiumCents))}`}</p>${policyTrace(c)}`).join('')
}
export function overtimeCard(s:any,week:string,tz:string,back:string) {
 const list=rows(s,'overtime').filter(a=>a.week===week);if(!list.length)return ''
 const policy=list.some(a=>a.policy)
 const items=list.map(a=>`<li><strong>${h(a.name)}</strong> · ${h(hours(a.projectedMinutes))} hrs projected (${h(hours(a.actualMinutes))} recorded + ${h(hours(a.scheduledMinutes))} scheduled) · ${h(premiumHours(a))} · ${a.premiumCents===null?'no hourly rate on file for an estimate':`est. premium ${h(money(a.premiumCents))}`}${policyTrace(a)}${a.remaining.map((r:any)=>`<div class="request">${h(day(dateKey(r.start,tz)))} · ${h(span(r.start,r.end,tz))}${r.site?` · ${h(r.site)}`:''} · ${r.substitutes.length?r.substitutes.map((x:any)=>form('overtime.substitute',back,hidden('shiftId',r.shiftId)+hidden('revision',r.revision)+hidden('staffId',x.staffId),`Give to ${x.name} (${hours(x.projectedMinutes)} hrs)`,'','secondary small')).join(''):(a.policy?'no qualified substitute avoids policy overtime and double time':'no substitute stays under 40 hours')}</div>`).join('')}</li>`).join('')
 return card('Overtime risk',`<p class="note">${policy?'Recorded time plus remaining published shifts at every cafe, against effective daily, consecutive-hours, seventh-day and weekly rules for each person’s configured workweek. Premiums use the weighted-average regular rate as an estimate.':'Recorded time plus remaining published shifts at every cafe, against a 40-hour workweek. The premium estimate is half the hourly rate for each overtime hour.'}</p><ul class="swap-list">${items}</ul>`,`<p class="card-note">${h(list.length)} ${policy?'projected into overtime or double time':'projected over 40 hrs'}</p>`,'overtime')
}
