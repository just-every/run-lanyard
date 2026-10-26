// COST-001: source rows, retained rate allocations and policy estimates.
import {type State,type Row} from './model'
import {priced} from './workforce'
import {policyClassification} from './policy'
import {workweek} from './payschedules'
import {segmentPlan,reconcileSegments} from './worksegments'
import {openPieces,startOf} from './transfers'
import {holidayBasis,workedHoliday} from './holidays'
import {differentialBasis,differentialRules} from './differentials'
import {premiumRecords,premiumCurrent} from './premiums'

export const liveTime=(t:Row)=>['submitted','approved','returned'].includes(t.status)
/** A pending correction replaces its source only in the estimated view. */
export function workedRows(s:State,asOf:string,approved=false):Row[] {
 const times=s.timesheets.filter(t=>t.start<asOf&&(approved?t.status==='approved':liveTime(t)&&!s.timesheets.some(x=>x.corrects===t.id&&liveTime(x))))
 const open=approved?[]:s.clocks.filter(k=>k.status==='open'&&k.start<asOf).flatMap(k=>openPieces(s,{...k,...startOf(s,k)},asOf).map((p,i)=>{
  const meal=(k.breaks??[]).filter((b:any)=>b.kind==='meal').reduce((n:number,b:any)=>n+Math.max(0,Math.floor((Math.min(Date.parse(b.end??asOf),Date.parse(p.end))-Math.max(Date.parse(b.start),Date.parse(p.start)))/60000)),0)
  return {...p,id:`${k.id}:${i}`,clockId:k.id,status:'open',minutes:Math.max(0,p.minutes-meal)}
 })).filter(p=>p.minutes>0)
 return [...times,...open].map(t=>costRow(s,t))
}

/** Pending corrections use the approved source's rates, as time.approve does. */
export function costRow(s:State,t:Row):Row {
 const source=t.corrects?s.timesheets.find(x=>x.id===t.corrects):undefined
 const retain=(basis:any,job:string,area?:string)=>{
  const prior=source?.workSegments?.find((w:any)=>w.job===job&&w.area===area)?.rateBasis??source?.rateBasis
  if(!prior)return basis
  const segments=basis.segments.map((p:any)=>({...p,...(prior.segments.find((q:any)=>q.date===p.date)??prior.segments.at(-1)),minutes:p.minutes,date:p.date}))
  return {...basis,segments,costCents:segments.some((p:any)=>p.cents===null)?null:segments.reduce((n:number,p:any)=>n+Math.round(p.minutes*p.cents/60),0)}
 }
 const basis=priced(s,t.staffId,t),areas=t.workSegments?.length?t.workSegments:basis.workSegments?.length?basis.workSegments:reconcileSegments(s,t.staffId,t,t.segmentPlan??segmentPlan(s,t.staffId,t,t.shiftId))
 return {...t,rateBasis:retain(basis,t.job??''),...(areas.length?{workSegments:areas.map((w:any)=>({...w,rateBasis:retain(w.rateBasis,w.job,w.area)}))}:{})}
}

export type CostFact={date:string;site:string;job:string;staffId:string;sourceId:string;revision:number;status:string;minutes:number;wageCents:number|null;overtimeMinutes:number;doubleMinutes:number;overtimeCents:number|null;holidayCents:number|null;differentialCents:number|null;otherPremiumCents:number|null;rate:any;policy:any[];issues:string[]}

/** Round a workweek premium once, then assign cents by largest remainder. */
function premiums(parts:any[],weighted:number|null,incomplete:boolean) {
 if(incomplete||weighted===null)return parts.map(()=>null)
 const raw=parts.map(p=>(p.overtimeMinutes*.5+p.doubleMinutes)*weighted/60),out=raw.map(Math.floor)
 let left=Math.round(raw.reduce((n,v)=>n+v,0))-out.reduce((n,v)=>n+v,0)
 for(const i of raw.map((_,i)=>i).sort((a,b)=>(raw[b]-out[b])-(raw[a]-out[a])||a-b))if(left-->0)out[i]++
 return out
}

export function costFacts(s:State,rows:Row[],week:string,asOf:string,scheduled=false):CostFact[] {
 const end=new Date(Date.parse(week+'T00:00:00Z')+7*86400000).toISOString().slice(0,10),facts:CostFact[]=[]
 for(const staffId of new Set(rows.map(t=>t.staffId))) {
  const own=rows.filter(t=>t.staffId===staffId),weeks=new Set<string>()
  for(const t of own)for(const area of t.workSegments?.length?t.workSegments:[t])for(const p of (area.rateBasis??priced(s,staffId,area)).segments)if(p.date>=week&&p.date<end)weeks.add(workweek(s,staffId,p.date))
  for(const w of weeks) {
   const report=policyClassification(s,staffId,w,own),premium=premiums(report.parts,report.weightedRateCents,report.classificationIncomplete)
   report.parts.forEach((p:any,i:number)=>{
    if(p.date<week||p.date>=end)return
    const t=own.find(x=>x.id===p.timeId)!,holiday=scheduled?holidayBasis(s,t):t.status==='approved'?workedHoliday(s,t,asOf):holidayBasis(s,t)
    const differential=t.differentialBasis??differentialBasis(s,t,differentialRules(s,t))
    const matching=(x:any)=>x.date===p.date&&x.site===p.site&&(x.job??'')===(p.job??'')&&(x.area??'')===(p.area??'')
    const siblings=report.parts.filter((x:any)=>x.timeId===p.timeId&&x.date===p.date&&x.site===p.site&&x.job===p.job&&x.area===p.area),minutes=siblings.reduce((n:number,x:any)=>n+x.minutes,0),share=minutes?p.minutes/minutes:0
    const h=holiday.filter(matching),d=differential.filter(matching)
    const amount=(list:any[])=>list.some(x=>x.costCents===null||x.pending)?null:Math.round(list.filter(x=>x.eligible!==false).reduce((n,x)=>n+x.costCents,0)*share)
    facts.push({date:p.date,site:p.site,job:p.job,staffId,sourceId:p.timeId,revision:t.revision,status:t.status,minutes:p.minutes,wageCents:p.cents===null?null:Math.round(p.minutes*p.cents/60),overtimeMinutes:p.overtimeMinutes,doubleMinutes:p.doubleMinutes,overtimeCents:premium[i],holidayCents:amount(h),differentialCents:amount(d),otherPremiumCents:0,rate:{cents:p.cents,...p.rateReference},policy:p.rules,issues:[...(report.classificationIncomplete?['Policy classification requires review.']:[]),...(h.some((x:any)=>x.pending)?['Holiday attendance eligibility awaits approved work.']:[])]})
   })
  }
 }
 if(!scheduled)for(const r of premiumRecords(s).filter(r=>r.status!=='disputed'&&r.date>=week&&r.date<end)) {
  const current=premiumCurrent(s,r),approved=r.status==='approved'
  for(const a of r.facts.allocations)facts.push({date:r.date,site:a.site??r.site,job:a.job??'',staffId:r.staffId,sourceId:r.id,revision:r.revision,status:current?r.status:'stale premium',minutes:0,wageCents:0,overtimeMinutes:0,doubleMinutes:0,overtimeCents:0,holidayCents:0,differentialCents:0,otherPremiumCents:current&&approved?a.costCents:null,rate:{cents:null,premiumRuleId:r.rule.id,premiumRuleRevision:r.rule.revision},policy:[],issues:current&&approved?[]:['A premium input awaits current source review and approval.']})
 }
 return facts
}
