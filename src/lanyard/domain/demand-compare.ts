// DEMAND-001 read: a cafe day's current forecast beside its saved versions and, once the service day has
// ended, the latest version saved before it started against entered sales and the scheduled and worked
// hours of REPORT-003. A missing outcome stays unknown with its reason; it is never read as zero.
import {type Actor,type State,need} from './model'
import {instantAt} from './settings'
import {intervalReport} from './intervals'
import {demandCompute,demandScope,digestOf,savedVersions,datePlus} from './demand'

const summary=(r:Record<string,any>)=>({id:r.id,revision:r.revision,version:r.version,kind:r.kind,status:r.status,reasons:r.reasons,digest:r.digest,savedAt:r.savedAt,savedBy:r.savedBy,hours:r.hours,totals:r.totals,assumptions:r.assumptions,overrides:r.overrides})
export function demandOutcome(s:State,site:string,date:string,asOf:string) {
 const start=instantAt(date,'00:00',s.timezone),end=instantAt(datePlus(date,1),'00:00',s.timezone)
 if(end>asOf)return {status:'service-day-not-complete',reasons:['the service day has not ended']}
 const version=savedVersions(s,site,date).find(v=>v.savedAt<start)
 if(!version)return {status:'unknown',reasons:['no forecast version was saved before the service day started']}
 const sales=s.sales.filter(r=>r.site===site&&r.date===date&&r.metric==='sales'&&r.hour!==null),report=intervalReport(s,site,date,60,asOf)
 const hours=version.hours.map((x:any)=>{
  const rows=sales.filter(r=>r.hour===x.hour),actual=rows.length?rows.reduce((n,r)=>n+r.value,0):null,i=report.intervals[x.hour]
  const error=actual!==null&&x.salesCents!==null?actual-x.salesCents:null
  return {hour:x.hour,time:x.time,forecastCents:x.salesCents,computedCents:x.baseCents,overridden:Boolean(x.override),overrideReason:x.override?.reason??null,actualCents:actual,errorCents:error,absoluteErrorCents:error===null?null:Math.abs(error),
   unknownReason:error===null?(actual===null?'sales-not-recorded':'no-forecast-for-hour'):null,
   requiredMinutes:x.roles?x.roles.reduce((n:number,r:any)=>n+r.requiredMinutes,0):null,scheduledMinutes:i.scheduled.minutes,actualMinutes:i.actual.minutes,actualLaborPercent:i.actual.laborPercent,salesPerLaborHour:i.actual.salesPerLaborHour}
 }).filter((x:any)=>x.forecastCents!==null||x.actualCents!==null||x.overridden)
 const seen=hours.filter((x:any)=>x.errorCents!==null),staffed=hours.filter((x:any)=>x.requiredMinutes!==null),sum=(list:any[],k:string)=>list.reduce((n,x)=>n+x[k],0)
 const overrides=seen.filter((x:any)=>x.overridden&&x.computedCents!==null).map((x:any)=>({hour:x.hour,computedErrorCents:x.actualCents-x.computedCents,overrideErrorCents:x.errorCents}))
 return {status:seen.length&&seen.length===hours.filter((x:any)=>x.forecastCents!==null).length?'compared':'partial',reasons:[],version:version.version,versionId:version.id,savedAt:version.savedAt,forecastStatus:version.status,hours,
  summary:{observedHours:seen.length,unknownHours:hours.length-seen.length,meanAbsoluteErrorCents:seen.length?Math.round(sum(seen,'absoluteErrorCents')/seen.length):null,signedErrorCents:seen.length?sum(seen,'errorCents'):null,errorSign:'actual minus forecast',
   staffing:{hours:staffed.length,requiredMinutes:sum(staffed,'requiredMinutes'),scheduledMinutes:Math.round(sum(staffed,'scheduledMinutes')),actualMinutes:Math.round(sum(staffed,'actualMinutes'))},overrides}}
}
export async function demandReport(s:State,a:Actor,site:string,date:string,asOf:string) {
 need(demandScope(s,a,site),'Not found',404);need(/^\d{4}-\d{2}-\d{2}$/.test(date)&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date,'Choose a day (YYYY-MM-DD)')
 const live=demandCompute(s,site,date,asOf),digest=await digestOf(live),versions=savedVersions(s,site,date),saved=versions[0]
 return {site,date,asOf,timezone:s.timezone,live:{...live,digest},saved:saved?summary(saved):null,versions:versions.map(({id,revision,version,kind,status,savedAt,savedBy,digest:d})=>({id,revision,version,kind,status,savedAt,savedBy,digest:d})),changedSinceSaved:saved?saved.digest!==digest:null,outcome:demandOutcome(s,site,date,asOf),
  note:'A forecast never creates worked hours or changes a published schedule.'}
}
