// PAYRULE-002: retained per-area premium facts and source-backed eligibility.
import {type State,type Row,canonical} from './model'
import {priced,rateAt} from './workforce'
import {localDate,instantAt} from './settings'
import {dayAfter} from './aca'
export const holidayRule=(s:State,site:string,on:string)=>s.holidayrules.filter(r=>r.site===site&&r.from<=on).sort((a,b)=>a.from.localeCompare(b.from)).at(-1)
const siteOf=(s:State,t:any)=>t.site||s.staff.find(p=>p.id===t.staffId)?.site||''
/** Pin the employer's rule/calendar and adjacent scheduled facts at time approval. */
export function holidayBasis(s:State,t:Row) {
 const pieces=t.workSegments?.length?t.workSegments:[{...t,rateBasis:priced(s,t.staffId,t)}]
 return pieces.flatMap((w:any)=>w.rateBasis.segments.flatMap((p:any)=>{
  const site=siteOf(s,w),previous=t.corrects?s.timesheets.find(x=>x.id===t.corrects):undefined
  const retained=previous?.holidayBasis?.find((f:any)=>f.site===site&&f.date===p.date&&f.job===(w.job??'')&&f.area===w.area)
  if(retained)return [{...retained,minutes:p.minutes,costCents:retained.unitCents===null?null:Math.round(p.minutes*retained.unitCents/60),start:w.start,end:w.end}]
  const h=s.holidays.find(h=>h.site===site&&h.date===p.date&&h.enabled),rule=holidayRule(s,site,p.date)
  if(!h||!rule)return []
  const adjacent=adjacentShifts(s,t.staffId,p.date)
  const unitCents=rule.mode==='multiplier'?p.cents===null?null:p.cents*(rule.value-1):rule.value
  return [{holidayId:h.id,holidayRevision:h.revision,holiday:h.name,date:p.date,site,job:w.job??'',area:w.area,minutes:p.minutes,rateCents:p.cents,unitCents,costCents:unitCents===null?null:Math.round(p.minutes*unitCents/60),code:rule.code,ruleId:rule.id,ruleRevision:rule.revision,beforeAfter:rule.beforeAfter,adjacent,start:w.start,end:w.end}]
 }))
}
function adjacentShifts(s:State,staffId:string,on:string) {
 const start=instantAt(on,'00:00',s.timezone),end=instantAt(dayAfter(on),'00:00',s.timezone)
 const list=s.shifts.filter(x=>x.staffId===staffId&&x.status==='published').sort((a,b)=>a.start.localeCompare(b.start))
 return [list.filter(x=>x.end<=start).at(-1),list.find(x=>x.start>=end)].filter(Boolean).map(x=>({id:x!.id,revision:x!.revision,start:x!.start,end:x!.end,minutes:x!.minutes}))
}
export function holidayEligibility(s:State,staffId:string,fact:any,now:string) {
 const reasons:string[]=[],pending:string[]=[]
 if(fact.beforeAfter)for(const x of fact.adjacent) {
  const covered=s.timesheets.some(t=>t.staffId===staffId&&t.status==='approved'&&t.start<=x.start&&t.end>=x.end&&t.minutes>=x.minutes)
  if(covered)continue
  const waits=x.end>now||s.timesheets.some(t=>t.staffId===staffId&&['submitted','returned'].includes(t.status)&&t.start<x.end&&t.end>x.start)
  const message=`Scheduled shift ${localDate(x.start,s.timezone)} ${waits?'awaits approved work':'was not worked in full'}`
  ;(waits?pending:reasons).push(message)
 }
 return {eligible:reasons.length===0,pending:pending.length>0,reasons:[...reasons,...pending]}
}
export function workedHoliday(s:State,t:Row,now:string) {
 return (t.holidayBasis??[]).map((f:any)=>({...f,...holidayEligibility(s,t.staffId,f,now)}))
}
export function nonWorkReview(s:State,staffId:string,site:string,on:string,now:string) {
 const h=s.holidays.find(h=>h.site===site&&h.date===on&&h.enabled),rule=holidayRule(s,site,on),person=s.staff.find(p=>p.id===staffId)
 if(!h||!rule||!rule.nonWorkMinutes||!person?.active||person.erased_at||(person.site??'')!==site)return null
 const fact={holidayId:h.id,holidayRevision:h.revision,holiday:h.name,date:on,site,ruleId:rule.id,ruleRevision:rule.revision,beforeAfter:rule.beforeAfter,adjacent:adjacentShifts(s,staffId,on)}
 const eligibility=holidayEligibility(s,staffId,fact,now),start=instantAt(on,'00:00',s.timezone),end=instantAt(dayAfter(on),'00:00',s.timezone)
 const worked=s.timesheets.some(t=>t.staffId===staffId&&t.status!=='superseded'&&t.start<end&&t.end>start)||s.clocks.some(k=>k.staffId===staffId&&k.start<end&&(k.end??now)>start)
 const scheduled=s.shifts.some(x=>x.staffId===staffId&&x.status==='published'&&x.start<end&&x.end>start)
 const basis=rateAt(s,staffId,'',on),minutes=rule.nonWorkMinutes,costCents=basis.cents===null?null:Math.round(minutes*basis.cents/60)
 const review={...fact,...eligibility,staffId,name:person.name,kind:'non-work',minutes,costCents,code:rule.code+' non-work',rateCents:basis.cents,basis,eligible:eligibility.eligible&&!worked&&!scheduled,pending:eligibility.pending||end>now,reasons:[...eligibility.reasons,...(worked?['Worked or pending holiday time exists']:scheduled?['Scheduled holiday shift was not worked']:[]),...(end>now?['Holiday has not ended']:[])]}
 return {...review,digest:canonical(review)}
}
export function holidayReviews(s:State,now:string) {
 const worked=s.timesheets.filter(t=>t.status==='approved').flatMap(t=>workedHoliday(s,t,now).map((f:any)=>({...f,staffId:t.staffId,name:s.staff.find(p=>p.id===t.staffId)?.name,kind:'worked',timeId:t.id})))
 const nonwork=s.holidays.filter(h=>h.enabled).flatMap(h=>s.staff.filter(p=>(p.site??'')===h.site&&!s.holidaypay.some(r=>r.staffId===p.id&&r.holidayId===h.id)).map(p=>nonWorkReview(s,p.id,h.site,h.date,now)).filter(Boolean))
 return [...worked,...nonwork]
}

