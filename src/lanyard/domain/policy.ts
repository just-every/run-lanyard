// POLICY-001: versioned overtime core. Meal timing and statutory premium payroll
// remain separate unfinished obligations; these estimates never submit wages.
import {type State,type Row} from './model'
import {dayAfter} from './aca'
import {localDate} from './settings'
import {priced} from './workforce'
import {workweek} from './payschedules'
import {breakSources} from './policy-breaks'
import {breakReviewsFor} from './policy-break-review'
import {alternateLimits} from './policy-alternate'
import {covered,coverageReview} from './policy-coverage'
import {consecutiveWork} from './policy-consecutive'

const version=(r:Row)=>{const {versions,...v}=r;return v}
export function policyOn(s:State,site:string,on:string){
 return s.policies.filter(r=>r.site===site).flatMap(r=>[...(r.versions??[]),version(r)]).filter(r=>r.from<=on).sort((a,b)=>a.from.localeCompare(b.from)||a.revision-b.revision).at(-1)
}
export function policyLabel(r:any){return r.preset==='custom'?`${r.jurisdiction}: employer-configured, unmaintained`:`${r.preset} overtime core (${r.presetVersion}); meal and rest compliance incomplete`}
/** Actuals use approved retained rate allocations; all sites and jobs share the
 * employee workweek. Daily premiums never count twice toward weekly overtime.
 * A date uses the strongest threshold of the sites actually worked that date. */
