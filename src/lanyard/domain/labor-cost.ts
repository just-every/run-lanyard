// COST-001: native estimates are distinct from approved hours and provider pay.
import {type Actor,type State,type Row,manager,need,instant} from './model'
import {date,dayAfter,mayReadPerson} from './aca'
import {costFacts,workedRows,type CostFact} from './labor-cost-facts'
import {priced} from './workforce'
import {localDate} from './settings'

export function burdenOf(forecast?:Row) {
 return {percent:forecast?.burdenPercent??0,perHourCents:forecast?.burdenPerHourCents??0,configured:forecast?.burdenPercent!==undefined||forecast?.burdenPerHourCents!==undefined,forecastId:forecast?.id??null,forecastRevision:forecast?.revision??null}
}
export function costTotals(facts:CostFact[],burden=burdenOf()) {
 const sum=(key:'minutes'|'overtimeMinutes'|'doubleMinutes')=>facts.reduce((n,f)=>n+f[key],0)
 const amount=(key:'wageCents'|'overtimeCents'|'holidayCents'|'differentialCents'|'otherPremiumCents')=>facts.some(f=>f[key]===null)?null:facts.reduce((n,f)=>n+f[key]!,0)
 const wageCents=amount('wageCents'),overtimeCents=amount('overtimeCents'),holidayCents=amount('holidayCents'),differentialCents=amount('differentialCents'),otherPremiumCents=amount('otherPremiumCents'),components=[wageCents,overtimeCents,holidayCents,differentialCents,otherPremiumCents]
 const knownCents=facts.reduce((n,f)=>n+(f.wageCents??0)+(f.overtimeCents??0)+(f.holidayCents??0)+(f.differentialCents??0)+(f.otherPremiumCents??0),0),earningsCents=components.some(v=>v===null)?null:components.reduce<number>((n,v)=>n+v!,0)
 const minutes=sum('minutes'),burdenCents=earningsCents===null?null:Math.round(earningsCents*burden.percent/100+minutes*burden.perHourCents/60)
 return {minutes,wageCents,overtimeMinutes:sum('overtimeMinutes'),doubleMinutes:sum('doubleMinutes'),overtimeCents,holidayCents,differentialCents,otherPremiumCents,burdenCents,totalCents:earningsCents===null?null:earningsCents+burdenCents!,knownCents,unpricedSources:new Set(facts.filter(f=>[f.wageCents,f.overtimeCents,f.holidayCents,f.differentialCents,f.otherPremiumCents].includes(null)).map(f=>f.sourceId)).size,sourceCount:new Set(facts.map(f=>f.sourceId)).size}
}

