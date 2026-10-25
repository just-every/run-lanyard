import {workweek} from './payschedules'
import {provisional} from './closerules'
import {rateBasis,priced,qualification} from './workforce'
import {policyClassification,minimumRestIssue} from './policy'
import {startOf,transferPlan} from './transfers'
import {segmentPlan,reconcileSegments} from './worksegments'
// COST-002 inherits POLICY-001: recorded work plus remaining published shifts
// across cafes use the same classifier as actual payroll reviews.
import {type Actor,type Context,type Row,type State,keys,text,need,manager,get,exact,put} from './model'
import {fit} from './cover'
import {siteOf} from './team'
import {localDate} from './settings'

export const WEEK=40*60
const mins=(a:string,b:string)=>Math.max(0,Math.floor((Date.parse(b)-Date.parse(a))/60000))
const live=(t:Row)=>['submitted','approved','returned'].includes(t.status)

/** Retain recorded rates and area allocations; a receiving person uses their own rates. */
function classificationRow(s:State,staffId:string,x:Row) {
 const row={...x,staffId},basis=priced(s,staffId,row)
 const workSegments=x.staffId===staffId&&x.workSegments?.length?x.workSegments:
  basis.workSegments?.length?basis.workSegments:reconcileSegments(s,staffId,row,x.segmentPlan??segmentPlan(s,staffId,row,x.id))
 const source=x.corrects?s.timesheets.find(t=>t.id===x.corrects):undefined
 const retain=(b:any,prior:any)=>!prior?b:{...b,segments:b.segments.map((p:any)=>({...p,...(prior.segments.find((q:any)=>q.date===p.date)??prior.segments.at(-1)),minutes:p.minutes,date:p.date}))}
 return {...row,rateBasis:retain(basis,source?.rateBasis),...(workSegments.length?{workSegments:workSegments.map((p:any)=>({...p,rateBasis:retain(p.rateBasis,source?.workSegments?.find((q:any)=>q.job===p.job&&q.area===p.area)?.rateBasis??source?.rateBasis)}))}:{})}
}
/** A person's projected workweek as of `at`; `add` and `skip` model a pending pickup or swap. */
export function project(s:State,staffId:string,week:string,at:string,add:Row[]=[],skip:string[]=[]) {
 week=workweek(s,staffId,week)
 const days:Record<string,number>={},count=(start:string,m:number)=>{const d=localDate(start,s.timezone);days[d]=(days[d]??0)+m}
 const here=(start:string)=>workweek(s,staffId,localDate(start,s.timezone))===week
 let actual=0,scheduled=0
 const recorded:Row[]=[]
 // Recorded time: live timesheets (a pending correction replaces its source) and open punches up to `at`.
 for(const t of s.timesheets)if(t.staffId===staffId&&live(t)&&t.start<at&&!s.timesheets.some(x=>x.corrects===t.id&&live(x))){if(here(t.start)){actual+=t.minutes;count(t.start,t.minutes)}recorded.push(classificationRow(s,staffId,t))}
 for(const k of s.clocks)if(k.staffId===staffId&&k.status==='open'&&k.start<at){
  const end=provisional(s,k,at)?.end??at,m=mins(k.start,end);if(here(k.start)){actual+=m;count(k.start,m)}
  const row={...k,...startOf(s,k),end,minutes:m,segmentPlan:transferPlan(s,k,end)??segmentPlan(s,staffId,{...k,end},k.shiftId)}
  recorded.push(classificationRow(s,staffId,row))
 }
 const punched=new Set(s.clocks.filter(k=>k.start<at&&k.shiftId).map(k=>k.shiftId))
 const planned=[...s.shifts.filter(x=>x.staffId===staffId&&x.status==='published'&&!skip.includes(x.id)),...add].filter(x=>x.start>=at&&!punched.has(x.id)).sort((a,b)=>a.start.localeCompare(b.start)),remaining=planned.filter(x=>here(x.start))
 for(const x of remaining){scheduled+=x.minutes;count(x.start,x.minutes)}
 const total=actual+scheduled,overtime=Math.max(0,total-WEEK),rate=s.staff.find(p=>p.id===staffId)?.rate_cents
 const base={staffId,week,asOf:at,actualMinutes:actual,scheduledMinutes:scheduled,projectedMinutes:total,overtimeMinutes:overtime,premiumCents:typeof rate==='number'?Math.round(overtime*rate/120):null,days,remaining}
 // Adjacent work remains context for consecutive-hours rules across a week boundary.
 const report=policyClassification(s,staffId,week,[...recorded,...planned.map(x=>classificationRow(s,staffId,x))])
 if(!report.parts.some(p=>p.rules.length))return base
 const actualIds=new Set(recorded.map(t=>t.id)),classifiedDays:Record<string,number>={}
 for(const p of report.parts)classifiedDays[p.date]=(classifiedDays[p.date]??0)+p.minutes
 const actualMinutes=report.parts.filter(p=>actualIds.has(p.timeId)).reduce((n,p)=>n+p.minutes,0)
 return {...base,actualMinutes,scheduledMinutes:report.minutes-actualMinutes,projectedMinutes:report.minutes,days:classifiedDays,overtimeMinutes:report.overtimeMinutes,doubleMinutes:report.doubleMinutes,
  premiumCents:report.classificationIncomplete||report.weightedRateCents===null?null:Math.round((report.overtimeMinutes*.5+report.doubleMinutes)*report.weightedRateCents/60),
  policy:{label:report.label,overtimeBasis:report.overtimeBasis,classificationIncomplete:report.classificationIncomplete,weightedRateCents:report.weightedRateCents,parts:report.parts}}
}
/** Existing cost readers receive the estimate and cited versions. Full actual
 * classification details remain on the owner-only policy review door. */
