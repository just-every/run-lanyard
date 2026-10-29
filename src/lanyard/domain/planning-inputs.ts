// OPT-001: inspect saved demand requirements and the employer's weekly labor budget.
// A missing day or role stays unknown; fixed published slots are never adequate merely because
// both alternatives preserve them. This is a scheduled comparison, never an outcome or legal score.
import {type State,type Row} from './model'
import {savedVersions,datePlus} from './demand'
import {instantAt} from './settings'

export function planningBudget(s:State,week:string,site:string,costCents:number|null) {
 const f=s.forecasts.find(r=>r.week===week&&r.site===site)
 const forecastCents=f?f.days.reduce((n:number,x:number)=>n+x*100,0):null
 const limitCents=f&&f.budgetPercent!==null?Math.round(forecastCents!*f.budgetPercent/100):null
 return {source:f?{id:f.id,revision:f.revision,days:f.days,budgetPercent:f.budgetPercent}:null,forecastCents,limitCents,
  varianceCents:limitCents===null||costCents===null?null:costCents-limitCents,
  withinBudget:limitCents===null||costCents===null?null:costCents<=limitCents,
  reasons:!f?['No weekly sales forecast']:f.budgetPercent===null?['No employer labor budget']:costCents===null?['Scheduled cost is unknown']:[]}
}
export function planningDemand(s:State,week:string,site:string,rows:Row[],dates?:string[]) {
 const unknown:{date:string;reason:string}[]=[],intervals:any[]=[],versions:any[]=[]
 for(let i=0;i<7;i++) {
  const date=datePlus(week,i);if(dates&&!dates.includes(date))continue;const v=savedVersions(s,site,date)[0]
  if(!v){unknown.push({date,reason:'No saved demand forecast'});continue}
  versions.push({id:v.id,revision:v.revision,version:v.version,digest:v.digest,status:v.status,date:v.date,source:v.source})
  if(v.status!=='complete'){unknown.push({date,reason:'Incomplete forecast: '+v.reasons.join('; ')});continue}
  if(!v.hours.some((x:any)=>x.roles?.length)){unknown.push({date,reason:'No saved role requirements'});continue}
  for(const h of v.hours)for(const role of h.roles??[]) {
   const start=instantAt(date,h.time,s.timezone),next=h.hour===23?instantAt(datePlus(date,1),'00:00',s.timezone):instantAt(date,`${String(h.hour+1).padStart(2,'0')}:00`,s.timezone)
   const contributions=rows.filter(x=>x.site===site&&(s.jobs.find(j=>j.id===x.job)?.name??s.staff.find(p=>p.id===x.staffId)?.position??'')===role.position).flatMap(x=>{
    const overlap=Math.max(0,Math.min(Date.parse(x.end),Date.parse(next))-Math.max(Date.parse(x.start),Date.parse(start)))
    return overlap?[{shiftId:x.id,staffId:x.staffId,minutes:overlap/(Date.parse(x.end)-Date.parse(x.start))*x.minutes}]:[]
   })
   const scheduledMinutes=Math.round(contributions.reduce((n,x)=>n+x.minutes,0)*100)/100
   intervals.push({date,hour:h.hour,position:role.position,requiredMinutes:role.requiredMinutes,scheduledMinutes,
    uncoveredMinutes:Math.max(0,role.requiredMinutes-scheduledMinutes),excessMinutes:Math.max(0,scheduledMinutes-role.requiredMinutes),contributions})
  }
 }
 const sum=(key:string)=>intervals.reduce((n,x)=>n+x[key],0)
 return {status:unknown.length?'unknown':'known',basis:'Latest saved manual demand versions; scheduled break minutes apportioned evenly over each shift',
  versions,unknown,intervals,observed:{requiredMinutes:sum('requiredMinutes'),scheduledMinutes:sum('scheduledMinutes'),uncoveredMinutes:sum('uncoveredMinutes')},
  requiredMinutes:unknown.length?null:sum('requiredMinutes'),uncoveredMinutes:unknown.length?null:sum('uncoveredMinutes'),scheduledMinutes:unknown.length?null:sum('scheduledMinutes'),excessMinutes:unknown.length?null:sum('excessMinutes')}
}
