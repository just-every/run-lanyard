import {type State,type Row} from './model'
import {dayAfter} from './aca'
import {instantAt} from './settings'
import {workweek} from './payschedules'
import {WORKDAY_BREAK_VERSIONS,breakSources} from './policy-breaks'
import {covered} from './policy-coverage'

type Part={date:string;minutes:number;site:string;timeId:string;start:string;end:string;workdayDate?:string;workdayKey?:string;workdayStart?:string}
type RuleOn=(site:string,on:string)=>Row|undefined
type Issue={kind:'rest';state:'unknown'|'exception';message:string}

/** California's paid rest entitlement belongs to the employee's workday,
 * including split service and cafe transfers. Only retained payable minutes
 * supply hours worked; a gap never supplies a break or changes those minutes. */
export function californiaRestDays(s:State,staffId:string,parts:Part[],rows:Row[],week:string,ruleOn:RuleOn,planned:boolean){
 const key=(p:Part)=>p.workdayKey??`${staffId}|${p.date}|00:00`
 const current=(p:Part)=>{const r=ruleOn(p.site,p.date);return r?.preset==='CA'&&(WORKDAY_BREAK_VERSIONS as readonly string[]).includes(r.breakVersion)&&covered(r,staffId,'rest')}
 const selected=new Set(parts.filter(p=>workweek(s,staffId,p.date)===week&&current(p)).map(key))
 const days=new Map<string,Part[]>()
 for(const p of parts)if(selected.has(key(p))){const day=days.get(key(p))??[];day.push(p);days.set(key(p),day)}
 const sourceRows=new Map(rows.filter(r=>r.staffId===staffId).map(r=>[r.id,Array.isArray(r.breaks)||s.clocks.some(k=>k.id===r.clockId)?{...r,breaks:r.breaks??[]}:r]))
 return [...days].map(([workdayKey,day])=>{
  const first=day.find(current)!,workdayDate=first.workdayDate??first.date,anchor=first.workdayStart??'00:00'
  const begin=Date.parse(instantAt(workdayDate,anchor,s.timezone)),end=Date.parse(instantAt(dayAfter(workdayDate),anchor,s.timezone))
  const workedMinutes=day.reduce((n,p)=>n+p.minutes,0),requiredRests=workedMinutes<210?0:Math.ceil((workedMinutes-120)/240)
  const timeIds=[...new Set(day.map(p=>p.timeId))],sources=timeIds.map(id=>sourceRows.get(id))
  const timed=sources.every(r=>r&&Array.isArray(r.breaks)),seen=new Set<string>()
  let recordedRests=0,straddles=false
  for(const row of sources){
   if(!row||!Array.isArray(row.breaks))continue
   const rowStart=Date.parse(row.start),rowEnd=Date.parse(row.end)
   if(!Number.isFinite(rowStart)||!Number.isFinite(rowEnd)||rowEnd<=rowStart)continue
   for(const b of row.breaks){
    if(b.kind!=='rest'||!b.end)continue
    const start=Date.parse(b.start),finish=Date.parse(b.end)
    if(!Number.isFinite(start)||!Number.isFinite(finish)||start<rowStart||finish>rowEnd||finish<=start||finish<=begin||start>=end)continue
    // A single captured rest crossing an employer-day boundary cannot prove
    // either day's net ten consecutive minutes. Do not award it twice.
    if(start<begin||finish>end){straddles=true;continue}
    const identity=`${row.id}|${start}|${finish}`
    if(seen.has(identity))continue
    seen.add(identity)
    if(finish-start>=600000)recordedRests++
   }
  }
  const issues:Issue[]=[]
  if(requiredRests){
   if(planned)issues.push({kind:'rest',state:'unknown',message:`${requiredRests} paid 10-minute rest periods required across this California workday; planned time does not establish actual rest timing`})
   else if(!timed)issues.push({kind:'rest',state:'unknown',message:`${requiredRests} paid 10-minute rest periods required across this California workday; timing is not recorded for every source record`})
   else if(recordedRests<requiredRests&&!straddles)issues.push({kind:'rest',state:'exception',message:`Missed or short paid rest: ${requiredRests} ten-minute periods required across this California workday; ${recordedRests} recorded`})
  }
  if(straddles)issues.push({kind:'rest',state:'unknown',message:'A captured paid rest crosses the employer workday boundary; allocation and net ten-minute rest require review'})
  const records=[...new Map(day.map(p=>{
   const row=sourceRows.get(p.timeId),rule=ruleOn(p.site,p.date)
   return [`${p.timeId}|${p.site}|${rule?.id}|${rule?.revision}`,{id:p.timeId,revision:row?.revision,site:p.site,start:row?.start??p.start,end:row?.end??p.end,policyId:rule?.id,policyRevision:rule?.revision}] as const
  })).values()]
  return {scope:'California workday rest',timeId:timeIds[0],timeIds,records,site:first.site,date:workdayDate,workdayDate,workdayKey,preset:'CA',version:ruleOn(first.site,first.date)!.breakVersion,sources:breakSources.CA,issues,mealPremiumMinutes:0,
   restPremiumMinutes:issues.some(i=>i.state==='exception')?60:0,workedMinutes,requiredRests,recordedRests,
   label:'Review estimate; practical placement near the middle of each work period still requires review; employer-reviewed applicability retained; no automatic payroll change'}
 })
}
