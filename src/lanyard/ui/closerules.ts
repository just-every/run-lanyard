// TIME-007 screens: the owner's clock-out rule per cafe (on People), and on Time the employee's
// in-app reminder with a confirm-or-correct form and the managers' list of provisionally closed punches.
import {h,rows,form,field,hidden,utc,exact,card,disclosure,empty,person,moment} from './shared'
import {sitesOf} from './week'
import {clock} from './format'

function fields(s:any,r:any={}) {
 const where=r.revision?hidden('site',r.site)+hidden('revision',r.revision):`<label>Cafe<select name="site">${(sitesOf(s).length?sitesOf(s):['']).map(v=>`<option value="${h(v)}">${h(v||'Your cafe')}</option>`).join('')}</select></label>`
 return `<div class="fields">${where}${field('graceMinutes','Remind after the scheduled end (minutes)',r.graceMinutes??15,'number','required min="0" max="240"')}${field('capHours','Longest open punch (hours)',r.capHours??12,'number','required min="1" max="24"')}</div>`
}
export function closeRulesCard(s:any) {
 const list=rows(s,'closerules')
 const table=list.length?`<table class="list stack"><thead><tr><th>Cafe</th><th>Reminder</th><th>Longest punch</th><th><span class="sr-only">Edit</span></th></tr></thead><tbody>${list.map(r=>`<tr><td data-label="Cafe">${h(r.site||'Your cafe')}</td><td data-label="Reminder">${h(r.graceMinutes)} min after the scheduled end</td><td data-label="Longest punch">${h(r.capHours)} hours</td><td>${disclosure('Edit',form('closerule.save','people',fields(s,r),'Save rule','','secondary'),false,'inline-menu')}</td></tr>`).join('')}</tbody></table>`:empty('No clock-out rules: a forgotten clock-out stays open until someone closes it.')
 return card('Forgotten clock-outs',`<p class="note">A punch still open after the reminder point stops counting at the scheduled end (or at the longest punch when there is no shift) and waits for the employee or a manager to confirm or correct the end. The reminder shows in Lanyard; no push or text message is sent.</p>${table}${disclosure('Add a rule',form('closerule.save','people',fields(s),'Save rule','','secondary'))}`,'','close-rules')
}
const confirmForm=(k:any,back:string)=>form('time.confirm',back,`${exact(k)}${utc('end','Work ended',k.provisional.end)}${field('breakMinutes','Meal minutes',0,'number','required min="0" max="1440"')}${field('reason','Reason (optional)','','text','maxlength="500"')}`,'Confirm end time','','primary')
/** The employee's reminder for their own provisionally closed punch. */
export function reminderCard(s:any,tz:string,back:string) {
 const k=rows(s,'clocks').find(r=>r.staffId===s.actor.staffId&&r.provisional);if(!k)return ''
 return card('Clock-out reminder',`<p>You clocked in at ${moment(k.start,tz)} and have not clocked out. Your punch stopped counting at ${h(clock(k.provisional.end,tz))} and is not paid until you confirm or correct when you finished.</p>${confirmForm(k,back)}`,'','clock-reminder')
}
/** Managers: every provisionally closed punch, each confirmable or correctable. */
export function provisionalCard(s:any,tz:string,back:string) {
 const list=rows(s,'clocks').filter(r=>r.provisional&&r.staffId!==s.actor.staffId);if(!list.length)return ''
 return card('Provisionally closed',`<p class="note">These punches were never clocked out. Each stays out of approval and payroll until its end is confirmed or corrected.</p><ul class="swap-list">${list.map(k=>`<li><strong>${h(person(s,k.staffId))}</strong> · in ${moment(k.start,tz)} · stopped at ${h(clock(k.provisional.end,tz))}${disclosure('Confirm or correct',confirmForm(k,back),false,'inline-menu')}</li>`).join('')}</ul>`,'','provisional')
}