export function policyClassification(s:State,staffId:string,week:string,planned?:Row[]){
 const rows=planned??s.timesheets.filter(t=>t.staffId===staffId&&t.status==='approved')
 const allParts=rows.filter(t=>t.staffId===staffId).flatMap(t=>{
  const areas=t.workSegments?.length?t.workSegments:[t]
  return areas.flatMap((area:any)=>{const basis=area.rateBasis??priced(s,staffId,{...t,...area});return basis.segments.map((p:any)=>({date:p.date,minutes:p.minutes,cents:p.cents,rateReference:{from:p.from,profileId:p.profileId,profileRevision:p.profileRevision,jobRevision:basis.jobRevision},site:basis.site??t.site??s.staff.find(x=>x.id===staffId)?.site??'',timeId:t.id,revision:t.revision,start:area.start??t.start,end:area.end??t.end,area:area.area??'',job:area.job??t.job??''}))})
 }).sort((a:any,b:any)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start)||a.timeId.localeCompare(b.timeId))
 const consecutive=consecutiveWork(s,allParts,rows,((site,on)=>{const r=policyOn(s,site,on);return r&&!covered(r,staffId,'stateConsecutive')?{...r,consecutiveMinutes:0}:r}))
 const parts=allParts.filter((p:any)=>workweek(s,staffId,p.date)===week)
 const dayTotals=new Map<string,number>();for(const p of parts)dayTotals.set(p.date,(dayTotals.get(p.date)??0)+p.minutes)
 const alternative=(r:any,on:string)=>alternateLimits(r,staffId,on,dayTotals.get(on)??0)
 const daily=new Map<string,number>(),rules=new Map<string,any>(),workedDays=new Set<string>(parts.map((p:any)=>p.date))
 for(const p of parts){const r=policyOn(s,p.site,p.date);if(r)rules.set(p.date+'|'+p.site,r)}
 const classify=(useConsecutive:boolean)=>{let regularWeek=0;daily.clear();return parts.map((p:any)=>{
  const own=policyOn(s,p.site,p.date),dayRules=[...rules.entries()].filter(([key])=>key.startsWith(p.date+'|')).map(([,r])=>r)
  // Nevada's current general minimum wage is USD 12; daily overtime applies
  // below 1.5 times that amount. Missing wage evidence never waives the check.
  const dailyLimit=(r:any)=>!covered(r,staffId,'stateDaily')?1440:useConsecutive&&r.preset==='CO'&&r.consecutiveMinutes?1440:r.preset==='NV'&&p.cents!==null&&p.cents>=1800?1440:alternative(r,p.date)?.dailyMinutes??r.dailyMinutes
  const ca=dayRules.some(r=>r.preset==='CA'&&covered(r,staffId,'stateSeventh')),seventh=ca&&Array.from({length:7},(_,i)=>dayAfter(p.date,-i)).every(d=>d>=week&&workedDays.has(d))
  const dailyMax=Math.min(1440,...dayRules.map(dailyLimit)),doubleMax=Math.min(1440,...dayRules.map(r=>covered(r,staffId,'stateDaily')?(alternative(r,p.date)?.doubleMinutes??r.doubleMinutes):1440)),weeklyMax=Math.min(parts.some((q:any)=>covered(policyOn(s,q.site,q.date),staffId,'federalOvertime'))?2400:10080,...parts.map((q:any)=>{const rule=policyOn(s,q.site,q.date);return rule&&covered(rule,staffId,'stateWeekly')?rule.weeklyMinutes:10080}))
  const before=daily.get(p.date)??0,after=before+p.minutes;daily.set(p.date,after)
  const over=(bound:number)=>Math.max(0,after-bound)-Math.max(0,before-bound)
  const doubleMinutes=over(seventh?480:doubleMax),dailyOvertime=seventh?p.minutes-doubleMinutes:Math.max(useConsecutive?consecutive.get(p)?.minutes??0:0,Math.max(0,over(dailyMax)-doubleMinutes))
  const eligible=p.minutes-doubleMinutes-dailyOvertime,weeklyOvertime=Math.max(0,regularWeek+eligible-weeklyMax)-Math.max(0,regularWeek-weeklyMax);regularWeek+=eligible
  const overtimeMinutes=dailyOvertime+weeklyOvertime,regularMinutes=p.minutes-overtimeMinutes-doubleMinutes
  return {...p,regularMinutes,overtimeMinutes,doubleMinutes,consecutiveOvertimeMinutes:consecutive.get(p)?.minutes??0,consecutiveEvidenceUnknown:consecutive.get(p)?.unknown??false,rules:dayRules.map(r=>({id:r.id,revision:r.revision,preset:r.preset,version:r.presetVersion,source:r.source,consecutiveMinutes:r.consecutiveMinutes??0,alternate:alternative(r,p.date),label:policyLabel(r)})),configured:!!own}
 })}
 const dailyOutput=classify(false),consecutiveOutput=classify(true)
 const premium=(list:any[])=>list.reduce((n,p)=>n+p.overtimeMinutes*.5+p.doubleMinutes,0)
 const consecutiveWins=premium(consecutiveOutput)>premium(dailyOutput),output=consecutiveWins?consecutiveOutput:dailyOutput
 const breakReviews=breakReviewsFor(s,rows.filter(t=>t.staffId===staffId),week,!!planned,((site,on)=>policyOn(s,site,on)))
 // California pays at most one hour for each break kind per person and day,
 // even when several shifts or cafes have exceptions.
 const premiumDays=new Map<string,{meal:number;rest:number}>()
 for(const r of breakReviews){const d=premiumDays.get(r.date)??{meal:0,rest:0};d.meal=Math.max(d.meal,r.mealPremiumMinutes);d.rest=Math.max(d.rest,r.restPremiumMinutes);premiumDays.set(r.date,d)}
 const weeklyRestReviews=illinoisRest(s,rows.filter(t=>t.staffId===staffId),week)
 const alternateReviews=parts.flatMap((p:any)=>{const r=policyOn(s,p.site,p.date),review=r?alternative(r,p.date):null;return review?[{date:p.date,site:p.site,...review}]:[]})
 const coverage=coverageReview(s,staffId,parts,((site,on)=>policyOn(s,site,on)))
 const breakPremiumMinutes=[...premiumDays.values()].reduce((n,d)=>n+d.meal+d.rest,0)
 const total=(key:string)=>output.reduce((n:number,p:any)=>n+p[key],0),minutes=total('minutes'),known=output.every((p:any)=>p.cents!==null)
 const weightedRateCents=minutes&&known?output.reduce((n:number,p:any)=>n+p.minutes*p.cents,0)/minutes:null
 const overtimeMinutes=total('overtimeMinutes'),doubleMinutes=total('doubleMinutes')
 return {staffId,week,overtimeBasis:consecutiveWins?'consecutive hours and weekly':'daily and weekly',coverage,alternateReviews,classificationIncomplete:alternateReviews.some(r=>r.reviewRequired)||coverage.issues.length>0||output.some(p=>p.consecutiveEvidenceUnknown),weeklyRestReviews,breakReviews,breakPremiumMinutes,breakPremiumEstimateCents:weightedRateCents===null?null:Math.round(breakPremiumMinutes*weightedRateCents/60),end:dayAfter(week,6),minutes,regularMinutes:total('regularMinutes'),overtimeMinutes,doubleMinutes,weightedRateCents,estimateCents:weightedRateCents===null?null:Math.round((minutes+overtimeMinutes*.5+doubleMinutes)*weightedRateCents/60),label:'Weighted-average estimate; provider regular-rate treatment is authoritative; meal and rest premiums excluded',parts:output}
}
export function policyWarnings(s:State,shifts:Row[],week:string){
 const all=[...s.shifts.filter(x=>x.status==='published'&&s.rosters.find(r=>r.id===x.rosterId)?.week!==week),...shifts]
 const result:{kind:string;site:string;date?:string;message:string}[]=[],seenBreaks=new Set<string>()
 const breakChecks=[...new Set(shifts.map(x=>x.staffId))].flatMap(id=>breakReviewsFor(s,all.filter(x=>x.staffId===id),week,true,((site,on)=>policyOn(s,site,on))))
 for(const x of shifts){const site=x.site??s.staff.find(p=>p.id===x.staffId)?.site??'',r=policyOn(s,site,localDate(x.start,s.timezone));if(!r)continue
  const rest=minimumRestIssue(s,x.staffId,x,[],all);if(rest)result.push({kind:'policy',site,date:localDate(x.start,s.timezone),message:`${s.staff.find(p=>p.id===x.staffId)?.name}: ${rest}`})
  const review=breakChecks.find(b=>b.timeIds.includes(x.id)),breakKey=review?.timeIds.join('|')??''
  if(review?.issues.length&&!seenBreaks.has(breakKey)){seenBreaks.add(breakKey);result.push({kind:'policy',site,date:review.date,message:`${s.staff.find(p=>p.id===x.staffId)?.name}: ${r.preset} break review (${review.version}): ${review.issues.map(i=>i.message).join('; ')}. ${review.sources.join(' ')}. ${review.label}.`})}
  const report=policyClassification(s,x.staffId,workweek(s,x.staffId,localDate(x.start,s.timezone)),all),mine=report.parts.filter((p:any)=>p.timeId===x.id)
  const overtime=mine.reduce((n:number,p:any)=>n+p.overtimeMinutes,0),double=mine.reduce((n:number,p:any)=>n+p.doubleMinutes,0)
  if(overtime||double||r.preset==='custom')result.push({kind:'policy',site,date:localDate(x.start,s.timezone),message:`${s.staff.find(p=>p.id===x.staffId)?.name}: ${policyLabel(r)}: ${overtime} overtime minutes; ${double} double-time minutes. ${report.label}.`})
 }
 for(const staffId of new Set(shifts.map(x=>x.staffId)))for(const r of illinoisRest(s,all.filter(x=>x.staffId===staffId),week))result.push({kind:'policy',site:r.site,date:r.date,message:`${s.staff.find(p=>p.id===staffId)?.name}: ${r.message} (${r.version}). ${r.source}. Exemptions and permits require review.`})
 return result
}
/** Illinois rest review includes the six preceding venue dates across week
 * boundaries and cafes. A full 24-hour gap avoids a seventh-day exception. */
