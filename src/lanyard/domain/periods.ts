// TIME-004: pay periods. The owner (payroll administrator until TEAM-001 brings payroll roles)
// defines inclusive venue-date periods; each employee with time in one and a manager sign off;
// the owner locks it, freezing its time; only the owner reopens it, with a reason, which clears
// the signoffs; a locked period whose time is all exported closes with the provider reference.
// After close, corrections and late time are linked adjustments; the locked record never changes.
import {type Context,type Row,type State,keys,text,need,get,exact,put,canonical} from './model'
import {localDate} from './settings'

import {groupOn} from './payschedules'

const DAY=/^\d{4}-\d{2}-\d{2}$/
/** The defined period holding a timesheet: its start's venue date within the period's inclusive dates. */
export function periodOf(s:State,t:Row) {
 const d=localDate(t.start,s.timezone);const g=groupOn(s,t.staffId,d);return s.periods.find(p=>(g?p.groupId===g.id:!p.groupId)&&p.start<=d&&d<=p.end)
}
export const inPeriod=(s:State,p:Row)=>s.timesheets.filter(t=>t.status!=='superseded'&&periodOf(s,t)?.id===p.id)
export const signoffSources=(s:State,p:Row,staffId?:string)=>canonical(inPeriod(s,p).filter(t=>!staffId||t.staffId===staffId).map(t=>[t.id,t.revision]).sort(([a],[b])=>String(a).localeCompare(String(b))))
export const signoffCurrent=(s:State,p:Row,signoff:any)=>signoff.sources===signoffSources(s,p,signoff.role==='employee'?signoff.staffId:undefined)
const owner=(c:Context)=>need(c.a.role==='owner','Only the payroll administrator (the owner) can do this',403)
const claimed=(s:State,t:Row)=>s.claims.some(cl=>cl.time_id===t.id&&cl.time_revision===t.revision)
/**
 * Every write to time rechecks its period inside the same state version: in a locked period
 * nothing changes and nothing is added; in a closed one the locked rows keep their facts (a row
 * may only be marked superseded by an approved adjustment) and new time is a linked adjustment.
 */
