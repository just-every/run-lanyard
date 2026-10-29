import {policyWarnings} from './policy'
import {minorIssues} from './minors'
import {type Context,type Row,type State,keys,text,need,prepare,manager,self,staff,work,get,exact,put,overlap} from './model'
import {qualification,rateBasis} from './workforce'
import {localDate} from './settings'
import {patternFit,weeklyMaximumConflicts} from './patterns'
import {link,actorName,confirmations} from './history'
import {offerLog,draftOpenShift} from './openshifts'
// Glove's prepare/approve split and Dial's occurrence fences: publication acts
// on the exact draft and all conflicts are checked inside its state version.
/** An AVAIL-001 unavailable block wins; else the effective pattern's blocks or dated windows cover the whole time (adjacent ones chain). */
export function available(s:State,staffId:string,w:Record<string,any>) {
 const pattern=patternFit(s,staffId,w)
 if(pattern?.unavailable)return false
 if(pattern?.covered)return true
 const windows=s.availability.filter(a=>a.staffId===staffId).sort((a,b)=>a.start.localeCompare(b.start))
 let through=w.start;for(const v of windows)if(v.start<=through&&v.end>through)through=v.end
 return through>=w.end
}
export const onLeave=(s:State,staffId:string,w:Record<string,any>)=>s.leave.some(l=>l.staffId===staffId&&l.status==='approved'&&overlap(l,w))
export function conflicts(c:Context,shifts:Row[],week:string) {
 const errors:{shiftId:string;staffId:string;reason:string}[]=[]
 for(const s of shifts) {
  const person=c.s.staff.find(p=>p.id===s.staffId)
  const reason=!person?.active||person.erased_at?'Staff inactive':patternFit(c.s,s.staffId,s)?.unavailable?'Marked unavailable':!available(c.s,s.staffId,s)?'Outside availability':onLeave(c.s,s.staffId,s)?'Approved leave':null
  for(const reason of minorIssues(c.s,s.staffId,s,[...shifts,...c.s.shifts.filter(x=>x.status==='published'&&c.s.rosters.find(r=>r.id===x.rosterId)?.week!==week)]))errors.push({shiftId:s.id,staffId:s.staffId,reason})
  const unqualified=qualification(c.s,s.staffId,s);if(unqualified)errors.push({shiftId:s.id,staffId:s.staffId,reason:unqualified})
  if(reason)errors.push({shiftId:s.id,staffId:s.staffId,reason})
  const others=[...shifts.filter(x=>x.id!==s.id),...c.s.shifts.filter(x=>x.status==='published'&&c.s.rosters.find(r=>r.id===x.rosterId)?.week!==week)]
  if(others.some(x=>x.staffId===s.staffId&&overlap(x,s)))errors.push({shiftId:s.id,staffId:s.staffId,reason:'Overlapping shift'})
 }
 // AVAIL-001: publication and saved/approved pattern review share the weekly-limit check.
 errors.push(...weeklyMaximumConflicts(c.s,shifts,week))
 return errors
}
/** A new draft revision of a week from shift rows (each checked), listing conflicts; nothing reaches staff until roster.publish. */
export function draftWeek(c:Context,weekInput:unknown,inputs:any,openInputs?:Record<string,any>[]) {
 const week=text(weekInput,'week',10),monday=new Date(week+'T00:00:00Z');need(/^\d{4}-\d{2}-\d{2}$/.test(week)&&Number.isFinite(monday.getTime())&&monday.toISOString().slice(0,10)===week&&monday.getUTCDay()===1,'Week must be a Monday YYYY-MM-DD')
 // Editing assigned rows retains the draft's open positions; template additions supply the combined rows explicitly.
 openInputs??=c.s.openshifts.filter(o=>o.week===week&&o.status==='draft')
 need(Array.isArray(inputs)&&inputs.length+openInputs.length>0&&inputs.length+openInputs.length<=250,'Provide 1–250 shifts');const weekEnd=new Date(monday.getTime()+7*86400000).toISOString().slice(0,10)
 // Replaced private draft rows remain archived, but are never published history.
 const prior=c.s.rosters.find(r=>r.week===week&&r.status==='draft');if(prior){for(const s of c.s.shifts.filter(s=>s.rosterId===prior.id&&s.status!=='replaced-draft'))put(c,'shifts',{...s,status:'replaced-draft'},s);for(const o of c.s.openshifts.filter(o=>o.rosterId===prior.id&&o.status==='draft'))put(c,'openshifts',{...o,status:'replaced-draft'},o)}
 // Ordinary editing must retain the generated draft's publication review fence.
 const r=put(c,'rosters',{week,timezone:c.s.timezone,status:'draft',preparedBy:c.a.id,preparedAt:c.now,...(prior?.generationReview?{generationReview:prior.generationReview}:{})},prior)
 const shifts=inputs.map((value:any)=>{need(value&&typeof value==='object'&&!Array.isArray(value),'Invalid shift');keys(value,['staffId','start','end','breakMinutes','label','site','job']);const w=work(value),date=localDate(w.start,c.s.timezone),person=staff(c,value.staffId);need(date>=week&&date<weekEnd,'Shift must start in the selected venue week');const job=text(value.job,'job',80,true),site=text(value.site,'site',80,true)||person.site||'';return put(c,'shifts',{rateBasis:rateBasis(c.s,person.id,{...w,job,site}),job,rosterId:r.id,staffId:person.id,...w,label:text(value.label,'label',120,true),site:text(value.site,'site',80,true)||person.site||'',status:'draft'})})
 const openShifts=openInputs.map(value=>{const date=localDate(value.start,c.s.timezone);need(date>=week&&date<weekEnd,'Shift must start in the selected venue week');return draftOpenShift(c,r.id,week,value as any)})
 c.entity=r.id;return {...r,shifts,openShifts,conflicts:conflicts(c,shifts,week),policyWarnings:policyWarnings(c.s,shifts,week),approvalRequired:'roster.publish',approval:{id:r.id,revision:r.revision}}
}
export function roster(c:Context,name:string,p:Record<string,any>) {
 if(name==='roster.prepare') {
  prepare(c.a);keys(p,['week','shifts']);return draftWeek(c,p.week,p.shifts)
 }
 if(name==='roster.publish') {
  manager(c.a);keys(p,['id','revision','reason']);const r=get(c.s,'rosters',p.id);exact(r,p);need(r.status==='draft','Only drafts can be published',409);need(r.timezone===c.s.timezone,'Venue timezone changed; prepare this roster again',409);const shifts=c.s.shifts.filter(s=>s.rosterId===r.id&&s.status==='draft'),issues=conflicts(c,shifts,r.week);need(shifts.length>0||c.s.openshifts.some(o=>o.rosterId===r.id&&o.status==='draft'),'Empty roster',409);need(!issues.length,issues.map(x=>x.reason).join('; '),409)
  // SCHEDULE-006: each row continues the shift line it repeats from the current revision.
  const lines=link(c.s,r.week,shifts)
  for(const old of c.s.rosters.filter(x=>x.week===r.week&&x.status==='published')){put(c,'rosters',{...old,status:'superseded'},old);for(const s of c.s.shifts.filter(s=>s.rosterId===old.id&&s.status==='published'))put(c,'shifts',{...s,status:'superseded'},s)}
  shifts.forEach((s,i)=>put(c,'shifts',{...s,status:'published',lineage:lines[i]},s))
  // COVER-002: the draft's position-only rows are posted as open shifts with it.
  for(const o of c.s.openshifts.filter(o=>o.rosterId===r.id&&o.status==='draft'))put(c,'openshifts',{...o,order:'all',status:'open',postedBy:c.a.id,postedAt:c.now,...offerLog(c.s,{...o,order:'all'},c.now)},o)
  return put(c,'rosters',{...r,status:'published',publishedBy:c.a.id,publishedByName:actorName(c),publishedAt:c.now,reason:text(p.reason,'reason',280,true)},r)
 }
 if(name==='shift.confirm') {
  keys(p,['id','revision']);const r=get(c.s,'shifts',p.id);need(r.staffId===self(c.a),'Only your own shift',403);exact(r,p);need(r.status==='published','Shift is no longer published',409);return put(c,'shifts',{...r,confirmations:[...confirmations(r),{staffId:r.staffId,at:c.now}],confirmedAt:c.now,confirmedBy:c.a.id},r)
 }
 return undefined
}
