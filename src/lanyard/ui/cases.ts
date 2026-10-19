// TIME-003 on Time: managers' open exceptions (each resolved with a reason), and the employee's
// missing-punch and correction requests with their attestation, and confirmation of time a
// manager entered for them.
import {h,rows,form,field,utc,exact,card,person,disclosure} from './shared'
import {span} from './format'

const open=(t:any)=>t.status!=='superseded'&&t.exceptions?.length&&!t.resolution
export function exceptionsCard(s:any,tz:string,back:string) {
 const list=rows(s,'timesheets').filter(t=>open(t)&&t.staffId!==s.actor.staffId);if(!list.length)return ''
 return card('Open exceptions',`<p class="note">Each stays open until a manager resolves it with a reason the employee can read.</p><ul class="swap-list">${list.map(t=>`<li><strong>${h(person(s,t.staffId))}</strong> · ${h(span(t.start,t.end,tz))} · ${h(t.exceptions.join(', '))} · ${h(t.status)}${t.attestation?' · attested':''}${disclosure('Resolve',form('time.resolve',back,`${exact(t)}${field('reason','Resolution','','text','required maxlength="500"')}`,'Resolve','','secondary'),false,'inline-menu')}</li>`).join('')}</ul>`,'','exceptions')
}
const attest='<label class="check"><input type="checkbox" name="attest" required> I confirm these times and breaks are accurate.</label>'
export function myRequestsCard(s:any,tz:string,back:string) {
 const mine=rows(s,'timesheets').filter(t=>t.staffId===s.actor.staffId)
 const confirm=mine.filter(t=>!t.clockId&&!t.requested&&!t.employeeConfirmed&&['submitted','approved'].includes(t.status)).map(t=>`<li>Entered for you: ${h(span(t.start,t.end,tz))} · ${h(t.reason)}${form('time.acknowledge',back,exact(t),'Confirm','','secondary small')}</li>`).join('')
 const resolved=mine.filter(t=>t.resolution).map(t=>`<li>${h(span(t.start,t.end,tz))} · ${h(t.exceptions.join(', '))} resolved: ${h(t.resolution.reason)}</li>`).join('')
 const request=disclosure('Request missing or corrected time',form('time.request',back,`${utc('start','Work started')}${utc('end','Work ended')}${field('breakMinutes','Meal minutes',0,'number','required min="0" max="1440"')}${field('reason','What happened','','text','required maxlength="500"')}<label>Corrects (optional)<select name="corrects"><option value="">A missing punch</option>${mine.filter(t=>t.status==='approved').map(t=>`<option value="${h(t.id)}">${h(span(t.start,t.end,tz))}</option>`).join('')}</select></label>${attest}`,'Send for approval','','secondary'))
 return card('Time requests',`${confirm||resolved?`<ul class="swap-list">${confirm}${resolved}</ul>`:''}${request}`,'','time-requests')
}