export function guardPeriods(c:Context,before:State) {
 // Captures and break/job changes are time writes too, even before a timesheet exists.
 const clocks=new Map(before.clocks.map(k=>[k.id,k]))
 for(const k of c.s.clocks) {
  const was=clocks.get(k.id);if(was&&JSON.stringify(was)===JSON.stringify(k))continue
  for(const row of was?[was,k]:[k])need(periodOf(c.s,row)?.status!=='locked','This pay period is locked; the owner reopens it with a reason before time changes',409)
 }
 const old=new Map(before.timesheets.map(t=>[t.id,t]))
 for(const t of c.s.timesheets) {
  const was=old.get(t.id);if(was&&JSON.stringify(was)===JSON.stringify(t))continue
  const p=periodOf(c.s,was??t);if(!p||p.status==='open')continue
  need(p.status==='closed','This pay period is locked; the owner reopens it with a reason before time changes',409)
  if(was&&p.locked.some((x:any)=>x.id===t.id)){const {status,supersededBy,revision,...rest}=t,{status:s0,supersededBy:b0,revision:r0,...prior}=was
   need(status==='superseded'&&s0==='approved'&&JSON.stringify(rest)===JSON.stringify(prior),'This pay period is closed; correct its time with an adjustment',409);continue}
  // A new row keeps its revision (the command's answer names it); it is marked as the closed period's adjustment.
  if(!was)t.adjustment={periodId:p.id,of:t.corrects??null}
 }
}
/** Time in an open defined period is held from payroll until the period is locked. */
export const heldByPeriod=(s:State,t:Row)=>{const p=periodOf(s,t);return p?.status==='open'||(!p&&!!groupOn(s,t.staffId,localDate(t.start,s.timezone)))}
export function periods(c:Context,name:string,p:Record<string,any>) {
 if(name==='period.save') {
  owner(c);keys(p,['start','end'])
  need(typeof p.start==='string'&&DAY.test(p.start)&&typeof p.end==='string'&&DAY.test(p.end)&&p.start<=p.end,'Choose a start and end date (YYYY-MM-DD)')
  need((Date.parse(p.end)-Date.parse(p.start))/86400000<=30,'A pay period is at most 31 days')
  need(!c.s.paygroups.some(g=>g.from<=p.end),'Use the pay group schedule to open this period',409)
  need(!c.s.periods.some(x=>x.start<=p.end&&p.start<=x.end),'Pay periods cannot overlap',409)
  return put(c,'periods',{start:p.start,end:p.end,status:'open',signoffs:[],reopens:[],locked:[],definedBy:c.a.id,definedAt:c.now})
 }
 if(!['period.signoff','period.lock','period.reopen','period.close'].includes(name))return undefined
 keys(p,['id','revision','reason','reference']);const r=get(c.s,'periods',p.id);exact(r,p)
 if(name==='period.signoff') {
  need(r.status==='open','Sign off an open pay period',409);need(c.a.role!=='agent','Staff or manager required',403)
  const role=c.a.role==='staff'?'employee':'manager'
  if(role==='employee')need(inPeriod(c.s,r).some(t=>t.staffId===c.a.staffId),'You have no time in this pay period',409)
  need(!r.signoffs.some((x:any)=>x.by===c.a.id&&x.role===role&&signoffCurrent(c.s,r,x)),'Already signed off',409)
  return put(c,'periods',{...r,signoffs:[...r.signoffs.filter((x:any)=>x.by!==c.a.id||x.role!==role),{by:c.a.id,staffId:c.a.staffId??null,role,at:c.now,sources:signoffSources(c.s,r,role==='employee'?c.a.staffId:undefined)}]},r)
 }
 if(name==='period.lock') {
  owner(c);need(r.status==='open','Only an open pay period can be locked',409)
  const rows=inPeriod(c.s,r);need(rows.every(t=>t.status==='approved'),'Approve or decide every timesheet in this pay period first',409)
  need(!c.s.clocks.some(k=>k.status==='open'&&periodOf(c.s,k)?.id===r.id),'A punch in this pay period is still open',409)
  need(r.signoffs.some((x:any)=>x.role==='manager'&&signoffCurrent(c.s,r,x)),'A manager must sign off first',409)
  const missing=[...new Set(rows.map(t=>t.staffId))].filter(id=>!r.signoffs.some((x:any)=>x.role==='employee'&&x.staffId===id&&signoffCurrent(c.s,r,x)))
  need(!missing.length,`${missing.length} employee${missing.length===1?' has':'s have'} not signed off`,409)
  return put(c,'periods',{...r,status:'locked',locked:rows.map(t=>({id:t.id,revision:t.revision,staffId:t.staffId,minutes:t.minutes})),lockedBy:c.a.id,lockedAt:c.now},r)
 }
 if(name==='period.reopen') {
  owner(c);need(r.status==='locked','Only a locked pay period can be reopened; a closed one takes adjustments',409)
  return put(c,'periods',{...r,status:'open',signoffs:[],locked:[],reopens:[...r.reopens,{by:c.a.id,at:c.now,reason:text(p.reason,'reason',500),signoffs:r.signoffs,locked:r.locked}]},r)
 }
 owner(c);need(r.status==='locked','Lock the pay period before closing it',409)
 need(r.locked.every((x:any)=>claimed(c.s,{id:x.id,revision:x.revision} as Row)),'Export every locked timesheet before closing',409)
 // The reference is the owner's record of the provider run; Lanyard does not verify it with the provider (SYNC-001).
 return put(c,'periods',{...r,status:'closed',reference:text(p.reference,'provider reference',120),closedBy:c.a.id,closedAt:c.now},r)
}