function summary(policy:any){
 const {parts,...rest}=policy
 const sources=[...new Map(parts.flatMap((p:any)=>p.rules).map((r:any)=>[r.id+':'+r.revision,{id:r.id,revision:r.revision,preset:r.preset,version:r.version,source:r.source,consecutiveMinutes:r.consecutiveMinutes,label:r.label}])).values()]
 return {...rest,sources}
}
/** The projection's figures alone, for a pending pickup or swap. */
export const cost=(p:ReturnType<typeof project>)=>({staffId:p.staffId,projectedMinutes:p.projectedMinutes,overtimeMinutes:p.overtimeMinutes,premiumCents:p.premiumCents,...('policy' in p?{doubleMinutes:p.doubleMinutes,policy:summary(p.policy)}:{})})

/** Qualified teammates who remain free of projected overtime and double time. */
export function substitutes(s:State,shift:Row,at:string) {
 const owner=s.staff.find(p=>p.id===shift.staffId),week=localDate(shift.start,s.timezone)
 return s.staff.filter(p=>p.id!==shift.staffId&&p.active&&!p.erased_at&&(!owner?.position||p.position===owner.position)).flatMap(p=>{
  const f=fit(s,p.id,shift);if(f.reason&&f.reason!=='overtime')return []
  if(minimumRestIssue(s,p.id,shift))return []
  const candidate=classificationRow(s,p.id,shift)
  if(candidate.workSegments?.some((area:any)=>qualification(s,p.id,{...candidate,...area})))return []
  const after=project(s,p.id,week,at,[shift]);return !after.overtimeMinutes&&(!('doubleMinutes' in after)||!after.doubleMinutes)?[{staffId:p.id,name:p.name,projectedMinutes:after.projectedMinutes}]:[]
 }).sort((a,b)=>a.projectedMinutes-b.projectedMinutes||a.name.localeCompare(b.name))
}
/** Everyone projected into overtime or double time, with remaining shifts' substitutes. */
export function alerts(s:State,week:string,at:string) {
 const ids=new Set([...s.shifts.filter(x=>x.status==='published'),...s.timesheets,...s.clocks.filter(k=>k.status==='open')].map(x=>x.staffId))
 return [...ids].map(id=>project(s,id,week,at)).filter(p=>p.overtimeMinutes>0||('doubleMinutes' in p&&p.doubleMinutes>0)).map(p=>{const person=s.staff.find(v=>v.id===p.staffId)
  return {...p,name:person?.name??'Former staff',site:person?.site??'',remaining:p.remaining.map(x=>({shiftId:x.id,revision:x.revision,start:x.start,end:x.end,minutes:x.minutes,site:siteOf(s,x),substitutes:substitutes(s,x,at)}))}})
}
/** Until TEAM-001 brings site scopes, a manager reads alerts for people whose home cafe or remaining shifts are at the manager's home cafe; the owner reads every alert. */
export function alertsFor(s:State,a:Actor,week:string,at:string) {
 if(a.role==='owner')return alerts(s,week,at)
 if(a.role!=='manager')return []
 const home=s.staff.find(p=>p.id===a.staffId)?.site??''
 return alerts(s,week,at).filter(x=>x.site===home||x.remaining.some(r=>r.site===home)).map(x=>'policy' in x?{...x,policy:summary(x.policy)}:x)
}
/** The weeks a manager's screens show alerts for: the current week and every later week with published shifts. */
export function upcoming(s:State,a:Actor,now:string) {
 const dates=[...new Set([localDate(now,s.timezone),...s.shifts.filter(x=>x.status==='published'&&x.start>=now).map(x=>localDate(x.start,s.timezone))])].sort()
 const seen=new Set<string>()
 return dates.flatMap(d=>alertsFor(s,a,d,now)).filter(r=>{const key=r.staffId+'|'+r.week;if(seen.has(key))return false;seen.add(key);return true})
}
export function overtime(c:Context,name:string,p:Record<string,any>) {
 if(name!=='overtime.substitute')return undefined
 // A manager of the shift's cafe (or the owner) gives remaining premium work to a listed substitute.
 manager(c.a);keys(p,['shiftId','revision','staffId']);const r=get(c.s,'shifts',p.shiftId);exact(r,p)
 need(r.status==='published'&&!r.callout,'Only a published shift that is not called out',409);need(r.start>c.now,'This shift has already started',409)
 if(c.a.role==='manager')need((c.s.staff.find(v=>v.id===c.a.staffId)?.site??'')===siteOf(c.s,r),'Only a manager of this shift’s cafe can reassign it',403)
 const projected=project(c.s,r.staffId,localDate(r.start,c.s.timezone),c.now)
 need(projected.overtimeMinutes>0||('doubleMinutes' in projected&&projected.doubleMinutes>0),'No overtime is projected for this shift’s person',409)
 const to=text(p.staffId,'substitute',80);need(substitutes(c.s,r,c.now).some(x=>x.staffId===to),'This person is not a qualified substitute without overtime',409)
 const {confirmedAt,confirmedBy,...rest}=r
 return put(c,'shifts',{...rest,staffId:to,rateBasis:rateBasis(c.s,to,r),substitute:{from:r.staffId,by:c.a.id,at:c.now,reason:'projected overtime'}},r)
}
