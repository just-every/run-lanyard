import {html,t} from '../localization'
// CLOCK-008 on the phone clock: the job and cafe being worked, and the change-job controls.
import {h,rows,moment} from './shared'
const jobName=(s:any,id:string)=>rows(s,'jobs').find((j:any)=>j.id===id)?.name??(id?t(s,'Former job'):t(s,'No job'))
function current(s:any,open:any) {
 const last=(open.transfers??[]).at(-1);if(last)return {job:last.job,site:last.site}
 const shift=rows(s,'shifts').find((x:any)=>x.id===open.shiftId)
 return {job:shift?.job??'',site:shift?.site||rows(s,'staff').find((p:any)=>p.id===open.staffId)?.site||''}
}
/** What the open punch is worked as now, and each change so far. */
export function clockJobs(s:any,open:any,tz:string) {
 if(!open)return ''
 const now=current(s,open),at=(v:any)=>`${h(jobName(s,v.job))}${v.site?html(s)` at ${h(v.site)}`:''}`
 return html(s)`<span data-clock-job>Working ${at(now)}</span>${(open.transfers??[]).map((t:any)=>html(s)`<span>Changed to ${at(t)} · ${moment(t.at,tz)}</span>`).join('')}`
}
/** Beside clock-out: the person's own qualified jobs and eligible cafes (PEOPLE-002). */
export function transferFields(s:any,open:any) {
 const profile=rows(s,'workforce').find((r:any)=>r.staffId===s.actor.staffId)
 if(!profile?.jobs?.length)return ''
 const now=open?current(s,open):{job:'',site:''}
 const jobs=profile.jobs.map((id:string)=>html(s)`<option value="${h(id)}"${id===now.job?' selected':''}>${h(jobName(s,id))}</option>`).join('')
 const sites=profile.sites.length>1?html(s)`<label>Cafe<select name="transferSite">${profile.sites.map((v:string)=>html(s)`<option value="${h(v)}"${v===now.site?' selected':''}>${h(v)}</option>`).join('')}</select></label>`:''
 return html(s)`<div class="fields" data-transfer><label>Job<select name="transferJob">${jobs}</select></label>${sites}<button type="submit" class="secondary" data-command="clock.transfer" formnovalidate>Change job</button></div>`
}