function illinoisRest(s:State,rows:Row[],week:string){
 return rows.filter(t=>localDate(t.start,s.timezone)>=week&&localDate(t.start,s.timezone)<=dayAfter(week,6)).flatMap(t=>{
  const date=localDate(t.start,s.timezone),site=t.site??s.staff.find(p=>p.id===t.staffId)?.site??'',r=policyOn(s,site,date)
  if(r?.preset!=='IL'||!r.breakVersion||!covered(r,t.staffId,'weeklyRest'))return []
  const days=Array.from({length:7},(_,i)=>dayAfter(date,-i)),prior=rows.filter(x=>days.includes(localDate(x.start,s.timezone))).sort((a,b)=>a.start.localeCompare(b.start))
  if(!days.every(d=>prior.some(x=>localDate(x.start,s.timezone)===d)))return []
  let end=prior[0].end
  for(const x of prior.slice(1)){if(Date.parse(x.start)-Date.parse(end)>=86400000)return [];if(x.end>end)end=x.end}
  return [{timeId:t.id,site,date,policyId:r.id,policyRevision:r.revision,version:r.breakVersion,source:breakSources.IL[0],message:'Seventh consecutive workday without 24 consecutive hours of rest',state:'exception'}]
 })
}
export function minimumRestIssue(s:State,staffId:string,shift:Row,skip:string[]=[],plans?:Row[]){
 const site=shift.site??s.staff.find(p=>p.id===staffId)?.site??'',r=policyOn(s,site,localDate(shift.start,s.timezone));if(!r?.minimumRestMinutes)return null
 const other=(plans??s.shifts.filter(x=>x.status==='published')).filter(x=>x.staffId===staffId&&x.id!==shift.id&&!skip.includes(x.id))
 const short=other.some(x=>{const gap=x.end<=shift.start?(Date.parse(shift.start)-Date.parse(x.end))/60000:x.start>=shift.end?(Date.parse(x.start)-Date.parse(shift.end))/60000:Infinity;return gap<r.minimumRestMinutes})
 return short?`${r.minimumRestLabel}: ${r.minimumRestMinutes} minutes required (${r.presetVersion})`:null
}
