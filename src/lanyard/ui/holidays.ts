import {h,rows,manager,owner,person,card,form,disclosure,field,exact,hidden,empty} from './shared'
import {hours,money} from './format'

const back='/app/payroll#holidays'
const cafe=(site='')=>field('site','Cafe',site,'text','maxlength="80"')
const choice=(name:string,label:string,value:boolean)=>`<label>${h(label)}<select name="${h(name)}" aria-label="${h(label)}"><option value="true"${value?' selected':''}>Yes</option><option value="false"${value?'':' selected'}>No</option></select></label>`

function holidayForm(r:any={}) {
 return form('holiday.save',back,(r.id?exact(r):'')+`<div class="fields">${cafe(r.site)}${field('date','Holiday date',r.date??'','date','required')}${field('name','Holiday name',r.name??'','text','required maxlength="80"')}${choice('enabled','Included in calendar',r.enabled!==false)}</div>`,'Save holiday','','secondary')
}

function ruleForm(r:any={}) {
 return form('holidayrule.save',back,(r.id?exact(r):'')+`<div class="fields">${cafe(r.site)}${field('from','Effective from',r.from??'','date','required')}<label>Worked holiday premium<select name="mode" aria-label="Worked holiday premium"><option value="multiplier"${r.mode==='added'?'':' selected'}>Hourly rate multiplier</option><option value="added"${r.mode==='added'?' selected':''}>Added cents per hour</option></select></label>${field('value','Value: raw multiplier (at least 1) or added cents/hour (at least 0)',r.value??1,'number','required min="0" step="any"')}${field('nonWorkMinutes','Paid non-work minutes',r.nonWorkMinutes??0,'number','required min="0" max="1440" step="1"')}${choice('beforeAfter','Require attendance on the shifts before and after',Boolean(r.beforeAfter))}${field('code','Holiday payroll code',r.code??'','text','required maxlength="80"')}</div><p class="note">Enter 1.5 for time and a half, or choose added cents per hour and enter 250 for an extra $2.50/hour. The latest effective rule for the cafe applies.</p><p class="note">When attendance is required, the nearest published scheduled shift strictly before and after the holiday must each have approved time covering its full interval and payable minutes. Future or pending work waits for review; missing elapsed work makes the person ineligible.</p>`,'Save holiday rule','','secondary')
}

function calendar(s:any) {
 const list=[...rows(s,'holidays')].sort((a,b)=>a.date.localeCompare(b.date)||a.site.localeCompare(b.site))
 const items=list.map(r=>`<li><strong>${h(r.date)} · ${h(r.name)}</strong> · ${h(r.site)} · ${h(r.source==='federal'?'Federal observed':'Company')} · ${r.enabled?'Included':'Removed'}${owner(s)?disclosure('Edit holiday',holidayForm(r),false,'inline-menu'):''}</li>`).join('')
 const setup=owner(s)?disclosure('Seed observed US federal holidays',form('holiday.seed',back,`<div class="fields">${cafe()}${field('year','Calendar year','','number','required min="1971" max="9998" step="1"')}</div><p class="note">Seeding the same cafe and year again does not duplicate its federal dates.</p>`,'Seed federal calendar','','secondary'))+disclosure('Add a company holiday',holidayForm()):''
 return disclosure('Holiday calendar',(items?`<ul class="swap-list">${items}</ul>`:empty('No holidays in the calendar.','calendar'))+setup)
}

function rules(s:any) {
 const items=rows(s,'holidayrules').map(r=>`<li><strong>${h(r.site)}</strong> · from ${h(r.from)} · ${r.mode==='multiplier'?`${h(r.value)}× hourly rate`:`${h(money(r.value))}/hour added`} · ${h(hours(r.nonWorkMinutes))} paid non-work hrs · ${h(r.code)}<p class="note">Attendance before and after: ${r.beforeAfter?'required':'not required'}.</p>${disclosure('Edit rule',ruleForm(r),false,'inline-menu')}</li>`).join('')
 return disclosure('Holiday pay rules',(items?`<ul class="swap-list">${items}</ul>`:empty('No holiday pay rules configured.'))+disclosure('Add a holiday pay rule',ruleForm()))
}

function reviewTable(s:any,list:any[]) {
 if(!list.length)return empty('No holiday pay reviews yet.')
 return `<table class="list stack"><thead><tr><th>Person</th><th>Holiday</th><th>Eligibility</th><th class="num">Hours</th><th class="num">Cost</th><th>Approval</th></tr></thead><tbody>${list.map(r=>{
  const approve=owner(s)&&r.kind==='non-work'&&r.eligible&&!r.pending?form('holidaypay.approve',back,hidden('staffId',r.staffId)+hidden('date',r.date)+hidden('site',r.site)+hidden('digest',r.digest)+field('reference','Source record reference','','text','required maxlength="120"')+'<p class="note">Use the same source reference for this paid holiday in ACA records so its service hours count once.</p>','Approve non-work holiday pay','','secondary small'):''
  return `<tr><td data-label="Person">${h(r.name)}</td><td data-label="Holiday">${h(r.holiday)}<small>${h(r.date)} · ${h(r.site)} · ${h(r.kind==='worked'?'Worked':'Non-work')}</small></td><td data-label="Eligibility">${r.eligible?'Eligible':'Ineligible'}${r.pending?' · Pending':''}${r.reasons.map((reason:string)=>`<small>${h(reason)}</small>`).join('')}</td><td class="num" data-label="Hours">${h(hours(r.minutes))}</td><td class="num" data-label="Cost">${r.costCents===null?'Rate missing':h(money(r.costCents))}</td><td data-label="Approval">${approve|| (r.pending?'Awaiting attendance review':r.kind==='worked'?'With worked time':'—')}</td></tr>`
 }).join('')}</tbody></table>`
}

function reviews(s:any) {
 const list=rows(s,'holidayReviews'),dates=[...new Set(list.map(r=>r.date))].sort().reverse()
 return dates.map(date=>disclosure(`Eligibility · ${date}`,reviewTable(s,list.filter(r=>r.date===date)))).join('')||empty('No holiday pay reviews yet.')
}

export function holidaysCard(s:any) {
 if(!manager(s))return ''
 const paid=rows(s,'holidaypay')
 const approved=paid.length?disclosure('Approved non-work holiday pay',`<ul class="swap-list">${paid.map(r=>`<li><strong>${h(person(s,r.staffId))}</strong> · ${h(r.date)} · ${h(hours(r.minutes))} hrs · ${h(money(r.costCents))} · ${h(r.code)}${owner(s)?disclosure('Correct non-work pay',form('holidaypay.correct',back,exact(r)+field('minutes','Correct paid minutes (zero reverses)',r.minutes,'number','required min="0" max="1440"')+field('reason','Correction reason','','text','required maxlength="500"'),'Approve correction','','secondary small')):''}</li>`).join('')}</ul>`):''
 return card('Holiday pay',calendar(s)+(owner(s)?rules(s):'')+reviews(s)+approved,'','holidays')
}

export function scheduleHolidays(s:any,w:any) {
 if(!manager(s))return ''
 const list=rows(s,'holidays').filter(r=>r.enabled&&w.days.includes(r.date)&&(!w.site||r.site===w.site))
 return list.length?card('Holiday schedule costs',`<p class="note">${list.map(r=>`${h(r.date)} · ${h(r.name)} · ${h(r.site)}`).join('<br>')}</p><p class="note">Scheduled labor includes additional holiday premiums at the site’s effective rule and retained job rates. Attendance eligibility remains subject to approved work.</p>`,'','holiday-schedule'):''
}
