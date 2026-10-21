// SCHEDULE-001: current draft facts for publication review. This read never mutates
// the draft, infers a changed-shift pairing, or turns an estimate into worked cost.
import {type Actor,type Context,type Row,type State} from './model'
import {scheduledHolidayCost} from './holidays'
import {priced,profileOf} from './workforce'
import {acaReports} from './aca-report'
import {conflicts} from './roster'
import {localDate} from './settings'
import {coverageCase} from './coverage'

const dateAfter=(date:string,n:number)=>new Date(Date.parse(date+'T00:00:00Z')+n*86400000).toISOString().slice(0,10)
const siteOf=(s:State,x:Row)=>x.site||s.staff.find(p=>p.id===x.staffId)?.site||''
function view(s:State,x:Row) {
 return {id:x.id,staffId:x.staffId,start:x.start,end:x.end,breakMinutes:x.breakMinutes,minutes:x.minutes,label:x.label??'',site:siteOf(s,x),job:x.job??''}
}
type ShiftView=ReturnType<typeof view>
const signature=(x:ShiftView)=>JSON.stringify([x.staffId,x.start,x.end,x.breakMinutes,x.minutes,x.label,x.site,x.job])

/** Exact multiset comparison: identical duplicate rows cancel only one for one. */
function difference(s:State,before:Row[],after:Row[]) {
 const remaining=new Map<string,ShiftView[]>()
 for(const row of before) {
  const v=view(s,row),key=signature(v)
  remaining.set(key,[...(remaining.get(key)??[]),v])
 }
 const added:ShiftView[]=[],unchanged:ShiftView[]=[]
 for(const row of after) {
  const v=view(s,row),matches=remaining.get(signature(v))
  if(matches?.length){matches.shift();unchanged.push(v)}else added.push(v)
 }
 return {added,removed:[...remaining.values()].flat(),unchanged}
}

