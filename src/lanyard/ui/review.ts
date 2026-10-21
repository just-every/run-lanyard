// TIME-009 on Time: each waiting timesheet's review line (scheduled, captured and payable times,
// variance, breaks, network, job and cafe, rounding, cost and the running week) with edit and
// send-back actions, and the employee's card for time sent back to them.
import {h,rows,form,field,utc,exact,card,disclosure} from './shared'
import {hours,money,span} from './format'

const signed=(n:number)=>`${n>0?'+':n<0?'−':''}${Math.abs(n)} min`
export function reviewNote(r:any,tz:string) {
 const v=r.review;if(!v)return ''
 const parts=[v.scheduled?`Scheduled ${span(v.scheduled.start,v.scheduled.end,tz)}`:'Unscheduled',`captured ${span(v.captured.start,v.captured.end,tz)}`,`payable ${span(v.payable.start,v.payable.end,tz)}`]
 if(v.variance)parts.push(`start ${signed(v.variance.start)}, end ${signed(v.variance.end)}, ${signed(v.variance.minutes)} vs schedule`)
 parts.push(`meal ${v.breaks.taken} of ${v.breaks.required} min${v.breaks.waived?' (policy meal waived)':''}`)
 if(v.breaks.rest){const r=v.breaks.rest;parts.push(`paid rest ${r.taken===null?'not recorded':r.taken+' min'} of ${r.required} min; ${r.count===null?'unknown':r.count} of ${r.requiredCount} full breaks`)}
 if(v.roundingMinutes)parts.push(`rounding ${signed(v.roundingMinutes)}`)
 parts.push([v.job,v.site].filter(Boolean).join(' at ')||'No position')
 if(v.costCents!==null)parts.push(`cost ${money(v.costCents)}`)
 parts.push(`week ${hours(v.week.runningMinutes)} hrs${v.week.overtimeMinutes?`, ${hours(v.week.overtimeMinutes)} overtime`:''}`)
 return `<small class="review">${h(parts.join(' · '))}</small>`
}
/** Edit with a reason and send back, for an approver on a waiting row. */
export function reviewActions(r:any,back:string) {
 const edit=disclosure('Edit',`<p class="note">The captured times stay on the record beside your edit.</p>${form('time.edit',back,`${exact(r)}${utc('start','Work starts',r.start)}${utc('end','Work ends',r.end)}${field('breakMinutes','Meal minutes',r.breakMinutes,'number','required min="0" max="1440"')}${field('reason','Reason','','text','required maxlength="500"')}`,'Save edit','','secondary')}`,false,'inline-menu')
 const send=disclosure('Send back',form('time.return',back,`${exact(r)}${field('reason','What should they check?','','text','required maxlength="500"')}`,'Send back','','secondary'),false,'inline-menu')
 return edit+send
}
/** The employee's time a manager sent back, answered with the same or corrected times. */
export function returnedCard(s:any,tz:string,back:string) {
 const list=rows(s,'timesheets').filter(t=>t.staffId===s.actor.staffId&&t.status==='returned');if(!list.length)return ''
 return card('Sent back to you',list.map(t=>`<div class="returned"><p><strong>${h(span(t.start,t.end,tz))}</strong> · ${h(t.returned.reason)}</p>${form('time.resubmit',back,`${exact(t)}${utc('start','Work starts',t.start)}${utc('end','Work ends',t.end)}${field('breakMinutes','Meal minutes',t.breakMinutes,'number','required min="0" max="1440"')}${field('note','Note (optional)','','text','maxlength="500"')}`,'Resubmit','','primary')}</div>`).join(''),'','returned')
}