/** Pure site calculation, also shared by entered-sales ratios and dashboard. */
export function laborCosts(s:State,week:string,site:string,asOf:string,draft=false,reader?:Actor) {
 const roster=s.rosters.find(r=>r.week===week&&r.status===(draft?'draft':'published'))
 const scheduledRows=s.shifts.filter(x=>x.status==='published'&&s.rosters.find(r=>r.id===x.rosterId)?.week!==week||roster&&x.rosterId===roster.id&&x.status===roster.status).map(x=>{const basis=priced(s,x.staffId,x);return {...x,rateBasis:basis,...(basis.workSegments?.length?{workSegments:basis.workSegments}:{})}})
 const visible=(f:CostFact)=>f.site===site&&(!reader||mayReadPerson(s,reader,f.staffId))
 const scheduled=costFacts(s,scheduledRows,week,asOf,true).filter(visible),actual=costFacts(s,workedRows(s,asOf),week,asOf).filter(visible),approved=costFacts(s,workedRows(s,asOf,true),week,asOf).filter(visible)
 const forecast=s.forecasts.find(f=>f.week===week&&(f.site??'')===site),burden=burdenOf(forecast)
 const group=(list:CostFact[])=>costTotals(list,burden)
 const days=Array.from({length:7},(_,i)=>{
  const date=dayAfter(week,i),s=group(scheduled.filter(f=>f.date===date)),a=group(actual.filter(f=>f.date===date)),p=group(approved.filter(f=>f.date===date))
  const forecastCents=forecast?forecast.days[i]*100:null,budgetCents=forecastCents!==null&&forecast?.budgetPercent!=null?Math.round(forecastCents*forecast.budgetPercent/100):null
  return {date,scheduled:s,actual:a,approved:p,forecastCents,budgetCents,overBudget:budgetCents!==null&&s.totalCents!==null?s.totalCents>budgetCents:null}
 })
 const scheduledTotal=group(scheduled),actualTotal=group(actual),approvedTotal=group(approved)
 const jobs=[...new Set([...scheduled,...actual,...approved].map(f=>f.job))].sort().map(job=>({job,name:s.jobs.find(j=>j.id===job)?.name??'No assigned job',scheduled:group(scheduled.filter(f=>f.job===job)),actual:group(actual.filter(f=>f.job===job)),approved:group(approved.filter(f=>f.job===job))}))
 const budgetCents=forecast?.budgetPercent!=null?Math.round(forecast.days.reduce((n:number,v:number)=>n+v,0)*forecast.budgetPercent):null
 const tips=(list:CostFact[])=>{
  const timeIds=new Set(list.map(f=>f.sourceId)),roots=new Set(s.timesheets.filter(t=>timeIds.has(t.id)).map(t=>t.rootId||t.id))
  const sources=[...roots].flatMap(id=>{const t=s.timesheets.find(t=>t.id===id),current=s.timesheets.find(t=>timeIds.has(t.id)&&(t.rootId||t.id)===id);if(!t||!current)return [];const first=current.workSegments?.[0]??current,atSite=first.site||s.staff.find(p=>p.id===current.staffId)?.site||'',date=localDate(first.start,s.timezone);if(atSite!==site||date<week||date>dayAfter(week,6))return [];return (t.answers??[]).filter((a:any)=>a.kind==='tips'&&typeof a.value==='number').map((a:any)=>({sourceId:t.id,revision:t.revision,date,site:atSite,questionId:a.questionId,questionRevision:a.version,cents:a.value}))})
  return {declaredCents:sources.length?sources.reduce((n,x)=>n+x.cents,0):null,sources}
 }
 return {week,site,asOf,view:draft?'draft':'published',roster:roster?{id:roster.id,revision:roster.revision}:null,burden,scheduled:scheduledTotal,actual:actualTotal,approved:approvedTotal,days,jobs,budgetCents,overBudget:budgetCents!==null&&scheduledTotal.totalCents!==null?scheduledTotal.totalCents>budgetCents:null,variance:{actualMinusScheduledCents:actualTotal.totalCents===null||scheduledTotal.totalCents===null?null:actualTotal.totalCents-scheduledTotal.totalCents,approvedMinusScheduledCents:approvedTotal.totalCents===null||scheduledTotal.totalCents===null?null:approvedTotal.totalCents-scheduledTotal.totalCents,pendingMinutes:actualTotal.minutes-approvedTotal.minutes},tips:{actual:tips(actual),approved:tips(approved),approvedPoolCents:null},facts:{scheduled,actual,approved},providerReconciled:null,issues:[...new Set([...scheduled,...actual,...approved].flatMap(f=>f.issues))],label:'USD estimate from retained job rates and configured policy. Approved means approved time, not paid wages. Provider reconciliation remains unavailable.'}
}

export function laborCostReport(s:State,a:Actor,week:string,site:string,asOf:string,draft=false) {
 manager(a);date(week,'week');need(new Date(week+'T00:00:00Z').getUTCDay()===1,'Week must start on Monday')
 asOf=instant(asOf,'as of');need(Date.parse(asOf)<=Date.now(),'Cost estimates cannot observe future work')
 need(a.role==='owner'||site===(s.staff.find(p=>p.id===a.staffId)?.site??''),'Not found',404)
 return laborCosts(s,week,site,asOf,draft,a)
}
