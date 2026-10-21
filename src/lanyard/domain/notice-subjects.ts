// NOTICE-002a: current purposes only. Persistence, recipients and escalation belong
// to notices.ts; these subjects contain no copied reasons, rates or private notes.
import {type Row,type State,canonical} from './model'
import {confirmations,swapHistory} from './history'
import {siteOf} from './team'
import {instantAt} from './settings'
import {periodOf} from './periods'
import {provisional} from './closerules'
import {pickupFit} from './openshifts'
import {opensFor} from './offerorder'

export type NoticeSubject={kind:string;subject:string;basis:string;staffId?:string;site:string;due:string;expires?:string;label:string;employee:boolean}

const minutes=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0
const stamp=(v:unknown):v is string=>typeof v==='string'&&Number.isFinite(Date.parse(v))
const after=(at:string,n:number)=>new Date(Date.parse(at)+n*60000).toISOString()
const latest=(...values:unknown[])=>values.filter(stamp).sort((a,b)=>Date.parse(b)-Date.parse(a))[0]
const active=(s:State,id:string)=>s.staff.some(p=>p.id===id&&p.active&&!p.erased_at)
const ruleFor=(s:State,site:string)=>s.noticerules.find(r=>r.site===site)

/** Operational assignment facts survive an acknowledgment or a call-out note.
 * New published rows and real changes of assignee still supersede their basis. */
function shiftBasis(s:State,x:Row) {
 const roster=s.rosters.find(r=>r.id===x.rosterId)
 return canonical([x.id,x.rosterId,x.staffId,x.start,x.end,x.breakMinutes,siteOf(s,x),
  roster?.publishedAt,swapHistory(x).map(w=>[w.id,w.to,w.at]),x.substitute?.at,
  x.callout?.approvals?.map((a:any)=>[a.offerId,a.staffId,a.approvedAt])??x.callout?.approvedAt])
}
function assignmentAt(s:State,x:Row) {
 return latest(s.rosters.find(r=>r.id===x.rosterId)?.publishedAt,
  ...swapHistory(x).map(w=>w.at),x.substitute?.at,x.callout?.approvedAt,
  ...((x.callout?.approvals??[]).map((a:any)=>a.approvedAt)),
  s.openshifts.find(o=>o.id===x.openShiftId)?.filledAt)
}
function confirmed(s:State,x:Row,since:string) {
 // Native changes clear confirmedAt on a changed assignment, but preserve it
 // when another shift in the week changes and this row is merely carried on.
 if(stamp(x.confirmedAt))return true
 if(confirmations(x).some(a=>a.staffId===x.staffId&&stamp(a.at)&&Date.parse(a.at)>=Date.parse(since)))return true
 // Taking an approved swap or cover is already a personal confirmation, even
 // when the employee's acceptance preceded the manager's assignment decision.
 const swap=swapHistory(x).at(-1)
 if(swap?.to===x.staffId&&swap.at===since&&s.swaps.some(w=>w.id===swap.id&&w.status==='approved'))return true
 return x.callout?.coveredBy===x.staffId&&x.callout.approvedAt===since&&stamp(x.confirmedAt)
}
function received(s:State,x:Row,now:string) {
 const known=s.clocks.filter(k=>k.staffId===x.staffId&&k.start<=now&&(!k.receivedAt||k.receivedAt<=now))
 return known.some(k=>k.shiftId===x.id||!k.shiftId&&Math.abs(Date.parse(k.start)-Date.parse(x.start))<=7200000)||
  s.timesheets.some(t=>t.staffId===x.staffId&&t.status==='approved'&&(!t.approvedAt||t.approvedAt<=now)&&t.start<x.end&&t.end>x.start)
}
function timeSite(s:State,t:Row) {
 const clock=s.clocks.find(k=>k.id===t.clockId),shift=s.shifts.find(x=>x.id===clock?.shiftId)
 return shift?siteOf(s,shift):siteOf(s,t)
}