/** Manager-only integration must enforce authority before exposing rates/review. */
export function scheduleReview(s:State,week:string,reader?:Actor) {
 const draft=s.rosters.find(r=>r.week===week&&r.status==='draft')
 if(!draft)return null
 const published=s.rosters.find(r=>r.week===week&&r.status==='published')
 const shifts=s.shifts.filter(x=>x.rosterId===draft.id&&x.status==='draft')
 const prior=published?s.shifts.filter(x=>x.rosterId===published.id&&x.status==='published'):[]
 const dates=Array.from({length:7},(_,i)=>dateAfter(week,i)),end=dateAfter(week,7)
 const gaps:{id:string;kind:'open shift'|'call-out';site:string;date:string;start:string;end:string;position:string}[]=[]
 for(const o of s.openshifts.filter(o=>(o.status==='draft'&&o.rosterId===draft.id)||(o.status==='open'&&o.week===week))) {
  gaps.push({id:o.id,kind:'open shift',site:o.site??'',date:localDate(o.start,s.timezone),start:o.start,end:o.end,position:o.position??o.label??''})
 }
 // A current call-out remains a review warning until coverage is actually resolved.
 // It is not treated as a second enclosing shift or counted twice in labor.
 for(const x of prior.filter(x=>x.callout&&(!x.callout.coveredBy||coverageCase(s,x,new Date().toISOString()).status==='reopened'))) {
  gaps.push({id:x.id,kind:'call-out',site:siteOf(s,x),date:localDate(x.start,s.timezone),start:x.start,end:x.end,position:x.label??''})
 }
 const totals=(list:Row[])=>{
  let costCents=0
  const unrated=new Set<string>()
  for(const x of list) {
   const basis=priced(s,x.staffId,x)
   const premium=scheduledHolidayCost(s,x)
   if(basis.costCents!==null)costCents+=basis.costCents+(premium.costCents??0)
   else unrated.add(x.staffId)
  }
  return {headcount:new Set(list.map(x=>x.staffId)).size,shifts:list.length,minutes:list.reduce((n,x)=>n+x.minutes,0),costCents,unrated:unrated.size}
 }
 const dayOf=(x:Row)=>localDate(x.start,s.timezone)
 const days=dates.map(date=>({date,...totals(shifts.filter(x=>dayOf(x)===date)),gaps:gaps.filter(g=>g.date===date).length}))
 const cafes=[...new Set([...shifts.map(x=>siteOf(s,x)),...gaps.map(g=>g.site),...s.forecasts.filter(f=>f.week===week).map(f=>f.site??'')])].sort()
 const warnings:{kind:string;site:string;date?:string;message:string}[]=[]
 const sites=cafes.map(site=>{
  const here=shifts.filter(x=>siteOf(s,x)===site),forecast=s.forecasts.find(f=>f.week===week&&(f.site??'')===site)
  const budgetPercent: number|null=forecast?.budgetPercent??null
  const cost=(list:Row[],forecastCents:number|null,date?:string)=>{
   const t=totals(list),budgetCents=forecastCents!==null&&budgetPercent!==null?Math.round(forecastCents*budgetPercent/100):null
   const percent=forecastCents?Math.round(t.costCents/forecastCents*1000)/10:null
   const overBudget=budgetCents!==null&&t.costCents>budgetCents
   if(overBudget)warnings.push({kind:'budget',site,...(date?{date}:{}),message:`${date??'Week'} scheduled labor exceeds the forecast labor budget${t.unrated?' even before missing rates are included':''}.`})
   return {...t,forecastCents,budgetCents,percent,budgetPercent,overBudget}
  }
  const daily=dates.map((date,i)=>({date,...cost(here.filter(x=>dayOf(x)===date),forecast?forecast.days[i]*100:null,date)}))
  const total=cost(here,forecast?forecast.days.reduce((n:number,v:number)=>n+v,0)*100:null)
  if(total.unrated)warnings.push({kind:'missing rate',site,message:`${total.unrated} scheduled employee${total.unrated===1?' has':'s have'} no hourly rate; scheduled cost is incomplete.`})
  if(!forecast)warnings.push({kind:'missing forecast',site,message:'No sales forecast is set for this cafe and week; labor percentage and budget comparison are unavailable.'})
  else if(budgetPercent===null)warnings.push({kind:'missing budget',site,message:'No labor budget percentage is set for this cafe and week.'})
  return {site,days:daily,...total}
 })
 for(const id of new Set(shifts.map(x=>x.staffId))){const p=profileOf(s,id),minutes=shifts.filter(x=>x.staffId===id).reduce((n,x)=>n+x.minutes,0);if(p&&minutes<p.minHours*60)warnings.push({kind:'minimum hours',site:s.staff.find(v=>v.id===id)?.site??'',message:`${s.staff.find(v=>v.id===id)?.name}: scheduled below employer-recorded minimum weekly hours (${p.minHours}).`})}
 for(const gap of gaps)warnings.push({kind:'coverage',site:gap.site,date:gap.date,message:`${gap.kind==='call-out'?'Unresolved call-out':'Unfilled open shift'}: ${gap.position||'unassigned role'}.`})
 if(reader)for(const report of acaReports(s,reader,new Date().toISOString(),{week,shifts}))for(const r of report.rows.filter(r=>r.warning))warnings.push({kind:'aca',site:s.staff.find(p=>p.id===r.staffId)?.site??'',message:`${r.name}: planned hours reach an ACA full-time threshold in ${report.plan.name}; ${r.projectedAverageWeeklyHours} weekly hours projected. Review the source-backed ACA report before publishing.`})
 return {week,id:draft.id,revision:draft.revision,publishedId:published?.id??null,publishedRevision:published?.revision??null,
  conflicts:conflicts({s} as Context,shifts,week),...difference(s,prior,shifts),days,sites,gaps:gaps.filter(g=>g.date>=week&&g.date<end),warnings}
}
