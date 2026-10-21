// FAIR-001: deterministic assignment alternatives for existing service slots.
// Slot times, jobs, sites and unpaid breaks never change; publication stays human.
import {type State,type Actor,type Row,type Context,manager,need,keys,sha,canonical,text} from './model'
import {preferenceReport} from './fairness'
import {eligibleMembers} from './fairness-policy'
import {conflicts,draftWeek} from './roster'
import {localDate} from './settings'
import {rateBasis} from './workforce'
import {scheduledHolidayCost} from './holidays'
import {explainAlternatives} from './tradeoff'

const positionOf=(s:State,x:Row)=>s.jobs.find(j=>j.id===x.job)?.name??s.staff.find(p=>p.id===x.staffId)?.position??''
const input=(x:Row)=>({staffId:x.staffId,start:x.start,end:x.end,breakMinutes:x.breakMinutes,label:x.label??'',site:x.site??'',job:x.job??''})
function trialState(s:State,week:string,slots:Row[],rows:Row[]):State {
 const ids=new Set(slots.map(x=>x.id))
 return {...s,shifts:s.shifts.map(x=>ids.has(x.id)?rows.find(r=>r.id===x.id)!:x)}
}
function cost(s:State,rows:Row[]) {
 const inputs=rows.map(x=>{const basis=rateBasis(s,x.staffId,x),holiday=scheduledHolidayCost(s,{...x,rateBasis:basis});return {shiftId:x.id,staffId:x.staffId,basis,holiday}})
 return {currency:'USD',costCents:inputs.some(x=>x.basis.costCents===null||x.holiday.costCents===null)?null:inputs.reduce((n,x)=>n+x.basis.costCents!+x.holiday.costCents,0),inputs,label:'Scheduled wage and employer holiday-rule estimate; excludes unconfigured burden and unapproved premiums'}
}
function coverage(rows:Row[]) {return {shifts:rows.length,minutes:rows.reduce((n,x)=>n+x.minutes,0),slots:rows.map(x=>({id:x.id,start:x.start,end:x.end,site:x.site,job:x.job,breakMinutes:x.breakMinutes,minutes:x.minutes}))}}
export async function compareFairness(s:State,a:Actor,week:string,site:string,weeks=8) {
 manager(a)
 const asOf=new Date().toISOString(),sourceReport=preferenceReport(s,a,week,site,weeks,{asOf})
 const roster=s.rosters.find(r=>r.week===week&&r.status==='published')
 need(roster,'Publish the source week before comparing assignment alternatives')
 const source=s.shifts.filter(x=>x.rosterId===roster.id&&x.status==='published'&&(x.site??'')===site).sort((a,b)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id))
 need(source.length,'No published service slots at this cafe')
 const pools=source.map(x=>eligibleMembers(s,site,positionOf(s,x),localDate(x.start,s.timezone)))
 need(pools.every(p=>p!==null),'Record effective role/site eligibility cohorts before comparing schedules')
 const valid=(rows:Row[])=>rows.every((x,i)=>pools[i]!.includes(x.staffId))&&!conflicts({s} as Context,[...s.shifts.filter(x=>x.rosterId===roster.id&&x.status==='published'&&(x.site??'')!==site),...rows],week).length
 need(valid(source),'Resolve the source week eligibility, availability or hours conflicts before comparing')
 const report=(rows:Row[])=>preferenceReport(trialState(s,week,source,rows),a,week,site,weeks,{asOf})
 const score=(rows:Row[])=>{const r=report(rows);return {...r.totals,costCents:cost(s,rows).costCents}}
 const original=score(source)
 need(original.spread!==null&&original.meanGapMinutes!==null&&original.maxGapMinutes!==null&&original.violations!==null,'Complete the cohort, tag policy and preference inputs before optimizing fairness')
 // Coordinate descent examines every single reassignment and pair exchange.
 // Each accepted move strictly improves its objective; finite assignments ensure termination.
 function optimize(initial:Row[],priority:'low'|'high') {
  let rows=initial.map(x=>({...x})),value=score(rows),moves=0
  const improves=(n:typeof value,b:typeof value)=>priority==='low'?n.costCents!==null&&b.costCents!==null&&n.costCents<b.costCents:n.spread!==null&&n.meanGapMinutes!==null&&n.maxGapMinutes!==null&&n.violations!==null&&n.spread<=b.spread!&&n.meanGapMinutes<=b.meanGapMinutes!&&n.maxGapMinutes<=b.maxGapMinutes!&&n.violations<=b.violations!&&(n.spread<b.spread!||n.meanGapMinutes<b.meanGapMinutes!||n.maxGapMinutes<b.maxGapMinutes!||n.violations<b.violations!)
  for(;;) {
   let next:Row[]|null=null,best=value
   const consider=(candidate:Row[])=>{if(!valid(candidate))return;const n=score(candidate);if(improves(n,best)){next=candidate;best=n}}
   for(let i=0;i<rows.length;i++)for(const id of pools[i]!)if(id!==rows[i].staffId)consider(rows.map((x,j)=>j===i?{...x,staffId:id}:x))
   for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++)if(rows[i].staffId!==rows[j].staffId)consider(rows.map((x,k)=>k===i?{...x,staffId:rows[j].staffId}:k===j?{...x,staffId:rows[i].staffId}:x))
   if(!next)break
   rows=next;value=best;moves++
  }
  const priced=cost(s,rows)
  return {priority,moves,shifts:rows.map(input),assignments:rows.map(x=>({slotId:x.id,staffId:x.staffId})),measures:report(rows),cost:priced,coverage:coverage(rows),conflicts:[]}
 }
 const low=optimize(source,'low'),lowRows=source.map((x,i)=>({...x,staffId:low.assignments[i].staffId})),high=optimize(lowRows,'high')
 const result={week,site,weeks,source:{id:roster.id,revision:roster.revision,shifts:source.map(x=>({id:x.id,revision:x.revision,...input(x),minutes:x.minutes}))},method:'Local assignment search over all single moves and pair exchanges; a local optimum, not a global optimality certificate',low,high,difference:{costCents:low.cost.costCents===null||high.cost.costCents===null?null:high.cost.costCents-low.cost.costCents,coveredMinutes:high.coverage.minutes-low.coverage.minutes,coveredShifts:high.coverage.shifts-low.coverage.shifts},uncovered:s.openshifts.filter(x=>x.week===week&&x.site===site&&x.status==='open').map(x=>({id:x.id,start:x.start,end:x.end,minutes:x.minutes})),sourceWindow:{first:sourceReport.first,last:sourceReport.last}}
 const explained={...result,explanation:explainAlternatives(result)}
 const reviewed=structuredClone(explained)
 // Moving wall time alone is not a changed input; any newly opened/closed offer
 // changes the exported inclusion facts and therefore still invalidates review.
 for(const alternative of [reviewed.low,reviewed.high])alternative.measures.equity.asOf=''
 return {...explained,digest:await sha(canonical(reviewed))}
}
export async function fairnessPrepare(c:Context,name:string,p:Record<string,any>) {
 if(name!=='fairness.prepare')return undefined
 manager(c.a);keys(p,['week','site','weeks','priority','digest']);need(p.priority==='low'||p.priority==='high','Choose low or high fairness priority')
 const comparison=await compareFairness(c.s,c.a,text(p.week,'week',10),text(p.site,'site',80,true),Number(p.weeks??8))
 need(text(p.digest,'review digest',64)===comparison.digest,'Fairness inputs changed; compare and review again',409)
 const chosen=comparison[p.priority as 'low'|'high'],other=c.s.shifts.filter(x=>x.rosterId===comparison.source.id&&x.status==='published'&&(x.site??'')!==comparison.site).map(input)
 return {...draftWeek(c,comparison.week,[...other,...chosen.shifts]),fairnessPriority:p.priority,reviewDigest:comparison.digest}
}