function shiftSubjects(s:State,now:string,out:NoticeSubject[]) {
 for(const x of s.shifts) {
  if(x.status!=='published'||!active(s,x.staffId)||!stamp(x.start)||!stamp(x.end))continue
  const site=siteOf(s,x),rule=ruleFor(s,site),basis=shiftBasis(s,x),published=assignmentAt(s,x)
  const base={subject:x.id,basis,staffId:x.staffId,site}
  if(x.start>now) {
   if(minutes(rule?.shiftLeadMinutes)) {
    const due=latest(after(x.start,-rule.shiftLeadMinutes),published)!
    if(due<x.start)out.push({...base,kind:'shift',due,expires:x.start,label:'Upcoming shift',employee:true})
   }
   if(minutes(rule?.ackMinutes)&&published&&!confirmed(s,x,published)) {
    const due=after(published,rule.ackMinutes)
    if(due<x.start)out.push({...base,kind:'acknowledgment',due,expires:x.start,label:'Confirm your current shift',employee:true})
   }
  }
  // CLOCK-004 keeps its own enabled rules and closes only on received facts.
  const attendance=s.attendrules.find(r=>r.site===site)
  if(attendance&&minutes(attendance.graceMinutes)&&minutes(attendance.noShowMinutes)&&!received(s,x,now)) {
   out.push({...base,kind:'late',due:after(x.start,attendance.graceMinutes),label:'Missing clock-in: late alert',employee:false})
   out.push({...base,kind:'no-show',due:after(x.start,attendance.noShowMinutes),label:'Missing clock-in: no-show alert',employee:false})
  }
 }
}

function offerSubjects(s:State,now:string,out:NoticeSubject[]) {
 for(const o of s.offers) {
  const x=s.shifts.find(x=>x.id===o.shiftId)
  if(!x||x.status!=='published'||o.status!=='sent'||o.shiftRevision!==x.revision||!active(s,o.staffId))continue
  const site=siteOf(s,x),lead=ruleFor(s,site)?.offerLeadMinutes,expires=o.expiresAt??x.end
  if(!minutes(lead)||!stamp(expires)||expires<=now)continue
  const due=latest(after(expires,-lead),o.opensAt,o.sentAt,o.createdAt)!
  if(due<expires)out.push({kind:'offer-expiry',subject:o.id,basis:canonical([o.id,o.shiftId,o.shiftRevision,o.opensAt,expires]),staffId:o.staffId,site,due,expires,label:'Shift offer expires soon',employee:true})
 }
 for(const o of s.openshifts) {
  const lead=ruleFor(s,o.site)?.offerLeadMinutes
  if(o.status!=='open'||!minutes(lead)||!stamp(o.start)||o.start<=now)continue
  for(const p of s.staff) {
   if(!p.active||p.erased_at||pickupFit(s,p.id,o).block||s.pickups.some(r=>r.openShiftId===o.id&&r.staffId===p.id&&['requested','declined','approved'].includes(r.status)))continue
   const due=latest(after(o.start,-lead),opensFor(o,p.id),o.postedAt)!
   if(due<o.start)out.push({kind:'offer-expiry',subject:o.id,basis:canonical([o.id,o.revision]),staffId:p.id,site:o.site,due,expires:o.start,label:'Open shift offer expires soon',employee:true})
  }
 }
}

