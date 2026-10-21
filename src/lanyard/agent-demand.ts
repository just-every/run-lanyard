import {type Actor} from './domain/model'
import {load} from './domain/storage'
import {demandReport} from './domain/demand-compare'
import {learnEvaluate,learnDigest} from './domain/learn-propose'
import {localDate} from './domain/settings'
import {requireComparison,recordComparisonRead} from './comparison-scope'

// Forecast cents describe cafe sales, never wages. Raw sales, source rows, override/decision
// free text, personal attendance and labor percentages stay behind the native human doors.
function hour(x:any) {
 return {hour:x.hour,time:x.time,samples:x.samples,baseCents:x.baseCents,lowCents:x.lowCents,highCents:x.highCents,
  confidence:x.confidence,salesCents:x.salesCents,roles:x.roles,overridden:Boolean(x.override)}
}
function forecast(f:any) {
 return f?{id:f.id,revision:f.revision,version:f.version,kind:f.kind,status:f.status,reasons:f.reasons,
  savedAt:f.savedAt,source:f.source,hours:f.hours.map(hour),totals:f.totals}:null
}
export async function agentDemandRead(db:D1Database,a:Actor,site:string,date:string) {
 await requireComparison(db,a,site)
 const s=await load(db),now=new Date().toISOString(),day=date||localDate(now,s.timezone)
 const r=await demandReport(s,{...a,role:'owner'},site,day,now),o:any=r.outcome
 const result={site:r.site,date:r.date,asOf:r.asOf,timezone:r.timezone,live:forecast(r.live),saved:forecast(r.saved),
  versions:r.versions.map(v=>({id:v.id,revision:v.revision,version:v.version,kind:v.kind,status:v.status,savedAt:v.savedAt})),
  changedSinceSaved:r.changedSinceSaved,
  demandDelta:{status:o.status,reasons:o.reasons,version:o.version,hours:o.hours?.map((x:any)=>({hour:x.hour,time:x.time,
   forecastCents:x.forecastCents,actualCents:x.actualCents,errorCents:x.errorCents,unknownReason:x.unknownReason,
   requiredMinutes:x.requiredMinutes,scheduledMinutes:x.scheduledMinutes,actualMinutes:x.actualMinutes}))??null}}
 await recordComparisonRead(db,a,site,{kind:'demand',date:day})
 return result
}
export async function agentLearnRead(db:D1Database,a:Actor,site:string,weeks:number) {
 await requireComparison(db,a,site)
 const s=await load(db),e=learnEvaluate(s,{...a,role:'owner'},site,weeks,new Date().toISOString())
 const result={...e,digest:await learnDigest(e),proposals:s.learnproposals.filter(r=>r.site===site).map(r=>({id:r.id,
  revision:r.revision,version:r.version,status:r.status,weeks:r.weeks,change:r.change,evaluation:r.evaluation}))}
 await recordComparisonRead(db,a,site,{kind:'learning',weeks})
 return result
}
