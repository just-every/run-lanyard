// LEAVE-002 under the week: the team leave calendar (approved and pending apart), the
// manager's blackout dates and absence limits, the dates staff may not request, and
// the override reason a conflicting approval needs.
import {h,rows,form,field,hidden,exact,card,disclosure,empty,status,person,venue} from './shared'
import {type Week} from './week'
import {day} from './format'
import {leaveConflicts,datesOf,dayLabel} from '../domain/leaverules'

const MODES:[string,string][]=[['refuse','Refuse requests'],['override','Send to a manager for an override']]
const mode=(value='refuse')=>`<label>When a request hits it<select name="mode">${MODES.map(([v,l])=>`<option value="${v}" ${v===value?'selected':''}>${h(l)}</option>`).join('')}</select></label>`
const scopeFields=`${field('site','Cafe (blank for every cafe)','','text','maxlength="80" list="cafes"')}${field('position','Position (blank for everyone)','','text','maxlength="80"')}`

/** Approved and pending time off by day of the shown week. */
export function teamLeave(s:any,w:Week) {
 const tz=venue(s),list=rows(s,'leave').filter(r=>['approved','pending'].includes(r.status))
 const days=w.days.map(d=>({d,off:list.filter(r=>datesOf(r.start,r.end,tz).includes(d))})).filter(v=>v.off.length)
 const who=(r:any)=>`${h(person(s,r.staffId))} ${status(r.status)}`
 const body=days.length?`<table class="list"><thead><tr><th>Day</th><th>Off</th></tr></thead><tbody>${days.map(v=>`<tr><td>${h(day(v.d))}</td><td>${v.off.sort((a:any,b:any)=>a.status.localeCompare(b.status)).map(who).join('<br>')}</td></tr>`).join('')}</tbody></table>`:empty('Nobody is off this week.','calendar')
 return card('Team leave calendar',body,`<p class="card-note">Approved and pending, week of ${h(day(w.week))}</p>`,'leave-calendar')
}
export function leaveRulesCard(s:any,back:string) {
 const list=rows(s,'leaverules').filter(r=>!r.removed)
 const what=(r:any)=>r.kind==='blackout'?`${h(r.label||'Blackout')}: ${h(dayLabel(r.from))} to ${h(dayLabel(r.to))}`:`At most ${h(r.max)} off at once`
 const table=list.length?`<table class="list"><thead><tr><th>Rule</th><th>Applies to</th><th>Requests</th><th><span class="sr-only">Remove</span></th></tr></thead><tbody>${list.map(r=>`<tr><td>${what(r)}</td><td>${h([r.position||'Everyone',r.site&&`at ${r.site}`].filter(Boolean).join(' '))}</td><td>${h(MODES.find(([v])=>v===r.mode)?.[1]??r.mode)}</td><td>${form('leaverule.save',back,exact(r)+hidden('removed','true'),'Remove','','secondary small')}</td></tr>`).join('')}</tbody></table>`:empty('No blackout dates or limits.','calendar')
 const blackout=disclosure('Add blackout dates',form('leaverule.save',back,`${hidden('kind','blackout')}<div class="fields">${field('label','Name','','text','maxlength="80" placeholder="Holiday weekend"')}${field('from','First day','','date','required')}${field('to','Last day','','date','required')}${scopeFields}${mode()}</div>`,'Save blackout','','secondary'))
 const limit=disclosure('Add a limit',form('leaverule.save',back,`${hidden('kind','limit')}<div class="fields">${field('max','People off at once','2','number','required min="1" max="500"')}${scopeFields}${mode('override')}</div>`,'Save limit','','secondary'))
 return card('Time-off rules',`<p class="note">Dates are the venue’s calendar days. Approving a request that breaks a rule needs an override reason.</p>${table}<div class="split">${blackout}${limit}</div>`,'','leave-rules')
}
/** Above a staff member's request form: the dates they cannot ask for, without saying who is off. */
export function allowedNote(s:any) {
 const v=s.leaveDates;if(!v||(!v.closed?.length&&!v.full?.length))return ''
 const closed=v.closed.map((b:any)=>`${h(b.label||'Blackout')}: ${h(dayLabel(b.from))} to ${h(dayLabel(b.to))}${b.mode==='override'?' (needs a manager’s override)':''}`)
 const full=v.full.length?[`Already full: ${v.full.map((d:string)=>h(dayLabel(d))).join(', ')} (needs a manager’s override)`]:[]
 return `<div class="note"><p>Time off is limited on these dates:</p><ul>${[...closed,...full].map(x=>`<li>${x}</li>`).join('')}</ul></div>`
}
/** The approve control for a pending request: plain, or with the conflicts and an override reason. */
export function approveLeave(s:any,r:any,back:string) {
 const found=leaveConflicts(rows(s,'staff'),rows(s,'leave'),rows(s,'leaverules'),venue(s),r)
 if(!found.length)return form('leave.decide',back,exact(r)+hidden('decision','approved'),'Approve','','primary small')
 return disclosure('Approve with override',`<ul class="conflicts">${found.map(x=>`<li>${h(x.text)}</li>`).join('')}</ul>${form('leave.decide',back,exact(r)+hidden('decision','approved')+field('override','Override reason','','text','required maxlength="500"'),'Approve with override','','primary small')}`,false,'inline-menu')
}
