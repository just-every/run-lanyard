// COST-002 on the schedule: managers' overtime risk card for the week shown (recorded plus remaining
// scheduled hours, the premium estimate and qualified substitutes for each remaining shift), and the
// projected-overtime line shown on a pending pickup or swap before approval.
import {h,rows,form,hidden,card,person} from './shared'
import {dateKey,day,hours,money,span} from './format'

/** One pending move's projection: hours after it and, when it crosses 40, the overtime and its estimated premium. */
export function costNote(s:any,list:any[]|undefined) {
 return (list??[]).filter((c:any)=>c.overtimeMinutes>0).map((c:any)=>`<p class="note">Projected overtime: ${h(person(s,c.staffId))} would reach ${h(hours(c.projectedMinutes))} hrs this workweek · ${h(hours(c.overtimeMinutes))} hr overtime${c.premiumCents===null?' · no hourly rate on file for an estimate':` · est. premium ${h(money(c.premiumCents))}`}</p>`).join('')
}
export function overtimeCard(s:any,week:string,tz:string,back:string) {
 const list=rows(s,'overtime').filter(a=>a.week===week);if(!list.length)return ''
 const items=list.map(a=>`<li><strong>${h(a.name)}</strong> · ${h(hours(a.projectedMinutes))} hrs projected (${h(hours(a.actualMinutes))} recorded + ${h(hours(a.scheduledMinutes))} scheduled) · ${h(hours(a.overtimeMinutes))} hr overtime · ${a.premiumCents===null?'no hourly rate on file for an estimate':`est. premium ${h(money(a.premiumCents))}`}${a.remaining.map((r:any)=>`<div class="request">${h(day(dateKey(r.start,tz)))} · ${h(span(r.start,r.end,tz))}${r.site?` · ${h(r.site)}`:''} · ${r.substitutes.length?r.substitutes.map((x:any)=>form('overtime.substitute',back,hidden('shiftId',r.shiftId)+hidden('revision',r.revision)+hidden('staffId',x.staffId),`Give to ${x.name} (${hours(x.projectedMinutes)} hrs)`,'','secondary small')).join(''):'no substitute stays under 40 hours'}</div>`).join('')}</li>`).join('')
 return card('Overtime risk',`<p class="note">Recorded time plus remaining published shifts at every cafe, against a 40-hour workweek (Monday to Sunday). The premium estimate is half the hourly rate for each overtime hour.</p><ul class="swap-list">${items}</ul>`,`<p class="card-note">${h(list.length)} projected over 40 hrs</p>`,'overtime')
}
