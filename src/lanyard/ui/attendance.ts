// CLOCK-004 screens: the owner's attendance rule per cafe (on People) and, on Time, the managers'
// live attendance board with late and no-show alerts, who is handling each, and the cover action.
import {h,rows,form,field,hidden,card,disclosure,empty,moment} from './shared'
import {sitesOf} from './week'
import {span} from './format'

function fields(s:any,r:any={}) {
 const where=r.revision?hidden('site',r.site)+hidden('revision',r.revision):`<label>Cafe<select name="site">${(sitesOf(s).length?sitesOf(s):['']).map(v=>`<option value="${h(v)}">${h(v||'Your cafe')}</option>`).join('')}</select></label>`
 return `<div class="fields">${where}${field('graceMinutes','Late after (minutes past the shift start)',r.graceMinutes??5,'number','required min="0" max="60"')}${field('noShowMinutes','No-show after (minutes past the start)',r.noShowMinutes??30,'number','required min="5" max="240"')}</div>`
}
export function attendRulesCard(s:any) {
 const list=rows(s,'attendrules')
 const table=list.length?`<table class="list stack"><thead><tr><th>Cafe</th><th>Alerts</th><th><span class="sr-only">Edit</span></th></tr></thead><tbody>${list.map(r=>`<tr><td data-label="Cafe">${h(r.site||'Your cafe')}</td><td data-label="Alerts">Late after ${h(r.graceMinutes)} min · no-show after ${h(r.noShowMinutes)} min</td><td>${disclosure('Edit',form('attendrule.save','people',fields(s,r),'Save attendance rule','','secondary'),false,'inline-menu')}</td></tr>`).join('')}</tbody></table>`:empty('No attendance alerts: the board still shows who is in.')
 return card('Attendance alerts',`<p class="note">When nobody has clocked in for a shift by the late point, its cafe’s managers see a late alert; at the no-show point it escalates. Only a clock-in or approved time closes an alert.</p>${table}${disclosure('Add an attendance rule',form('attendrule.save','people',fields(s),'Save attendance rule','','secondary'))}`,'','attend-rules')
}
const label:Record<string,string>={scheduled:'Scheduled',due:'Due now',present:'Present','on break':'On break',done:'Clocked out','approved time':'Approved time',missing:'Not clocked in','no-show':'No-show'}
export function attendanceCard(s:any,tz:string,back:string) {
 const list=rows(s,'attendance');if(!list.length)return ''
 const line=(r:any)=>{
  const notes=[...(r.lateMinutes?[`${r.lateMinutes} min late`]:[]),...(r.punch?[`in ${r.punch.start.slice(11,16)} UTC`]:[]),...(r.punch?.offlineMinutes>2?[`captured offline, received ${r.punch.offlineMinutes} min later`]:[]),...(r.wrongSite?[`clocked at ${r.punch.seenAt}`]:[]),...r.conflicts]
  const alert=r.alert?`<p class="note"><strong>${r.alert.kind==='no-show'?'No-show':'Late'}</strong> since ${moment(r.alert.since,tz)}${r.alert.acknowledged.map((a:any)=>` · handled by ${h(a.byName)}: “${h(a.note)}”`).join('')}</p>${form('attendance.acknowledge',back,hidden('shiftId',r.shiftId)+field('note','What you are doing','','text','required maxlength="280"'),'I’m handling it','','secondary small')}${form('shift.callout',back,hidden('id',r.shiftId)+hidden('revision',r.revision)+hidden('note','No-show: cover needed'),'Find cover','','secondary small')}`:''
  return `<li><strong>${h(r.name)}</strong> · ${h(span(r.start,r.end,tz))}${r.site?` · ${h(r.site)}`:''} · ${h(label[r.status]??r.status)}${notes.length?` · ${h(notes.join(' · '))}`:''}${alert}</li>`
 }
 return card('Live attendance',`<p class="note">From the clock events Lanyard has received; a published or confirmed shift never counts as worked.</p><ul class="swap-list">${list.map(line).join('')}</ul>`,`<p class="card-note">${h(list.filter(r=>r.alert).length)} alert${list.filter(r=>r.alert).length===1?'':'s'}</p>`,'attendance')
}