function exceptionSubjects(s:State,out:NoticeSubject[]) {
 for(const t of s.timesheets) {
  // TIME-003 approval alone does not resolve a flagged time case.
  if(!['submitted','returned','approved'].includes(t.status)||!t.exceptions?.length||t.resolution||!active(s,t.staffId))continue
  const site=timeSite(s,t),delay=ruleFor(s,site)?.exceptionMinutes
  if(!minutes(delay)||!stamp(t.submittedAt))continue
  out.push({kind:'exception',subject:t.id,basis:canonical([t.id,t.start,t.end,t.breakMinutes,t.exceptions.length]),staffId:t.staffId,site,due:after(t.submittedAt,delay),label:'Time or break exception needs resolution',employee:false})
 }
 for(const k of s.clocks) {
  if(k.status!=='open'||!active(s,k.staffId)||!stamp(k.start))continue
  const shift=s.shifts.find(x=>x.id===k.shiftId),site=shift?siteOf(s,shift):siteOf(s,k)
  const delay=ruleFor(s,site)?.exceptionMinutes,close=s.closerules.find(r=>r.site===site)
  if(!minutes(delay)||!close||!minutes(close.capHours))continue
  const mark=provisional(s,k,after(k.start,close.capHours*60))
  if(!mark)continue
  out.push({kind:'exception',subject:k.id,basis:canonical([k.id,k.start,mark.end,mark.due]),staffId:k.staffId,site,due:after(mark.due,delay),label:'Missed clock-out needs review',employee:false})
 }
}

function periodSubjects(s:State,out:NoticeSubject[]) {
 for(const p of s.periods) {
  if(p.status!=='open'||!/^\d{4}-\d{2}-\d{2}$/.test(p.end))continue
  // TIME-004 dates are inclusive venue dates, not UTC midnights.
  const next=new Date(Date.parse(p.end+'T00:00:00Z')+86400000).toISOString().slice(0,10)
  const end=instantAt(next,'00:00',s.timezone),group=s.paygroups.find(g=>g.id===p.groupId)
  if(p.groupId&&!group)continue
  const times=s.timesheets.filter(t=>t.status!=='superseded'&&periodOf(s,t)?.id===p.id)
  const clocks=s.clocks.filter(k=>k.status==='open'&&periodOf(s,k)?.id===p.id)
  for(const rule of s.noticerules) {
   const rows=times.filter(t=>timeSite(s,t)===rule.site),open=clocks.filter(k=>{
    const x=s.shifts.find(x=>x.id===k.shiftId);return (x?siteOf(s,x):siteOf(s,k))===rule.site
   })
   if(group&&!rows.length&&!open.length&&!group.staffIds.some((id:string)=>s.staff.some(person=>person.id===id&&(person.site??'')===rule.site)))continue
   const people=[...new Set(rows.map(t=>t.staffId))],signoffs=p.signoffs??[]
   const waiting=rows.filter(t=>t.status!=='approved').length,missing=people.filter(id=>!signoffs.some((a:any)=>a.role==='employee'&&a.staffId===id)).length
   const manager=signoffs.some((a:any)=>a.role==='manager')?0:1
   const base={subject:p.id,basis:canonical([p.id,p.start,p.end,p.reopens?.length??0]),site:rule.site,employee:false}
   const counts=`${p.start}–${p.end}: ${waiting} timesheets awaiting approval, ${open.length} open punches, ${missing} employee signoffs, ${manager} manager signoffs needed`
   if(minutes(rule.reviewMinutes)&&(waiting||open.length||missing||manager))out.push({...base,kind:'timesheet-review',due:latest(after(end,rule.reviewMinutes),p.definedAt)!,label:`Timesheet review ${counts}`})
   if(minutes(rule.payrollLeadMinutes))out.push({...base,kind:'payroll-review',due:latest(after(end,-rule.payrollLeadMinutes),p.definedAt)!,label:`Payroll review ${counts}`})
  }
 }
}

/** Includes future due times so a tick can durably schedule them before they fall due. */
export function noticeSubjects(s:State,now:string):NoticeSubject[] {
 const out:NoticeSubject[]=[]
 shiftSubjects(s,now,out);offerSubjects(s,now,out);exceptionSubjects(s,out);periodSubjects(s,out)
 return out.filter(x=>stamp(x.due)&&(!x.expires||x.expires>now)).sort((a,b)=>a.due.localeCompare(b.due)||a.kind.localeCompare(b.kind)||a.subject.localeCompare(b.subject)||(a.staffId??'').localeCompare(b.staffId??''))
}
