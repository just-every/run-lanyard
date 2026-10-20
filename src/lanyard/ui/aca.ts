// ACA measurement reports and employer-recorded paid leave; filing stays with the filer.
import {h,rows,person,manager,owner,form,field,hidden,exact,disclosure,card,status,empty,textarea,venue} from './shared'
import {hours,dateKey} from './format'

const CATEGORIES=['vacation','holiday','illness','disability','layoff','jury','military','leave']
const label=(value:string)=>value==='full-time'?'Full-time':value==='not-full-time'?'Not full-time':'Pending measurement'
const average=(value:number)=>`${h(value.toFixed(1))} hrs/week`
const period=(start:string,end:string)=>`${h(start)} – ${h(end)}`

function evidence(row:any,asOfMonth:string) {
 const monthly=`<table class="list stack"><thead><tr><th>Month</th><th class="num">Service hours</th><th class="num">Planned hours</th><th>Monthly test</th></tr></thead><tbody>${row.monthly.map((m:any)=>`<tr><td>${h(m.month)}</td><td class="num" data-label="Service hours">${h(hours(m.totalMinutes))}</td><td class="num" data-label="Planned hours">${h(hours(m.plannedMinutes))}</td><td data-label="Monthly test">${m.month>=asOfMonth?`${m.month===asOfMonth?'In progress':'Upcoming'}${m.projectedFullTime?' · projected full-time':''}`:m.fullTime?'Full-time':'Not full-time'}</td></tr>`).join('')}</tbody></table>`
 const sources=row.sources.map((source:any)=>`<li>${h(source.kind)} · ${h(source.date)} · ${h(hours(source.minutes))} hrs${source.category?` · ${h(source.category)}`:''} · <code>${h(source.id)}</code> · revision ${h(source.revision)}${source.source?` · ${h(source.source)}`:''}${source.reference?` · reference ${h(source.reference)}`:''}</li>`).join('')
 const incomplete=(row.incomplete??[]).map((v:any)=>`${h(v.reason)} · <code>${h(v.id)}</code> · revision ${h(v.revision)}`).join('; ')
 return `${incomplete?`<p class="note">${h(row.name)} · excluded pending review: ${incomplete}</p>`:''}${disclosure(`${row.name} · monthly hours and sources`,`<p class="note">Monthly full-time test: 130 hours of service. Planned shifts are projections, not recorded service hours.</p>${monthly}${sources?`<h3>Sources</h3><ul>${sources}</ul>`:empty('No recorded sources in this measurement period.')}`)}`
}

function report(report:any,tz:string) {
 const plan=report.plan
 const table=`<table class="list stack"><thead><tr><th>Person</th><th>Service hours</th><th>Weekly average</th><th>Projected</th><th>Stability status</th></tr></thead><tbody>${report.rows.map((row:any)=>`<tr><td><strong>${h(row.name)}</strong><div class="note">Payroll ID: ${h(row.payrollId||'Not set')}</div></td><td data-label="Service hours"><strong>${h(hours(row.totalMinutes))} hrs</strong><div class="note">${h(hours(row.workedMinutes))} worked + ${h(hours(row.paidLeaveMinutes))} paid leave</div></td><td data-label="Weekly average">${average(row.averageWeeklyHours)}</td><td data-label="Projected">${average(row.projectedAverageWeeklyHours)}<div class="note">${h(hours(row.projectedMinutes))} hrs including ${h(hours(row.plannedMinutes))} planned</div>${row.warning?`<p class="note">${h(row.warning===true?'Published shifts project this person to a full-time threshold.':row.warning)}</p>`:''}</td><td data-label="Stability status">${status(row.status,label(row.status))}<div class="note">${row.status==='pending'?'Provisional · ':''}${period(row.stabilityStart,row.stabilityEnd)}</div></td></tr>`).join('')}</tbody></table>`
 return `<article><h3>${h(plan.name)}</h3><p class="note">Measurement ${period(plan.start,plan.end)} · administration through ${h(plan.adminEnd)} · stability through ${h(plan.stabilityEnd)} · plan revision ${h(plan.revision)} · as of ${h(report.asOf)}</p>${report.rows.length?table+report.rows.map((row:any)=>evidence(row,dateKey(report.asOf,tz).slice(0,7))).join(''):empty('No people in this measurement group.')}<p><a class="button secondary" href="/api/lanyard/aca/${encodeURIComponent(plan.id)}.csv">Download ACA hours CSV</a></p></article>`
}

