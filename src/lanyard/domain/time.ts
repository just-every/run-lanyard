// Gauge time's submitted -> approved revision flow, adapted to hours only;
// Glove field capture preserves device time and command identity on retries.
import {checkClockIn} from './clockrules'
import {mealAtClockOut} from './mealrules'
import {roundAtCapture,roundAtApproval} from './rounding'
import {provisional} from './closerules'
import {checkNetwork} from './clocknets'
import {siteOf} from './team'
import {type Context,type Row,keys,text,need,self,staff,instant,integer,work,prepare,manager,get,exact,put,overlap} from './model'
function clearOverlap(c:Context,staffId:string,w:Record<string,any>,rootId?:string) {
 need(!c.s.timesheets.some(t=>t.staffId===staffId&&t.status!=='superseded'&&t.rootId!==rootId&&overlap(t,w)),'Time overlaps another submitted or approved entry',409)
}
/** One exact-revision approval; every check runs before anything is written. TIME-008 approves each bulk item through it. */
export function approve(c:Context,submitted:Row) {
 // TIME-005: a rule that rounds at approval sets the payable time before anything is decided.
 const r=roundAtApproval(c.s,submitted)
 need(r.status==='submitted','Only submitted time can be approved',409);need(r.staffId!==c.a.staffId,'You cannot approve your own time',403);staff(c,r.staffId);clearOverlap(c,r.staffId,r,r.rootId)
 if(r.corrects){const old=get(c.s,'timesheets',r.corrects);need(old.status==='approved','Correction source changed',409);put(c,'timesheets',{...old,status:'superseded',supersededBy:r.id},old)}
 const exported=c.s.claims.filter(cl=>cl.root_id===r.rootId).reduce((n,cl)=>n+cl.minutes,0)
 return put(c,'timesheets',{...r,status:'approved',exportMinutes:r.minutes-exported,approvedBy:c.a.id,approvedAt:c.now},r)
}
/** A punch's cafe: its matched shift's, else the person's home cafe (as TIME-006). */
function cafeOf(c:Context,staffId:string,shiftId:string|null) {
 const shift=shiftId?c.s.shifts.find(x=>x.id===shiftId):undefined
 return shift?siteOf(c.s,shift):c.s.staff.find(p=>p.id===staffId)?.site??''
}
/** Ends an open clock at `at` and submits its timesheet (BREAK-002 meal answer, TIME-005 rounding, flags kept). */
function closeClock(c:Context,open:Row,at:string,breakMinutes:number,meal:unknown,reason:string,extra:Record<string,any>={}) {
 // BREAK-002: a cafe's automatic meal deduction, confirmed, reported missed or left unconfirmed by the employee.
 const m=mealAtClockOut(c.s,open,at,breakMinutes,meal,c.now),flags=[...(open.exceptions??[]),...m.exceptions,...(extra.provisional?['provisional close']:[])]
 const w=work({start:open.start,end:at,breakMinutes:m.breakMinutes});clearOverlap(c,open.staffId,w)
 const entry=put(c,'timesheets',{staffId:open.staffId,...w,...roundAtCapture(c.s,open,at,w.breakMinutes,w.minutes),status:'submitted',reason,corrects:null,rootId:'',submittedBy:c.a.id,submittedAt:c.now,clockId:open.id,...(flags.length?{exceptions:flags}:{}),...(m.deduction?{mealDeduction:m.deduction}:{}),...(open.network?{network:open.network}:{}),...extra});entry.rootId=entry.id
 const clock=put(c,'clocks',{...open,end:at,status:'closed',timesheetId:entry.id,closedReceivedAt:c.now,...extra},open);c.entity=entry.id
 return {clock,timesheet:entry}
}
export function time(c:Context,name:string,p:Record<string,any>) {
 if(name==='clock.in'||name==='clock.out') {
  keys(p,name==='clock.in'?['commandId','capturedAt']:['commandId','capturedAt','breakMinutes','meal']);const staffId=self(c.a),at=instant(p.capturedAt,'capturedAt');need(Date.parse(at)<=Date.parse(c.now)+60000,'Clock capture cannot be in the future')
  const open=c.s.clocks.find(r=>r.staffId===staffId&&r.status==='open')
  if(name==='clock.in') {
   need(!open,'You already have an open clock',409)
   need(!c.s.clocks.some(r=>r.staffId===staffId&&r.end&&r.end>at),'Clock capture predates an existing clock; ask a manager to prepare missed time',409)
   // TIME-006: refused before any write, or accepted with its flags kept for the timesheet.
   const check=checkClockIn(c.s,staffId,at),net=checkNetwork(c.s,cafeOf(c,staffId,check.shiftId),c.net),flags=[...check.exceptions,...net.exceptions]
   return put(c,'clocks',{staffId,start:at,end:null,status:'open',capturedBy:c.a.id,receivedAt:c.now,shiftId:check.shiftId,...(flags.length?{exceptions:flags}:{}),...(net.network?{network:{in:net.network}}:{})})
  }
  need(open,'No open clock to stop',409)
  // TIME-007: a clock-out captured after the provisional close cannot end the punch; its end is confirmed or corrected instead.
  need(!provisional(c.s,open,at),'Your clock was provisionally closed; confirm or correct your end time',409)
  // CLOCK-007: the clock-out is checked against the same cafe's networks; its flag joins the timesheet's.
  const net=checkNetwork(c.s,cafeOf(c,staffId,open.shiftId),c.net),network=net.network?{...open.network,out:net.network}:open.network
  return closeClock(c,{...open,exceptions:[...(open.exceptions??[]),...net.exceptions.filter(e=>!open.exceptions?.includes(e))],...(network?{network}:{})},at,integer(p.breakMinutes,'breakMinutes',0,1440),p.meal,'Phone clock')
 }
 if(name==='time.confirm') {
  // TIME-007: the person or a manager confirms or corrects a provisionally closed punch; the result is submitted time flagged "provisional close".
  keys(p,['id','revision','end','breakMinutes','meal','reason']);need(c.a.role!=='agent','Staff or manager required',403);const open=get(c.s,'clocks',p.id);exact(open,p)
  if(c.a.role!=='owner'&&c.a.role!=='manager')need(open.staffId===self(c.a),'Only your own clock',403)
  const mark=provisional(c.s,open,c.now);need(mark,'This clock is not provisionally closed',409)
  const end=instant(p.end,'end');need(end<=c.now,'Time cannot end in the future')
  const reason=text(p.reason,'reason',500,true)||(end===mark.end?'Confirmed after provisional close':'Corrected after provisional close')
  return closeClock(c,open,end,integer(p.breakMinutes,'breakMinutes',0,1440),p.meal,reason,{provisional:{end:mark.end,due:mark.due,confirmedBy:c.a.id}})
 }
 if(name==='time.prepare') {
  prepare(c.a);keys(p,['staffId','start','end','breakMinutes','reason','corrects']);const staffId=staff(c,p.staffId).id,w=work(p);need(w.end<=c.now,'Time cannot end in the future');const reason=text(p.reason,'reason',500)
  const old=p.corrects?get(c.s,'timesheets',p.corrects):undefined
  if(old){need(old.staffId===staffId,'Correction must keep the same staff');need(old.status==='approved','Correct the latest approved time',409);need(!c.s.timesheets.some(t=>t.corrects===old.id),'A correction already exists for this revision',409)}
  clearOverlap(c,staffId,w,old?.rootId)
  const r=put(c,'timesheets',{staffId,...w,reason,corrects:old?.id??null,rootId:old?.rootId??'',status:'submitted',submittedBy:c.a.id,submittedAt:c.now});if(!old)r.rootId=r.id
  return {...r,approvalRequired:'time.approve',approval:{id:r.id,revision:r.revision}}
 }
 if(name==='time.approve') {
  manager(c.a);keys(p,['id','revision']);const r=get(c.s,'timesheets',p.id);exact(r,p);return approve(c,r)
 }
 return undefined
}
