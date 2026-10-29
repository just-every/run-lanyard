import {h,hidden,form,disclosure,moment} from './shared'
import {tradeoffExplanation} from './tradeoff'

const known=(n:any)=>typeof n==='number'?String(Math.round(n*100)/100):'unknown'
const hours=(n:any)=>typeof n==='number'?(n/60).toFixed(2):'unknown'
const usd=(n:any)=>typeof n==='number'?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100):'unknown'
const name=(s:any,id:string)=>s?.staff?.find((p:any)=>p.id===id)?.name??id
const cell=(label:string,value:any)=>`<td data-label="${h(label)}">${h(value)}</td>`
function metricTable(c:any) {
 const rows=[
  ['Undesirable-shift spread',known(c.low.measures.totals.spread),known(c.high.measures.totals.spread)],
  ['Mean preference gap (hours)',hours(c.low.measures.totals.meanGapMinutes),hours(c.high.measures.totals.meanGapMinutes)],
  ['Maximum preference gap (hours)',hours(c.low.measures.totals.maxGapMinutes),hours(c.high.measures.totals.maxGapMinutes)],
  ['Prefer-not violations',known(c.low.measures.totals.violations),known(c.high.measures.totals.violations)],
  ['Estimated cost (USD)',usd(c.low.cost.costCents),usd(c.high.cost.costCents)],
  ['Employer labor budget (USD)',usd(c.low.budget.limitCents),usd(c.high.budget.limitCents)],
  ['Budget status',c.low.budget.withinBudget===null?'unknown':c.low.budget.withinBudget?'Within budget':'Over budget',c.high.budget.withinBudget===null?'unknown':c.high.budget.withinBudget?'Within budget':'Over budget'],
  ['Demand gap (minutes)',known(c.low.service.uncoveredMinutes),known(c.high.service.uncoveredMinutes)],
  ['Covered shifts',known(c.low.coverage.shifts),known(c.high.coverage.shifts)],
  ['Covered minutes',known(c.low.coverage.minutes),known(c.high.coverage.minutes)],
 ]
 return `<table class="list stack"><thead><tr><th>Measure</th><th>Low fairness priority</th><th>High fairness priority</th></tr></thead><tbody>${rows.map(([label,low,high])=>`<tr>${cell('Measure',label)}${cell('Low fairness priority',low)}${cell('High fairness priority',high)}</tr>`).join('')}</tbody></table>`
}
function assignmentDiff(c:any,s:any) {
 const tz=s?.settings?.timezone??c.low.measures.timezone
 const rows=c.source.shifts.map((x:any)=>{
  const assigned=(v:any)=>v.assignments.find((a:any)=>a.slotId===x.id).staffId
  const low=assigned(c.low),high=assigned(c.high),changed=low!==x.staffId||high!==x.staffId
  return `<tr>${cell('Source shift',`${x.id} · revision ${x.revision}${changed?' · assignment changes':''}`)}<td data-label="Service slot">${moment(x.start,tz)} – ${moment(x.end,tz)}<small>${h(x.site||'Your cafe')} · ${h(x.job||'No job set')}${x.label?` · ${h(x.label)}`:''} · ${h(x.breakMinutes)} break minutes</small></td>${cell('Published assignment',name(s,x.staffId))}${cell('Low fairness priority',name(s,low))}${cell('High fairness priority',name(s,high))}</tr>`
 }).join('')
 return disclosure('Inspect assignment changes',`<p class="note">Source roster ${h(c.source.id)} · revision ${h(c.source.revision)}. Each row retains its source time, site, job and break; the alternatives change assignments.</p><table class="list stack"><thead><tr><th>Source shift</th><th>Service slot</th><th>Published assignment</th><th>Low fairness priority</th><th>High fairness priority</th></tr></thead><tbody>${rows}</tbody></table>`)
}
export function fairnessComparison(c:any,s:any,back:string) {
 if(!c)return ''
 const q=new URLSearchParams({week:c.week,site:c.site,weeks:String(c.weeks)})
 const prepare=(priority:string)=>c[priority].budget.limitCents!==null&&c[priority].budget.withinBudget!==true?`<p class="note">${h(priority)} fairness draft unavailable: the known labor budget is not met.</p>`:form('fairness.prepare',back,hidden('week',c.week)+hidden('site',c.site)+hidden('weeks',c.weeks)+hidden('priority',priority)+hidden('digest',c.digest),`Prepare ${priority} fairness draft`,'','secondary')
 const same=c.difference.coveredMinutes===0&&c.difference.coveredShifts===0
 const uncovered=c.uncovered.length?`<ul class="swap-list">${c.uncovered.map((x:any)=>`<li>${h(x.id)} · ${moment(x.start,s?.settings?.timezone??c.low.measures.timezone)} – ${moment(x.end,s?.settings?.timezone??c.low.measures.timezone)} · ${h(x.minutes)} minutes uncovered</li>`).join('')}</ul>`:'<p>No uncovered open shifts reported.</p>'
 return disclosure('Compare fairness priorities',`<p class="note">${h(c.method)}</p>${tradeoffExplanation(c)}${metricTable(c)}<p>High minus low estimated cost: <strong>${h(usd(c.difference.costCents))} USD</strong>. ${same?'Equal coverage: both alternatives cover the same number of shifts and minutes.':`Coverage difference: ${h(c.difference.coveredShifts)} shifts and ${h(c.difference.coveredMinutes)} minutes.`}</p><p class="note">${h(c.low.cost.label)}${c.high.cost.label!==c.low.cost.label?` · ${h(c.high.cost.label)}`:''}</p>${assignmentDiff(c,s)}${disclosure('Uncovered work',uncovered)}<p><a class="text-link" href="/api/lanyard/fairness/compare?${h(q)}" download="lanyard-fairness-comparison.json">Download comparison and calculation inputs (JSON)</a></p><p class="note">Prepare one alternative, then review and publish its exact draft revision through the schedule.</p><div class="row-actions">${prepare('low')}${prepare('high')}</div>`,true)
}

