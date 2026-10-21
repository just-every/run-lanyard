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
