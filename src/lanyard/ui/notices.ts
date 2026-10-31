import {html,t as tr} from '../localization'
import {h,rows,manager,card,disclosure,form,field,hidden,moment,exact,status} from './shared'
const fields=[['shiftLeadMinutes','Shift reminder lead (minutes)'],['ackMinutes','Acknowledgment deadline after publication (minutes)'],['offerLeadMinutes','Offer expiry lead (minutes)'],['exceptionMinutes','Missed punch / break review delay (minutes)'],['reviewMinutes','Timesheet review cutoff after period end (minutes)'],['payrollLeadMinutes','Payroll reminder before period end (minutes)'],['escalationMinutes','Escalate unresolved item after (minutes)']]
export function noticeInbox(s:any,back:string,site:string) {
 const notices=rows(s,'notices'),rule=rows(s,'noticerules').find(r=>r.site===site)
 const list=notices.length?html(s)`<ul>${notices.map(n=>html(s)`<li><strong>${n.escalation?tr(s,'Escalation: '):''}${h(n.label)}</strong> · ${moment(n.due,s.settings.timezone,s)}${n.escalationState?` · ${h(n.escalationState)}`:''}</li>`).join('')}</ul>`:html(s)`<p>No reminders due.</p>`
 const settings=manager(s)?disclosure(tr(s,'Reminder settings'),html(s)`<p>Blank turns a reminder off. Late and no-show reminders reuse the attendance rules. Escalations go once to the owner; a handling note leaves the item open.</p>${form('noticerule.save',back,field('site',tr(s,'Cafe'),site)+hidden('revision',rule?.revision??'')+fields.map(([key,label])=>field(key,label,rule?.[key]??'','number','min="0" max="44640" step="1"')).join(''),tr(s,'Save reminder settings'))}`):''
 return card(html(s)`Reminder inbox · ${notices.length}`,html(s)`<p>In Lanyard only; push, email and SMS delivery is not configured here.</p>${list}${settings}`,'','reminder-inbox')
}

/** Personal assignment facts only, with an explicit notice receipt of their own. */
export function scheduleInbox(s:any,back:string){
 if(!s.actor.staffId)return ''
 const notices=rows(s,'schedulenotices'),unread=notices.filter(n=>n.actionable).length
 const labels:Record<string,string>={publication:'Shift published',change:'Shift changed',cancellation:'Assignment cancelled',pickup:'Pickup approved',swap:'Swap approved'}
 const assignment=(x:any)=>`${moment(x.start,s.settings.timezone)} – ${moment(x.end,s.settings.timezone)}${x.site?` · ${h(x.site)}`:''}${x.job?` · ${h(rows(s,'jobs').find(j=>j.id===x.job)?.name??'Assigned job')}`:''}${x.label?` · ${h(x.label)}`:''} · ${h(x.breakMinutes)} minute unpaid break`
 const list=notices.length?`<ul class="schedule-notices">${notices.map(n=>`<li data-schedule-notice="${h(n.id)}"><strong>${h(labels[n.kind]??'Schedule updated')}</strong> ${status(n.status==='superseded'?'superseded':n.acknowledgedAt?'acknowledged':'available',n.status==='superseded'?'Superseded':n.acknowledgedAt?'Acknowledged':'Needs acknowledgment')}<p>${assignment(n.assignment??n.previous)}</p>${n.kind==='change'&&n.previous?disclosure('Previous assignment',`<p>${assignment(n.previous)}</p>`):''}<p>Available in Lanyard ${moment(n.delivery.availableAt,s.settings.timezone)}. External delivery not attempted.</p>${n.acknowledgedAt?`<p>You acknowledged this notice ${moment(n.acknowledgedAt,s.settings.timezone)}.</p>`:n.actionable?form('schedule.notice.acknowledge',back,exact(n),'Acknowledge notice'):n.status==='superseded'?'<p>This notice is obsolete. Review your current schedule.</p>':''}${disclosure('Source revision',`<p>Recorded ${moment(n.createdAt,s.settings.timezone)}. ${h(n.assignmentSource?`Shift ${n.assignmentSource.shiftId}, revision ${n.assignmentSource.shiftRevision}`:`Former shift ${n.priorSource.shiftId}, revision ${n.priorSource.shiftRevision}`)}.</p>`)}</li>`).join('')}</ul>`:'<p>No schedule notices yet.</p>'
 return card(`Schedule inbox · ${unread} to acknowledge`,`<p>In Lanyard only. Acknowledging a notice does not confirm a shift or grant policy consent.</p>${list}`,'','schedule-inbox')
}

/** Resolve the destination under live access again when the employee opens it. */
export function eventInbox(s:any,back:string){
 const notices=rows(s,'eventnotices')
 if(!notices.length)return ''
 return card(`Activity inbox · ${notices.filter(n=>n.actionable).length} to acknowledge`,
  `<p>In Lanyard only. A notice receipt does not answer an offer, consent to a swap or approve work.</p><ul>${notices.map(n=>`<li data-event-notice="${h(n.id)}"><strong>${h(n.label)}</strong>${n.assignment?`<p>${moment(n.assignment.start,s.settings.timezone)} – ${moment(n.assignment.end,s.settings.timezone)}${n.assignment.site?` · ${h(n.assignment.site)}`:''}</p>`:''}<p><a class="text-link" href="${h(n.href)}">Review event</a> · Available ${moment(n.delivery.availableAt,s.settings.timezone)}. External delivery not attempted.</p>${n.acknowledgedAt?`<p>You acknowledged this notice ${moment(n.acknowledgedAt,s.settings.timezone)}.</p>`:form('notice.acknowledge',back,exact(n),'Acknowledge activity notice')}</li>`).join('')}</ul>`,'','activity-inbox')
}