/** Schedule cost is an employer-rule estimate; adjacent-shift eligibility is unresolved here. */
export function scheduledHolidayCost(s:State,t:Row) {
 const facts=holidayBasis(s,t)
 return {facts,costCents:facts.some((f:any)=>f.costCents===null)?null:facts.reduce((n:number,f:any)=>n+f.costCents,0)}
}
export function holidayEstimate(s:State,staffId:string,start:string,end:string,now:string) {
 const facts=s.timesheets.filter(t=>t.staffId===staffId&&t.status==='approved').flatMap(t=>workedHoliday(s,t,now)).filter((f:any)=>f.eligible&&!f.pending&&f.date>=start&&f.date<=end)
 const paid=s.holidaypay.filter(r=>r.staffId===staffId&&r.date>=start&&r.date<=end)
 const workedCostCents=facts.some((f:any)=>f.costCents===null)?null:facts.reduce((n:number,f:any)=>n+f.costCents,0),nonWorkCostCents=paid.some(r=>r.costCents===null)?null:paid.reduce((n,r)=>n+r.costCents,0)
 return {workedCostCents,nonWorkCostCents,minutes:facts.reduce((n:number,f:any)=>n+f.minutes,0),nonWorkMinutes:paid.reduce((n,r)=>n+r.minutes,0),costCents:[...facts,...paid].some(f=>f.costCents===null)?null:[...facts,...paid].reduce((n,f)=>n+f.costCents,0)}
}
