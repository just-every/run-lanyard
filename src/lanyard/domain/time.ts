// Gauge time's submitted -> approved revision flow, adapted to hours only;
// Glove field capture preserves device time and command identity on retries.
import {checkClockIn} from './clockrules'
import {type Context,type Row,keys,text,need,self,staff,instant,integer,work,prepare,manager,get,exact,put,overlap} from './model'
function clearOverlap(c:Context,staffId:string,w:Record<string,any>,rootId?:string) {
 need(!c.s.timesheets.some(t=>t.staffId===staffId&&t.status!=='superseded'&&t.rootId!==rootId&&overlap(t,w)),'Time overlaps another submitted or approved entry',409)
}
/** One exact-revision approval; every check runs before anything is written. TIME-008 approves each bulk item through it. */
export function approve(c:Context,r:Row) {
 need(r.status==='submitted','Only submitted time can be approved',409);need(r.staffId!==c.a.staffId,'You cannot approve your own time',403);staff(c,r.staffId);clearOverlap(c,r.staffId,r,r.rootId)
 if(r.corrects){const old=get(c.s,'timesheets',r.corrects);need(old.status==='approved','Correction source changed',409);put(c,'timesheets',{...old,status:'superseded',supersededBy:r.id},old)}
 const exported=c.s.claims.filter(cl=>cl.root_id===r.rootId).reduce((n,cl)=>n+cl.minutes,0)
 return put(c,'timesheets',{...r,status:'approved',exportMinutes:r.minutes-exported,approvedBy:c.a.id,approvedAt:c.now},r)
}
export function time(c:Context,name:string,p:Record<string,any>) {
 if(name==='clock.in'||name==='clock.out') {
  keys(p,name==='clock.in'?['commandId','capturedAt']:['commandId','capturedAt','breakMinutes']);const staffId=self(c.a),at=instant(p.capturedAt,'capturedAt');need(Date.parse(at)<=Date.parse(c.now)+60000,'Clock capture cannot be in the future')
  const open=c.s.clocks.find(r=>r.staffId===staffId&&r.status==='open')
  if(name==='clock.in') {
   need(!open,'You already have an open clock',409)
   need(!c.s.clocks.some(r=>r.staffId===staffId&&r.end&&r.end>at),'Clock capture predates an existing clock; ask a manager to prepare missed time',409)
   // TIME-006: refused before any write, or accepted with its flags kept for the timesheet.
   const check=checkClockIn(c.s,staffId,at)
   return put(c,'clocks',{staffId,start:at,end:null,status:'open',capturedBy:c.a.id,receivedAt:c.now,shiftId:check.shiftId,...(check.exceptions.length?{exceptions:check.exceptions}:{})})
  }
  need(open,'No open clock to stop',409);const w=work({start:open.start,end:at,breakMinutes:integer(p.breakMinutes,'breakMinutes',0,1440)});clearOverlap(c,staffId,w)
  const entry=put(c,'timesheets',{staffId,...w,status:'submitted',reason:'Phone clock',corrects:null,rootId:'',submittedBy:c.a.id,submittedAt:c.now,clockId:open.id,...(open.exceptions?.length?{exceptions:open.exceptions}:{})});entry.rootId=entry.id
  const clock=put(c,'clocks',{...open,end:at,status:'closed',timesheetId:entry.id,closedReceivedAt:c.now},open);c.entity=entry.id
  return {clock,timesheet:entry}
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
