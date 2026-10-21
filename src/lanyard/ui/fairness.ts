// FAIR-001 uses the existing disclosure, filter and responsive report-table patterns.
import {h,card,hidden,disclosure,field,form,rows,exact,staffSelect,manager} from './shared'
import {fairnessComparison} from './fairness-compare'
const hours=(n:any)=>typeof n==='number'?(n/60).toFixed(2):'unknown'
const number=(n:any)=>typeof n==='number'?String(Math.round(n*100)/100):'unknown'
const share=(n:any)=>typeof n==='number'?`${(n*100).toFixed(2)}%`:'unknown'
const name=(s:any,id:string)=>s?.staff?.find((p:any)=>p.id===id)?.name??id
const reasons=(v:any)=>Array.isArray(v)?v.map(x=>typeof x==='string'?x:JSON.stringify(x)).join('; '):v?String(v):'None'
const cell=(label:string,value:any)=>`<td data-label="${h(label)}">${h(value)}</td>`
const table=(labels:string[],body:string)=>`<table class="list stack"><thead><tr>${labels.map(v=>`<th>${h(v)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`
const evidence=(title:string,value:any)=>disclosure(title,`<pre>${h(JSON.stringify(value,null,2))}</pre>`)

function preferenceInputs(r:any) {
 const groups=r.groups.map((g:any)=>`<li>${h(g.position||'No position set')}: mean gap ${hours(g.meanGapMinutes)} hours; maximum ${hours(g.maxGapMinutes)} hours · ${h(g.samples)} known person-weeks, ${h(g.excluded)} unknown.${g.reasons?` ${h(reasons(g.reasons))}`:''}</li>`).join('')
 const body=r.rows.map((x:any)=>`<tr>${cell('Person / week',`${x.name||x.staffId} · ${x.week}`)}${cell('Scheduled hours',hours(x.scheduledMinutes))}${cell('Preferred hours',hours(x.preferredMinutes))}${cell('Absolute gap',hours(x.gapMinutes))}${cell('Preferred shifts',`${x.preferredShifts} fully inside preferred blocks${x.unknownBlockShifts?` · ${x.unknownBlockShifts} unknown`:''}`)}${cell('Evidence gaps',reasons(x.reasons))}</tr>`).join('')
 return `<ul class="swap-list">${groups||'<li>No people in this cafe.</li>'}</ul>${table(['Person / week','Scheduled hours','Preferred hours','Absolute gap','Preferred shifts','Evidence gaps'],body)}`
}
function undesirableInputs(r:any,s:any) {
 if(!r.undesirable)return ''
 const u=r.undesirable
 const groups=u.groups.map((g:any)=>`<h4>${h(g.position||'No position set')} · cohort ${h(g.cohortId||'unknown')}</h4><p>Spread: ${h(number(g.spread))} shifts · standard deviation: ${h(number(g.standardDeviation))}. ${h(reasons(g.reasons))}</p>${table(['Person','Undesirable shifts','Tags'],g.counts.map((x:any)=>`<tr>${cell('Person',name(s,x.staffId))}${cell('Undesirable shifts',number(x.count))}${cell('Tags',Array.isArray(x.tags)?x.tags.join(', '):Object.entries(x.tags).map(([tag,count])=>`${tag}: ${count}`).join(', '))}</tr>`).join(''))}`).join('')
 return disclosure('Undesirable-shift distribution',`<p class="note">Spread is the highest minus lowest count within an eligible role/site cohort, including people with no assignments. Tags are selected by the employer.</p>${groups||'<p>No known eligible cohorts.</p>'}<p class="note">${h(reasons(u.reasons))}</p>${evidence('Inspect tagged shift inputs',u.inputs)}${evidence('Inspect employer tag policy',u.policy)}`)
}
function violationInputs(r:any) {
 if(!r.violations)return ''
 const v=r.violations
 return disclosure('Prefer-not violations',`<p>Known violation count: <strong>${h(number(v.count))}</strong> · shifts with unknown preferences: ${h(number(v.unknown))}.</p><p class="note">${h(reasons(v.reasons))}</p>${evidence('Inspect prefer-not shift inputs',v.inputs)}`)
}
function equityInputs(r:any,s:any) {
 if(!r.equity)return ''
 const e=r.equity
 const groups=e.groups.map((g:any)=>`<h4>${h(g.position||'No position set')} · cohort ${h(g.cohortId||'unknown')}</h4><p>Extra hours offered: ${hours(g.totalOfferedMinutes)} · requested: ${hours(g.totalRequestedMinutes)}. ${h(reasons(g.reasons))}</p>${table(['Person','Offered hours','Requested hours','Offered share','Requested share','Share gap','Evidence gaps'],g.rows.map((x:any)=>`<tr>${cell('Person',name(s,x.staffId))}${cell('Offered hours',hours(x.offeredMinutes))}${cell('Requested hours',hours(x.requestedMinutes))}${cell('Offered share',share(x.offeredShare))}${cell('Requested share',share(x.requestedShare))}${cell('Share gap',share(x.shareGap))}${cell('Evidence gaps',reasons(x.reasons))}</tr>`).join(''))}`).join('')
 return disclosure('Extra-hours equity',`<p class="note">Offers are compared with each eligible part-time employee's explicitly requested extra minutes per week. Missing requests stay unknown. ${h(reasons(e.reasons))}</p>${groups||'<p>No extra-hours groups.</p>'}${evidence('Inspect extra-hours inputs',e.inputs)}${evidence('Missing historical offer logs',e.missingLogs)}`)
}
function cohortInputs(r:any,s:any) {
 if(!r.cohorts)return ''
 const c=r.cohorts
 const body=c.records.map((x:any)=>`<tr>${cell('Cohort',`${x.id} · revision ${x.revision}`)}${cell('Role / cafe',`${x.position} · ${x.site||'Your cafe'}`)}${cell('Effective dates',`${x.from} – ${x.until||'onward'}`)}${cell('Confirmed members',x.members.map((m:any)=>name(s,m.staffId)).join(', '))}${cell('Confirmation',`${x.recordedAt||''} · ${x.basis||''}`)}</tr>`).join('')
 return disclosure('Eligibility evidence',`<p class="note">Employer confirmation and effective dates establish the eligible population. Missing historical membership stays unknown.</p>${table(['Cohort','Role / cafe','Effective dates','Confirmed members','Confirmation'],body)}${evidence('Unknown membership and reasons',c.unknownMembership)}${evidence('Missing effective eligibility dates',c.missingDates)}${evidence('Assignments without confirmed eligibility',c.unconfirmedShifts)}${c.reasons?`<p>${h(reasons(c.reasons))}</p>`:''}`)
}
function policyForm(r:any,s:any,back:string) {
 const p=rows(s,'fairnesspolicies').find(x=>x.site===r.site),tags=['closing','close-then-open','weekend','holiday']
 return disclosure('Employer undesirable-shift policy',form('fairness.policy.save',back,hidden('site',r.site)+(p?hidden('revision',p.revision):'')+`<p class="note">Choose the tags your employer considers undesirable. Times use the cafe time zone.</p><div class="fields">${tags.map(tag=>`<label class="check"><input type="checkbox" name="tags" value="${tag}" ${p?.tags.includes(tag)?'checked':''}> ${h(tag)}</label>`).join('')}${field('closingTime','Closing threshold',p?.closingTime??'','time','required')}${field('openingTime','Opening threshold',p?.openingTime??'','time','required')}${field('closeOpenHours','Maximum hours from closing to opening',p?.closeOpenHours??'','number','required min="1" max="48"')}</div>`,'Save fairness policy','','secondary'))
}
function cohortForm(r:any,s:any,back:string,old?:any) {
 const team=rows(s,'staff').filter(p=>p.active&&!p.erased_at)
 const members=old?.members.map((m:any)=>m.staffId)??[]
 const identity=hidden('site',r.site)+(old?exact(old)+hidden('position',old.position)+hidden('from',old.from):field('position','Eligible role or job','','text','required maxlength="80"')+field('from','Effective first day',r.week,'date','required'))
 const body=`<p class="note">Confirm the complete eligible population for this cafe and role, including people with no assignments. Confirm the effective dates from employment and qualification records; recording this today does not prove past eligibility.</p><div class="fields">${identity}${field('until','Effective last day (optional)',old?.until??'','date')}<label>Employer-confirmed eligible people<select name="staffIds" multiple required>${team.map(p=>`<option value="${h(p.id)}" ${members.includes(p.id)?'selected':''}>${h(p.name)} · ${h(p.position||'No position set')}</option>`).join('')}</select></label></div>`
 return disclosure(old?`Edit cohort: ${old.position} · ${old.from}`:'Confirm an eligible cohort',form('fairness.cohort.save',back,body,'Confirm eligible cohort','','secondary'))
}
function requestForm(r:any,s:any,back:string,old?:any) {
 const identity=old?exact(old)+hidden('staffId',old.staffId)+`<p>${h(name(s,old.staffId))}</p>`:staffSelect(s)
 return disclosure(old?`Edit extra-hours request: ${name(s,old.staffId)} · ${old.from}`:'Record an extra-hours request',form('fairness.request.save',back,`<p class="note">Record the employee's requested extra minutes per week, separately from their preferred total hours. Zero means no extra hours requested.</p><div class="fields">${identity}${field('from','Effective first day',old?.from??r.week,'date','required')}${field('until','Effective last day (optional)',old?.until??'','date')}${field('minutes','Requested extra minutes per week',old?.minutes??'','number','required min="0" max="10080"')}</div>`,'Save extra-hours request','','secondary'))
}
function configuration(r:any,s:any,back:string) {
 if(!s||!manager(s))return ''
 const cohorts=rows(s,'fairnesscohorts').filter(x=>x.site===r.site),staffIds=new Set(rows(s,'staff').filter(x=>x.site===r.site).map(x=>x.id))
 const requests=rows(s,'fairnessrequests').filter(x=>staffIds.has(x.staffId))
 return disclosure('Fairness inputs and employer confirmation',`${policyForm(r,s,back)}${cohortForm(r,s,back)}${cohorts.map(x=>cohortForm(r,s,back,x)).join('')}${requestForm(r,s,back)}${requests.map(x=>requestForm(r,s,back,x)).join('')}`)
}
export function fairnessCard(r:any,comparison?:any,s?:any) {
 if(!r)return ''
 const query=new URLSearchParams({week:r.week,site:r.site,weeks:String(r.weeks)})
 const back='/app/schedule?'+new URLSearchParams({week:r.week,site:r.site,fairWeeks:String(r.weeks),...(comparison?{fairCompare:'1'}:{})})
 const filter=`<form class="filter" method="get" action="/app/schedule">${hidden('week',r.week)}${hidden('site',r.site)}<label>Trailing weeks<input type="number" name="fairWeeks" min="1" max="52" value="${h(r.weeks)}" required></label><button class="button secondary">Show preference inputs</button><button class="button secondary" name="fairCompare" value="1">Compare fairness priorities</button></form>`
 const totals=r.totals?`<p>Undesirable-shift spread: <strong>${h(number(r.totals.spread))}</strong> · mean preference gap: <strong>${hours(r.totals.meanGapMinutes)} hours</strong> · maximum gap: <strong>${hours(r.totals.maxGapMinutes)} hours</strong> · prefer-not violations: <strong>${h(number(r.totals.violations))}</strong>.</p><p class="note">${h(reasons(r.totals.reasons))}</p>`:''
 const intro=`<p class="note">${h(r.first)}–${h(r.last)} · ${h(r.site||'Your cafe')} · ${h(r.timezone)}. ${h(r.cohort||'Historical eligibility uses employer-confirmed effective cohorts.')} Missing preferences or unpublished weeks stay unknown. A midweek change in preferred hours is unresolved. Feedback ratings and flags are never inputs.</p>`
 return card('Preference inputs',disclosure('Inspect preference gaps',`${intro}${filter}${totals}<p><a class="text-link" href="/api/lanyard/fairness?${h(query)}" download="lanyard-preference-inputs.json">Download calculation inputs (JSON)</a></p>${preferenceInputs(r)}${undesirableInputs(r,s)}${violationInputs(r)}${equityInputs(r,s)}${cohortInputs(r,s)}${fairnessComparison(comparison,s,back)}${configuration(r,s,back)}`),'','fairness')
}
