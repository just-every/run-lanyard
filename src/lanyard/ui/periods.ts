import {localDay,localWeekday,html,t as tr} from '../localization'
// TIME-004 screens: pay periods on Payroll (the owner defines, locks, reopens with a reason and
// closes with the provider reference; managers sign off), and the employee's signoff on Time.
import {h,rows,form,field,exact,card,disclosure,empty,owner,manager,status,person,moment} from './shared'
import {day,dateKey} from './format'
import {venue} from './shared'

const range=(s:any,r:any)=>`${localDay(s,r.start)} – ${localDay(s,r.end)}`
const signed=(s:any,r:any,role:string)=>r.signoffs.some((x:any)=>x.role===role&&x.by===s.actor.id)
function actions(s:any,r:any) {
 const out:string[]=[]
 if(r.status==='open'&&manager(s)&&!signed(s,r,'manager'))out.push(form('period.signoff','payroll',exact(r),'Sign off as manager','','secondary small'))
 if(r.status==='open'&&owner(s))out.push(form('period.lock','payroll',exact(r),'Lock period','','primary small'))
 if(r.status==='locked'&&owner(s))out.push(disclosure('Reopen',form('period.reopen','payroll',exact(r)+field('reason','Reason','','text','required maxlength="500"'),'Reopen period','','secondary'),false,'inline-menu'),disclosure('Close after the provider run',form('period.close','payroll',exact(r)+field('reference','Provider reference','','text','required maxlength="120"')+'<p class="note">Your record of the provider run; Lanyard does not check it with the provider.</p>','Close period','','secondary'),false,'inline-menu'))
 return out.join('')
}
export function periodsCard(s:any,tz:string) {
 const list=[...rows(s,'periods')].sort((a,b)=>b.start.localeCompare(a.start))
 const items=list.map(r=>`<li><strong>${h(range(s,r))}</strong>${r.groupName?` · ${h(r.groupName)} · pay date ${h(day(r.payDate))}`:''} · ${status(r.status)} · ${h(r.signoffs.filter((x:any)=>x.role==='employee').length)} employee and ${h(r.signoffs.filter((x:any)=>x.role==='manager').length)} manager signoffs${r.reference?` · provider reference ${h(r.reference)}`:''}${r.reopens.map((x:any)=>`<div class="note">Reopened ${moment(x.at,tz)} by ${h(person(s,x.by))}: ${h(x.reason)}</div>`).join('')}${actions(s,r)}</li>`).join('')
 const add=owner(s)?disclosure('Define a pay period',form('period.save','payroll',`<div class="fields">${field('start','First day','','date','required')}${field('end','Last day','','date','required')}</div>`,'Save pay period','','secondary')):''
 return card('Pay periods',`<p class="note">Time in an open pay period waits for its lock before payroll. A locked period's time cannot change until the owner reopens it with a reason, which clears its signoffs. After it closes, corrections and late time export as linked adjustments.</p>${items?`<ul class="swap-list">${items}</ul>`:empty('No pay periods defined: approved time goes to payroll as soon as it is approved.')}${add}`,'','pay-periods')
}
/** The employee's signoff for open periods holding their time. */
export function signoffCard(s:any) {
 const mine=rows(s,'periods').filter(r=>(!r.groupId||rows(s,'paygroups').some(g=>g.id===r.groupId&&g.staffIds.includes(s.actor.staffId)))&&r.status==='open'&&rows(s,'timesheets').some(t=>t.staffId===s.actor.staffId&&dateKey(t.start,venue(s))>=r.start&&dateKey(t.start,venue(s))<=r.end)&&!r.signoffs.some((x:any)=>x.role==='employee'))
 return mine.length?card(tr(s,'Sign off your hours'),mine.map(r=>html(s)`<p>${h(range(s,r))}${form('period.signoff','time',exact(r),tr(s,'Sign off my hours'),'','primary small')}</p>`).join(''),'','signoff'):''
}
