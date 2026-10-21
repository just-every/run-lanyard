import {workweek} from './payschedules'
import {rateBasis} from './workforce'
// COST-002: in-week overtime risk from actual hours. A person's workweek (Monday to Sunday on the
// venue clock) is projected as the time recorded before the as-of instant plus their published
// shifts starting at or after it, at every cafe. Above 40 hours the owner and the managers of the
// person's cafes see an alert with the premium estimate and qualified substitutes for each
// remaining shift; pending pickups and swaps show the same projection before approval.
import {type Actor,type Context,type Row,type State,keys,text,need,manager,get,exact,put} from './model'
import {fit} from './cover'
import {siteOf} from './team'
import {localDate} from './settings'

export const WEEK=40*60
const mins=(a:string,b:string)=>Math.max(0,Math.floor((Date.parse(b)-Date.parse(a))/60000))
const live=(t:Row)=>['submitted','approved','returned'].includes(t.status)

/** A person's projected workweek as of `at`; `add` and `skip` model a pending pickup or swap. Premium: half the hourly rate per overtime hour, to the nearest cent. */
export function project(s:State,staffId:string,week:string,at:string,add:Row[]=[],skip:string[]=[]) {
 week=workweek(s,staffId,week)
 const days:Record<string,number>={},count=(start:string,m:number)=>{const d=localDate(start,s.timezone);days[d]=(days[d]??0)+m}
 const here=(start:string)=>workweek(s,staffId,localDate(start,s.timezone))===week
 let actual=0,scheduled=0
 // Recorded time: live timesheets (a pending correction replaces its source) and open punches up to `at`.
 for(const t of s.timesheets)if(t.staffId===staffId&&live(t)&&t.start<at&&here(t.start)&&!s.timesheets.some(x=>x.corrects===t.id&&live(x))){actual+=t.minutes;count(t.start,t.minutes)}
 for(const k of s.clocks)if(k.staffId===staffId&&k.status==='open'&&k.start<at&&here(k.start)){const m=mins(k.start,at);actual+=m;count(k.start,m)}
 const punched=new Set(s.clocks.filter(k=>k.start<at&&k.shiftId).map(k=>k.shiftId))
 const remaining=[...s.shifts.filter(x=>x.staffId===staffId&&x.status==='published'&&!skip.includes(x.id)),...add].filter(x=>x.start>=at&&here(x.start)&&!punched.has(x.id)).sort((a,b)=>a.start.localeCompare(b.start))
 for(const x of remaining){scheduled+=x.minutes;count(x.start,x.minutes)}
 const total=actual+scheduled,overtime=Math.max(0,total-WEEK),rate=s.staff.find(p=>p.id===staffId)?.rate_cents
 return {staffId,week,asOf:at,actualMinutes:actual,scheduledMinutes:scheduled,projectedMinutes:total,overtimeMinutes:overtime,premiumCents:typeof rate==='number'?Math.round(overtime*rate/120):null,days,remaining}
}
/** The projection's figures alone, for a pending pickup or swap. */
export const cost=(p:ReturnType<typeof project>)=>({staffId:p.staffId,projectedMinutes:p.projectedMinutes,overtimeMinutes:p.overtimeMinutes,premiumCents:p.premiumCents})

/** Teammates in the person's position (everyone, when unset) who are free for the shift and stay at or under 40 projected hours with it. */
export function substitutes(s:State,shift:Row,at:string) {
 const owner=s.staff.find(p=>p.id===shift.staffId),week=localDate(shift.start,s.timezone)
 return s.staff.filter(p=>p.id!==shift.staffId&&p.active&&!p.erased_at&&(!owner?.position||p.position===owner.position)).flatMap(p=>{
  const f=fit(s,p.id,shift);if(f.reason&&f.reason!=='overtime')return []
  const after=project(s,p.id,week,at,[shift]).projectedMinutes;return after<=WEEK?[{staffId:p.id,name:p.name,projectedMinutes:after}]:[]
 }).sort((a,b)=>a.projectedMinutes-b.projectedMinutes||a.name.localeCompare(b.name))
}
/** Everyone projected over 40 hours in the week, with each remaining shift's substitutes. */
export function alerts(s:State,week:string,at:string) {
 const ids=new Set([...s.shifts.filter(x=>x.status==='published'),...s.timesheets,...s.clocks.filter(k=>k.status==='open')].map(x=>x.staffId))
 return [...ids].map(id=>project(s,id,week,at)).filter(p=>p.overtimeMinutes>0).map(p=>{const person=s.staff.find(v=>v.id===p.staffId)
  return {...p,name:person?.name??'Former staff',site:person?.site??'',remaining:p.remaining.map(x=>({shiftId:x.id,revision:x.revision,start:x.start,end:x.end,minutes:x.minutes,site:siteOf(s,x),substitutes:substitutes(s,x,at)}))}})
}
/** Until TEAM-001 brings site scopes, a manager reads alerts for people whose home cafe or remaining shifts are at the manager's home cafe; the owner reads every alert. */
export function alertsFor(s:State,a:Actor,week:string,at:string) {
 if(a.role==='owner')return alerts(s,week,at)
 const home=s.staff.find(p=>p.id===a.staffId)?.site??''
 return alerts(s,week,at).filter(x=>x.site===home||x.remaining.some(r=>r.site===home))
}
/** The weeks a manager's screens show alerts for: the current week and every later week with published shifts. */
export function upcoming(s:State,a:Actor,now:string) {
 const dates=[...new Set([localDate(now,s.timezone),...s.shifts.filter(x=>x.status==='published'&&x.start>=now).map(x=>localDate(x.start,s.timezone))])].sort()
 const seen=new Set<string>()
 return dates.flatMap(d=>alertsFor(s,a,d,now)).filter(r=>{const key=r.staffId+'|'+r.week;if(seen.has(key))return false;seen.add(key);return true})
}
export function overtime(c:Context,name:string,p:Record<string,any>) {
 if(name!=='overtime.substitute')return undefined
 // A manager of the shift's cafe (or the owner) gives a remaining shift of a person projected over 40 hours to a listed substitute.
 manager(c.a);keys(p,['shiftId','revision','staffId']);const r=get(c.s,'shifts',p.shiftId);exact(r,p)
 need(r.status==='published'&&!r.callout,'Only a published shift that is not called out',409);need(r.start>c.now,'This shift has already started',409)
 if(c.a.role==='manager')need((c.s.staff.find(v=>v.id===c.a.staffId)?.site??'')===siteOf(c.s,r),'Only a manager of this shift’s cafe can reassign it',403)
 need(project(c.s,r.staffId,localDate(r.start,c.s.timezone),c.now).overtimeMinutes>0,'No overtime is projected for this shift’s person',409)
 const to=text(p.staffId,'substitute',80);need(substitutes(c.s,r,c.now).some(x=>x.staffId===to),'This person is not a qualified substitute without overtime',409)
 const {confirmedAt,confirmedBy,...rest}=r
 return put(c,'shifts',{...rest,staffId:to,rateBasis:rateBasis(c.s,to,r),substitute:{from:r.staffId,by:c.a.id,at:c.now,reason:'projected overtime'}},r)
}