function planForm(s:any) {
 const people=rows(s,'staff').filter(p=>p.active)
 return disclosure('Define a measurement plan',form('aca.plan.save','/app/payroll#aca',`<div class="fields">${field('name','Plan name','','text','required maxlength="120"')}${field('start','Measurement first day','','date','required')}${field('end','Measurement last day','','date','required')}${field('adminEnd','Administration last day','','date','required')}${field('stabilityEnd','Stability last day','','date','required')}</div><p class="note">Choose 3–12 whole calendar months, from the first day of a month to the last day of a month. Administration ends 0–90 days after measurement. Stability starts the following day and must last at least 6 months and at least the measurement period. A not-full-time person's stability period is capped at the measurement length.</p><fieldset><legend>Variable-hour employees in this group</legend>${people.map(p=>`<label class="check"><input type="checkbox" name="staffIds" value="${h(p.id)}"> ${h(p.name)}</label>`).join('')||'<p class="note">Add people in People before defining a group.</p>'}</fieldset>`,'Save measurement plan','','secondary'))
}

function creditFields(s:any,credit:any={}) {
 const people=rows(s,'staff').filter(p=>p.active||p.id===credit.staffId)
 const who=credit.id?hidden('staffId',credit.staffId)+`<p>${h(person(s,credit.staffId))}</p>`:`<label>Person<select name="staffId" required><option value="">Choose a person</option>${people.map(p=>`<option value="${h(p.id)}">${h(p.name)}</option>`).join('')}</select></label>`
 return `<div class="fields">${who}${field('date','Service date',credit.date??'','date','required')}${field('minutes','Paid non-work minutes',credit.minutes??'','number','required min="0" max="1440" step="1"')}<label>Category<select name="category" required>${CATEGORIES.map(c=>`<option value="${c}" ${credit.category===c?'selected':''}>${h(c[0].toUpperCase()+c.slice(1))}</option>`).join('')}</select></label>${field('reference','Employer record reference',credit.reference??'','text','required maxlength="160"')}</div>${textarea('reason','Reason',credit.reason??'','required maxlength="500" rows="2"')}`
}

function credits(s:any) {
 const list=[...rows(s,'acaCredits')].sort((a,b)=>b.date.localeCompare(a.date))
 const items=list.map(c=>`<li><strong>${h(person(s,c.staffId))}</strong> · ${h(c.date)} · ${h(hours(c.minutes))} hrs · ${h(c.category)} · reference ${h(c.reference)}<p class="note">${h(c.reason)} · revision ${h(c.revision)}</p>${c.versions?.length?disclosure(`${c.versions.length} earlier versions`,`<ul>${c.versions.map((v:any)=>`<li>Revision ${h(v.revision)} · ${h(v.date)} · ${h(hours(v.minutes))} hrs · ${h(v.category)} · reference ${h(v.reference)} · ${h(v.reason)}</li>`).join('')}</ul>`):''}${disclosure('Correct this credit',form('aca.credit.save','/app/payroll#aca',exact(c)+creditFields(s,c)+'<p class="note">Set minutes to zero to remove this credit from service hours. Earlier versions remain in the record.</p>','Save credit correction','','secondary'))}</li>`).join('')
 return disclosure('Employer-recorded paid leave',`<p class="note">Record paid non-work hours of service only. These are employer records, not provider-verified leave. Correct an existing credit instead of entering it again.</p>${items?`<ul class="swap-list">${items}</ul>`:empty('No paid non-work service credits recorded.')}${disclosure('Add a paid leave credit',form('aca.credit.save','/app/payroll#aca',creditFields(s),'Save paid leave credit','','secondary'))}`)
}

export function acaCard(s:any) {
 if(!manager(s))return ''
 const reports=rows(s,'acaReports')
 return card('ACA hours measurement',`<p class="note">Approved worked time plus employer-recorded paid leave are hours of service. Look-back full-time status uses a 30-hour weekly average over the whole measurement period; the separate monthly test is 130 service hours. Pending measurements show a projection from recorded service and remaining published shifts. Download the hours file for your payroll provider or Willow to prepare 1094-C and 1095-C filings. Lanyard does not send or file it.</p>${reports.length?reports.map(r=>report(r,venue(s))).join(''):empty('No ACA measurement plans defined.')}${owner(s)?planForm(s)+credits(s):''}`,'','aca')
}

export function acaWarnings(s:any) {
 if(!manager(s))return ''
 const warnings=rows(s,'acaReports').flatMap(report=>report.rows.filter((row:any)=>row.warning).map((row:any)=>`<li><strong>${h(row.name)}</strong> · ${h(report.plan.name)} · ${average(row.projectedAverageWeeklyHours)} projected (${h(hours(row.totalMinutes))} service + ${h(hours(row.plannedMinutes))} planned hrs)${typeof row.warning==='string'?`<p class="note">${h(row.warning)}</p>`:''}</li>`))
 return warnings.length?card('ACA projected hours',`<p class="note">Recorded service plus future published shifts project these people toward the full-time threshold for their measurement period.</p><ul class="swap-list">${warnings.join('')}</ul><p><a class="text-link" href="/app/payroll#aca">Review ACA measurement reports</a></p>`,'','aca-warnings'):''
}