export function demandGenerationPanel(s:any,week:string,site:string,q:URLSearchParams,c?:any){
 const value=(key:string,fallback:string)=>q.get(key)??fallback
 const back='/app/schedule?'+new URLSearchParams({week,site,view:'draft'})
 const control=(key:string,label:string,fallback:string)=>`<label>${h(label)}<input name="${key}" value="${h(value(key,fallback))}" type="number" min="0" max="720" step="15" required></label>`
 const editor=`<form method="get" action="/app/schedule">${hidden('week',week)}${hidden('site',site)}${hidden('demandGenerate','1')}<p>Select service dates explicitly. Every hour needs a saved forecast, including zero-demand hours. Review these shift and unpaid-break inputs for this preview.</p><div class="fields"><label>Service dates, separated by commas<input name="dates" value="${h(value('dates',week))}" required></label>${control('minShiftMinutes','Minimum shift minutes','60')}${control('maxShiftMinutes','Maximum shift minutes','480')}${control('breakAfterMinutes','Break required from elapsed minutes','300')}${control('breakMinutes','Unpaid break minutes','30')}</div><button class="button secondary">Preview demand-generated shifts</button></form>`
 let result=''
 if(c){
  const metric=(key:string,label:string)=>`<li>${h(label)}: <strong>${h(known(c.service[key]))}</strong> minutes</li>`
  const inputs=['week','site','dates','minShiftMinutes','maxShiftMinutes','breakAfterMinutes','breakMinutes'].map(k=>hidden(k,Array.isArray(c[k])?c[k].join(','):c[k])).join('')
  const rows=c.generated.map((x:any)=>`<tr>${cell('Person',name(s,x.staffId))}<td data-label="Shift">${moment(x.start,s.settings.timezone)} – ${moment(x.end,s.settings.timezone)}</td>${cell('Job',s.jobs.find((j:any)=>j.id===x.job)?.name??x.job)}${cell('Unpaid break',x.breakMinutes+' minutes')}</tr>`).join('')
  const intervals=c.service.intervals.filter((x:any)=>x.requiredMinutes||x.scheduledMinutes).map((x:any)=>`<tr>${cell('Interval',`${x.date} ${x.hour}:00 · ${x.position}`)}${cell('Required',known(x.requiredMinutes))}${cell('Scheduled',known(x.scheduledMinutes))}${cell('Uncovered',known(x.uncoveredMinutes))}${cell('Excess',known(x.excessMinutes))}</tr>`).join('')
  result=`<div data-generation-preview><h3>${c.feasible?'Draft ready for preparation':'Generation refused'}</h3><p>${h(c.method)}</p><ul>${metric('requiredMinutes','Required')}${metric('scheduledMinutes','Scheduled')}${metric('uncoveredMinutes','Uncovered')}${metric('excessMinutes','Excess')}</ul><p>Scheduled wage, holiday and shift differential estimate: <strong>${h(usd(c.cost.costCents))}</strong> USD. Reviewed budget: <strong>${h(usd(c.budget.limitCents))}</strong> USD.</p><p>${c.preserved.length} unselected rows at this cafe and ${c.preservedOtherSites===null?'unselected work':c.preservedOtherSites+' rows'} at other cafes are retained. Open shifts are retained.</p>${c.infeasible.length?`<ul>${c.infeasible.map((x:string)=>`<li>${h(x)}</li>`).join('')}</ul>`:''}${c.rejections.length?disclosure('Constraint refusals',`<ul>${c.rejections.map((x:string)=>`<li>${h(x)}</li>`).join('')}</ul>`):''}<table class="list stack"><thead><tr><th>Person</th><th>Shift</th><th>Job</th><th>Unpaid break</th></tr></thead><tbody>${rows}</tbody></table>${disclosure('Review interval coverage',`<p>Unpaid breaks are apportioned evenly for coverage; this does not establish legal break placement.</p><table class="list stack"><thead><tr><th>Interval</th><th>Required</th><th>Scheduled</th><th>Uncovered</th><th>Excess</th></tr></thead><tbody>${intervals}</tbody></table>`)}${disclosure('Retained calculation inputs',`<pre style="white-space:pre-wrap;overflow-wrap:anywhere">${h(JSON.stringify({forecasts:c.versions,cost:c.cost,budget:c.budget},null,2))}</pre>`)}${c.feasible?form('demand.generate.prepare',back,inputs+hidden('digest',c.digest),'Prepare demand-generated draft','','secondary'):'<p>Change the missing or infeasible inputs and preview again. No draft was written.</p>'}<p>Preparation remains private. Review the complete schedule diff and publish separately; changed facts require a fresh preview.</p></div>`
 }
 return `<section class="card" id="demand-generation"><div class="card-head"><h2>Generate from demand</h2></div>${disclosure('Review demand generation',editor+result,Boolean(c))}</section>`
}
