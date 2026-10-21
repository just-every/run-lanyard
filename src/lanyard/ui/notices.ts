import {h,rows,manager,card,disclosure,form,field,hidden,moment} from './shared'
const fields=[['shiftLeadMinutes','Shift reminder lead (minutes)'],['ackMinutes','Acknowledgment deadline after publication (minutes)'],['offerLeadMinutes','Offer expiry lead (minutes)'],['exceptionMinutes','Missed punch / break review delay (minutes)'],['reviewMinutes','Timesheet review cutoff after period end (minutes)'],['payrollLeadMinutes','Payroll reminder before period end (minutes)'],['escalationMinutes','Escalate unresolved item after (minutes)']]
export function noticeInbox(s:any,back:string,site:string) {
 const notices=rows(s,'notices'),rule=rows(s,'noticerules').find(r=>r.site===site)
 const list=notices.length?`<ul>${notices.map(n=>`<li><strong>${n.escalation?'Escalation: ':''}${h(n.label)}</strong> · ${moment(n.due,s.settings.timezone)}${n.escalationState?` · ${h(n.escalationState)}`:''}</li>`).join('')}</ul>`:'<p>No reminders due.</p>'
 const settings=manager(s)?disclosure('Reminder settings',`<p>Blank turns a reminder off. Late and no-show reminders reuse the attendance rules. Escalations go once to the owner; a handling note leaves the item open.</p>${form('noticerule.save',back,field('site','Cafe',site)+hidden('revision',rule?.revision??'')+fields.map(([key,label])=>field(key,label,rule?.[key]??'','number','min="0" max="44640" step="1"')).join(''),'Save reminder settings')}`):''
 return card(`Reminder inbox · ${notices.length}`,`<p>In Lanyard only; push, email and SMS come with NOTICE-001.</p>${list}${settings}`,'','reminder-inbox')
}
