import {minorClock,minorTime} from './minors'
import {differentialBasis,differentialRules} from './differentials'
// Gauge time's submitted -> approved revision flow, adapted to hours only;
// Glove field capture preserves device time and command identity on retries.
import {holidayBasis} from './holidays'
import {localDate} from './settings'
import {rateBasis} from './workforce'
import {segmentPlan,reconcileSegments,segmentBasis} from './worksegments'
import {transferPlan,currentOf} from './transfers'
import {checkClockIn} from './clockrules'
import {mealAtClockOut} from './mealrules'
import {roundAtCapture,roundAtApproval} from './rounding'
import {provisional} from './closerules'
import {checkNetwork,siteByNetwork} from './clocknets'
import {siteOf} from './team'
import {answer,attach} from './questions'
import {checkBreaks,breakOutcome,mealMinutes,timedFor,WAIVER,ATTEST_BREAKS} from './breaks'
import {type Context,type Row,keys,text,need,self,staff,instant,integer,work,prepare,manager,get,exact,put,overlap} from './model'
function clearOverlap(c:Context,staffId:string,w:Record<string,any>,rootId?:string) {
 need(!c.s.timesheets.some(t=>t.staffId===staffId&&t.status!=='superseded'&&t.rootId!==rootId&&overlap(t,w)),'Time overlaps another submitted or approved entry',409)
}
/** One exact-revision approval; every check runs before anything is written. TIME-008 approves each bulk item through it. */
export function approve(c:Context,submitted:Row) {
 // TIME-005: a rule that rounds at approval sets the payable time before anything is decided.
 const r=roundAtApproval(c.s,submitted)
 need(r.status==='submitted','Only submitted time can be approved',409);need(r.staffId!==c.a.staffId,'You cannot approve your own time',403);staff(c,r.staffId);clearOverlap(c,r.staffId,r,r.rootId)
 const old=r.corrects?get(c.s,'timesheets',r.corrects):undefined
 if(old)need(old.status==='approved','Correction source changed',409)
 need(!c.s.holidaypay.some(p=>p.staffId===r.staffId&&p.minutes>0&&p.date>=localDate(r.start,c.s.timezone)&&p.date<=localDate(new Date(Date.parse(r.end)-1).toISOString(),c.s.timezone)),'Correct non-work holiday pay to zero before approving worked holiday time',409)
 const exported=c.s.claims.filter(cl=>cl.root_id===r.rootId).reduce((n,cl)=>n+cl.minutes,0)
 const clock=c.s.clocks.find(k=>k.id===r.clockId),shift=c.s.shifts.find(x=>x.id===clock?.shiftId),job=r.job??shift?.job??'',site=r.site??shift?.site??''
 const plan=r.segmentPlan??segmentPlan(c.s,r.staffId,r,clock?.shiftId),workSegments=reconcileSegments(c.s,r.staffId,r,plan)
 // A correction reprices changed minutes from its approved source, not today's wages.
 const retained=(basis:any,job:string,area?:string)=>{const source=old?.workSegments?.find((w:any)=>w.job===job&&w.area===area)?.rateBasis??old?.rateBasis;if(!source)return basis;const segments=basis.segments.map((p:any)=>{const original=source.segments.find((q:any)=>q.date===p.date)??source.segments.at(-1);return {...p,...original,minutes:p.minutes,date:p.date}});return {...basis,segments,costCents:segments.some((p:any)=>p.cents===null)?null:segments.reduce((n:number,p:any)=>n+Math.round(p.minutes*p.cents/60),0)}}
 for(const w of workSegments)w.rateBasis=retained(w.rateBasis,w.job,w.area)
 const rated:Row={...r,job,site,segmentPlan:plan,workSegments,rateBasis:workSegments.length?segmentBasis(r.staffId,workSegments):retained(rateBasis(c.s,r.staffId,{...r,job,site}),job)}
 rated.differentialContext=old?.differentialContext??{role:c.s.staff.find(x=>x.id===r.staffId)?.position??'',tag:(c.s.shifts.find(x=>x.id===rated.segmentPlan?.shiftId)??c.s.shifts.find(x=>x.staffId===r.staffId&&x.status==='published'&&x.start<r.end&&x.end>r.start))?.label??''}
 const rules=differentialRules(c.s,rated)
 const minorFlags=minorTime(c.s,rated)
 const approved={...rated,exceptions:[...new Set([...(rated.exceptions??[]).filter((x:string)=>!x.startsWith('Minor work rule ')),...minorFlags])],differentialRules:rules,differentialBasis:differentialBasis(c.s,rated,rules),holidayBasis:holidayBasis(c.s,rated),status:'approved',exportMinutes:r.minutes-exported,approvedBy:c.a.id,approvedAt:c.now}
 // A bulk caller may catch a refusal: finish every check and calculation before changing either revision.
 if(old)put(c,'timesheets',{...old,status:'superseded',supersededBy:r.id},old)
 return put(c,'timesheets',approved,r)
}
const ATTEST='I confirm these times and breaks are accurate.'
/** TIME-003: the employee's own attestation of times and breaks, recorded with its wording; only the person attests their own time. */
function attestation(c:Context,staffId:string,attest:unknown,required=false) {
 if(attest!==true&&attest!=='on'&&attest!=='true'){need(!required,'Attest that the times and breaks are accurate');return {}}
 need(c.a.staffId===staffId,'Only the employee attests their own time',403);return {attestation:{text:ATTEST,by:c.a.id,at:c.now}}
}
/** A punch's cafe: its matched shift's, else the person's home cafe (as TIME-006). */
function cafeOf(c:Context,staffId:string,shiftId:string|null) {
 const shift=shiftId?c.s.shifts.find(x=>x.id===shiftId):undefined
 return shift?siteOf(c.s,shift):c.s.staff.find(p=>p.id===staffId)?.site??''
}
/** BREAK-001: the employee's own waiver and break attestation at clock-out; a manager cannot give either for them. */
function breakWords(c:Context,staffId:string,p:Record<string,any>) {
 const waive=p.waiveMeal===true||p.waiveMeal==='true'||p.waiveMeal==='on',note=text(p.breakNote,'break note',500,true)
 if(waive||note)need(c.a.staffId===staffId,'Only the employee attests their own breaks',403)
 return {waive,note}
}
/** Ends an open clock at `at` and submits its timesheet (BREAK-001 timed breaks, BREAK-002 meal answer, TIME-005 rounding, flags kept). */
function closeClock(c:Context,open:Row,at:string,breakMinutes:number,meal:unknown,reason:string,extra:Record<string,any>={},words={waive:false,note:''}) {
 // BREAK-001: timed breaks inside the punch; only finished timed meals are unpaid, and they replace typed meal minutes.
 const timed=(open.breaks??[]).filter((b:any)=>b.start<at).map((b:any)=>({...b,end:!b.end||b.end>at?at:b.end})),timedMeal=mealMinutes(timed,at)
 if(timedMeal)need(breakMinutes===0,'Your meal breaks were timed; leave meal minutes at 0')
 // BREAK-002: a cafe's automatic meal deduction, confirmed, reported missed or left unconfirmed by the employee.
 const m=mealAtClockOut(c.s,open,at,timedMeal||breakMinutes,meal,c.now),flags=[...(open.exceptions??[]),...m.exceptions,...(extra.provisional?['provisional close']:[])]
 const w=work({start:open.start,end:at,breakMinutes:m.breakMinutes});clearOverlap(c,open.staffId,w)
 flags.push(...minorTime(c.s,{...open,...w},open.shiftId))
 const check=checkBreaks(c.s,open.staffId,open.shiftId,w,timed,words.waive),out=breakOutcome(check,{exceptions:flags}),all:string[]=out.exceptions??flags
 const facts={...(timed.length?{breaks:timed}:{}),...(check?.waiver?{breakWaiver:{text:WAIVER,by:c.a.id,at:c.now}}:{}),...(words.note?{breakAttestation:{text:ATTEST_BREAKS,note:words.note,by:c.a.id,at:c.now}}:{}),...(out.premiums?.length?{premiums:out.premiums}:{})}
 const entry=put(c,'timesheets',{staffId:open.staffId,site:cafeOf(c,open.staffId,open.shiftId),...w,...roundAtCapture(c.s,open,at,w.breakMinutes,w.minutes),segmentPlan:transferPlan(c.s,open,at)??segmentPlan(c.s,open.staffId,w,open.shiftId),status:'submitted',reason,corrects:null,rootId:'',submittedBy:c.a.id,submittedAt:c.now,clockId:open.id,...(all.length?{exceptions:all}:{}),...(m.deduction?{mealDeduction:m.deduction}:{}),...(open.network?{network:open.network}:{}),...facts,...extra});entry.rootId=entry.id
 const clock=put(c,'clocks',{...open,end:at,status:'closed',timesheetId:entry.id,closedReceivedAt:c.now,...extra},open);c.entity=entry.id
 return {clock,timesheet:entry}
}
/** BREAK-001: changed time re-checked with its timed breaks while its meal minutes still match them. */
function recheck(c:Context,r:Row,w:{start:string;end:string;breakMinutes:number}) {
 const shiftId=r.clockId?c.s.clocks.find(k=>k.id===r.clockId)?.shiftId:null
 return breakOutcome(checkBreaks(c.s,r.staffId,shiftId,w,timedFor(r,w.breakMinutes),Boolean(r.breakWaiver)),{...r,exceptions:[...(r.exceptions??[]).filter((x:string)=>!x.startsWith('Minor work rule ')),...minorTime(c.s,{...r,...w,edited:true})]})
}
export function time(c:Context,name:string,p:Record<string,any>) {
 if(name==='clock.in'||name==='clock.out') {
  keys(p,name==='clock.in'?['commandId','capturedAt','answers']:['commandId','capturedAt','breakMinutes','meal','waiveMeal','breakNote','answers']);const staffId=self(c.a),at=instant(p.capturedAt,'capturedAt');need(Date.parse(at)<=Date.parse(c.now)+60000,'Clock capture cannot be in the future')
  const open=c.s.clocks.find(r=>r.staffId===staffId&&r.status==='open')
  if(name==='clock.in') {
   need(!open,'You already have an open clock',409)
   need(!c.s.clocks.some(r=>r.staffId===staffId&&r.end&&r.end>at),'Clock capture predates an existing clock; ask a manager to prepare missed time',409)
   // TIME-006: refused before any write, or accepted with its flags kept for the timesheet.
   const check=checkClockIn(c.s,staffId,at),net=checkNetwork(c.s,cafeOf(c,staffId,check.shiftId),c.net)
   const minorWarnings=minorClock(c.s,staffId,at,check.shiftId);need(!minorWarnings.length,minorWarnings.join('; '),409)
   // CLOCK-006: the clock-in questions, answered before anything is written; their flags join the punch's.
   const asked=answer(c,staffId,check.shiftId,'in',p.answers),flags=[...check.exceptions,...net.exceptions,...asked.flags]
   const clock=put(c,'clocks',{staffId,start:at,end:null,status:'open',capturedBy:c.a.id,receivedAt:c.now,shiftId:check.shiftId,...(flags.length?{exceptions:flags}:{}),...(net.network?{network:{in:net.network}}:{}),...(asked.answers.length?{answers:asked.answers}:{}),...(siteByNetwork(c.s,c.net)!==null?{seenAt:siteByNetwork(c.s,c.net)}:{})})
   attach(c,asked.injuries,clock.id);c.entity=clock.id;return clock
  }
  need(open,'No open clock to stop',409);need(!open.breaks?.some((b:any)=>!b.end),'End your break before clocking out',409)
  // TIME-007: a clock-out captured after the provisional close cannot end the punch; its end is confirmed or corrected instead.
  need(!provisional(c.s,open,at),'Your clock was provisionally closed; confirm or correct your end time',409)
  need((open.transfers??[]).every((t:any)=>at>t.at),'Clock-out follows your last job change',409)
  // CLOCK-007: the clock-out is checked against the networks of the cafe being worked (after any CLOCK-008 change); its flag joins the timesheet's.
  const net=checkNetwork(c.s,currentOf(c.s,open).site,c.net),network=net.network?{...open.network,out:net.network}:open.network
  // CLOCK-006: clock-out answers join the clock-in ones on the punch and its timesheet; their flags become exceptions.
  const asked=answer(c,staffId,open.shiftId,'out',p.answers),answers=[...(open.answers??[]),...asked.answers],flags=[...net.exceptions,...asked.flags].filter(e=>!open.exceptions?.includes(e))
  const done=closeClock(c,{...open,exceptions:[...(open.exceptions??[]),...flags],...(network?{network}:{})},at,integer(p.breakMinutes,'breakMinutes',0,1440),p.meal,'Phone clock',answers.length?{answers}:{},breakWords(c,staffId,p))
  attach(c,asked.injuries,open.id);c.entity=done.timesheet.id;return done
 }
 if(name==='time.confirm') {
  // TIME-007: the person or a manager confirms or corrects a provisionally closed punch; the result is submitted time flagged "provisional close".
  keys(p,['id','revision','end','breakMinutes','meal','reason','attest','waiveMeal','breakNote']);need(c.a.role!=='agent','Staff or manager required',403);const open=get(c.s,'clocks',p.id);exact(open,p)
  if(c.a.role!=='owner'&&c.a.role!=='manager')need(open.staffId===self(c.a),'Only your own clock',403)
  const mark=provisional(c.s,open,c.now);need(mark,'This clock is not provisionally closed',409)
  const end=instant(p.end,'end');need(end<=c.now,'Time cannot end in the future')
  const reason=text(p.reason,'reason',500,true)||(end===mark.end?'Confirmed after provisional close':'Corrected after provisional close')
  return closeClock(c,open,end,integer(p.breakMinutes,'breakMinutes',0,1440),p.meal,reason,{provisional:{end:mark.end,due:mark.due,confirmedBy:c.a.id},...attestation(c,open.staffId,p.attest)},breakWords(c,open.staffId,p))
 }
 if(name==='time.prepare') {
  prepare(c.a);keys(p,['staffId','start','end','breakMinutes','reason','corrects','job','site']);const staffId=staff(c,p.staffId).id,w=work(p);need(w.end<=c.now,'Time cannot end in the future');const reason=text(p.reason,'reason',500)
  const old=p.corrects?get(c.s,'timesheets',p.corrects):undefined
  if(old){need(old.staffId===staffId,'Correction must keep the same staff');need(old.status==='approved','Correct the latest approved time',409);need(!c.s.timesheets.some(t=>t.corrects===old.id),'A correction already exists for this revision',409)}
  clearOverlap(c,staffId,w,old?.rootId)
  // BREAK-001: entered time is checked by its meal minutes; rest breaks are unknown without timed breaks.
  const site=p.site===undefined?old?.site??'':text(p.site,'site',80,true),plan=old?.segmentPlan??segmentPlan(c.s,staffId,w)
  const r=put(c,'timesheets',{job:p.job===undefined?old?.job??'':text(p.job,'job',80,true),site,staffId,...w,segmentPlan:plan,reason,corrects:old?.id??null,rootId:old?.rootId??'',status:'submitted',submittedBy:c.a.id,submittedAt:c.now,...breakOutcome(checkBreaks(c.s,staffId,null,w),{exceptions:minorTime(c.s,{staffId,...w,site,segmentPlan:plan,corrects:old?.id,rootId:old?.rootId})})});if(!old)r.rootId=r.id
  return {...r,approvalRequired:'time.approve',approval:{id:r.id,revision:r.revision}}
 }
 if(name==='time.edit') {
  // TIME-009: a manager edits waiting time with a reason; the captured facts stay beside it and the revision changes.
  manager(c.a);keys(p,['id','revision','start','end','breakMinutes','reason']);const r=get(c.s,'timesheets',p.id);exact(r,p);need(r.status==='submitted','Only waiting time can be edited',409);need(r.staffId!==c.a.staffId,'You cannot edit your own time',403)
  const w=work({start:p.start,end:p.end,breakMinutes:typeof p.breakMinutes==='string'?Number(p.breakMinutes):p.breakMinutes});need(w.end<=c.now,'Time cannot end in the future');clearOverlap(c,r.staffId,w,r.rootId)
  const captured=r.captured??{start:r.start,end:r.end,breakMinutes:r.breakMinutes,minutes:r.rounding?.capturedMinutes??r.minutes}
  // Edited time is never rounded (TIME-005): its payable time is the edited time, and no rule rounds it at approval.
  // BREAK-001: the edit is re-checked against the break policy; a newly missing or short break adds its exception, premiums follow the edited facts.
  const edited={by:c.a.id,at:c.now,reason:text(p.reason,'reason',500)}
  const facts=(v:Row|typeof w)=>({start:v.start,end:v.end,minutes:'minutes' in v?v.minutes:Math.floor((Date.parse(v.end)-Date.parse(v.start))/60000)-v.breakMinutes,breakMinutes:v.breakMinutes})
  const editHistory=[...(r.editHistory??[]),{revision:r.revision+1,priorRevision:r.revision,...edited,before:facts(r),after:facts(w)}]
  const editHistoryComplete=r.editHistoryComplete??!r.edited
  const {payable,rounding,...rest}=r;return put(c,'timesheets',{...rest,...w,captured,edited,editHistory,editHistoryComplete,...recheck(c,r,w)},r)
 }
 if(name==='time.request') {
  // TIME-003: an employee requests a missing punch or a correction of their own approved time, attesting to it; a manager approves it.
  keys(p,['start','end','breakMinutes','reason','corrects','attest']);const staffId=self(c.a)!,w=work({...p,breakMinutes:typeof p.breakMinutes==='string'?Number(p.breakMinutes):p.breakMinutes});need(w.end<=c.now,'Time cannot end in the future')
  const old=p.corrects?get(c.s,'timesheets',p.corrects):undefined
  if(old){need(old.staffId===staffId,'Only your own time',403);need(old.status==='approved','Correct the latest approved time',409);need(!c.s.timesheets.some(t=>t.corrects===old.id),'A correction already exists for this revision',409)}
  clearOverlap(c,staffId,w,old?.rootId)
  const site=old?.site??'',plan=old?.segmentPlan??segmentPlan(c.s,staffId,w)
  const r=put(c,'timesheets',{staffId,site,...w,segmentPlan:plan,reason:text(p.reason,'reason',500),corrects:old?.id??null,rootId:old?.rootId??'',status:'submitted',submittedBy:c.a.id,submittedAt:c.now,requested:true,...breakOutcome(checkBreaks(c.s,staffId,null,w),{exceptions:[old?'employee correction':'missed punch',...minorTime(c.s,{staffId,...w,site,segmentPlan:plan,corrects:old?.id,rootId:old?.rootId})]}),...attestation(c,staffId,p.attest,true)});if(!old)r.rootId=r.id
  return r
 }
 if(name==='time.acknowledge') {
  // TIME-003: the employee confirms time a manager or agent entered for them; it leaves TIME-008's unconfirmed state.
  keys(p,['id','revision']);const r=get(c.s,'timesheets',p.id);exact(r,p);need(r.staffId===self(c.a),'Only your own time',403);need(!r.clockId&&!r.requested&&!r.employeeConfirmed,'This time is already yours or confirmed',409);need(r.status==='submitted'||r.status==='approved','Only waiting or approved time',409)
  return put(c,'timesheets',{...r,employeeConfirmed:{at:c.now}},r)
 }
 if(name==='time.resolve') {
  // TIME-003: an exception stays open, assigned to its cafe's managers, until a manager resolves it with a reason.
  manager(c.a);keys(p,['id','revision','reason']);const r=get(c.s,'timesheets',p.id);exact(r,p);need(r.exceptions?.length&&!r.resolution,'No open exception on this time',409);need(r.staffId!==c.a.staffId,'You cannot resolve your own exception',403)
  return put(c,'timesheets',{...r,resolution:{by:c.a.id,at:c.now,reason:text(p.reason,'reason',500)}},r)
 }
 if(name==='time.return') {
  // TIME-009: send waiting time back to the employee with a reason; it waits for them, not for approval.
  manager(c.a);keys(p,['id','revision','reason']);const r=get(c.s,'timesheets',p.id);exact(r,p);need(r.status==='submitted','Only waiting time can be sent back',409);need(r.staffId!==c.a.staffId,'You cannot send back your own time',403)
  return put(c,'timesheets',{...r,status:'returned',returned:{by:c.a.id,at:c.now,reason:text(p.reason,'reason',500)}},r)
 }
 if(name==='time.resubmit') {
  // The employee answers a send-back: the same times, or corrected ones with a note; the captured facts stay.
  keys(p,['id','revision','start','end','breakMinutes','note']);const r=get(c.s,'timesheets',p.id);exact(r,p);need(r.staffId===self(c.a),'Only your own time',403);need(r.status==='returned','This time was not sent back to you',409)
  const w=p.start===undefined?{start:r.start,end:r.end,breakMinutes:r.breakMinutes,minutes:r.minutes}:work({start:p.start,end:p.end,breakMinutes:typeof p.breakMinutes==='string'?Number(p.breakMinutes):p.breakMinutes});need(w.end<=c.now,'Time cannot end in the future');clearOverlap(c,r.staffId,w,r.rootId)
  const captured=r.captured??{start:r.start,end:r.end,breakMinutes:r.breakMinutes,minutes:r.rounding?.capturedMinutes??r.minutes},changed=w.start!==r.start||w.end!==r.end||w.breakMinutes!==r.breakMinutes
  const {payable,rounding,...rest}=r;return put(c,'timesheets',{...(changed?rest:r),...w,...(changed?{captured,...recheck(c,r,w)}:{}),status:'submitted',resubmitted:{at:c.now,note:text(p.note,'note',500,true)}},r)
 }
 if(name==='time.approve') {
  manager(c.a);keys(p,['id','revision']);const r=get(c.s,'timesheets',p.id);exact(r,p);return approve(c,r)
 }
 return undefined
}
