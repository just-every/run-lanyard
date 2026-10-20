// CLOCK-002: a device-reported rejected capture is evidence, never applied time.
import {type Context,type State,type Actor,keys,object,text,need,self,instant,manager,get,exact,put,canonical} from './model'
const captureNames=['clock.in','clock.out','clock.breakStart','clock.breakEnd']
export function issuesFor(s:State,a:Actor) {
 if(a.role==='agent')return []
 const cafe=s.staff.find(p=>p.id===a.staffId)?.site??''
 return s.clockissues.filter(r=>a.role==='owner'||r.staffId===a.staffId||(a.role==='manager'&&r.site===cafe))
}
export async function offline(c:Context,name:string,p:Record<string,any>) {
 if(name==='clock.recover') {
  manager(c.a);keys(p,['commandId','capture','actorId','error'])
  const actorId=text(p.actorId,'original actor',120)
  const operator=await c.db.prepare('SELECT email FROM oa_operators WHERE id=?').bind(actorId).first<{email:string}>()
  const person=operator&&c.s.staff.find(r=>r.email.toLowerCase()===operator.email.toLowerCase()&&!r.erased_at)
  need(person,'Original employee no longer available for review',409)
  const home=c.s.staff.find(r=>r.id===c.a.staffId)?.site??''
  need(c.a.role==='owner'||(person.site??'')===home,'Capture is outside your cafe',403)
  return report(c,p,person.id,actorId)
 }
 if(name==='clock.report') {
  keys(p,['commandId','capture','error']);return report(c,p,self(c.a)!,c.a.id)
 }
 if(name==='clockissue.resolve') {
  manager(c.a);keys(p,['commandId','id','revision','reason']);const r=get(c.s,'clockissues',p.id);exact(r,p)
  need(r.staffId!==c.a.staffId,'You cannot resolve your own capture',403);need(issuesFor(c.s,c.a).some(x=>x.id===r.id),'Capture is outside your cafe',403)
  need(r.status==='unresolved','Capture is already resolved',409)
  return put(c,'clockissues',{...r,status:'resolved',resolution:{by:c.a.id,at:c.now,reason:text(p.reason,'resolution',500)}},r)
 }
 return undefined
}

function report(c:Context,p:Record<string,any>,staffId:string,actorId:string) {
 const capture=object(p.capture);keys(capture,['name','input']);need(captureNames.includes(capture.name),'Only clock captures can be reported')
  const input=object(capture.input);keys(input,['commandId','capturedAt','kind','breakMinutes','meal','waiveMeal','breakNote','answers'])
  text(input.commandId,'capture identity',120);instant(input.capturedAt,'original captured time');need(canonical(capture).length<=16000,'Capture is too large')
  const prior=c.s.clockissues.find(r=>r.staffId===staffId&&r.capture.input.commandId===input.commandId)
  if(prior){need(canonical(prior.capture)===canonical(capture),'Capture identity has different facts',409);return prior}
  return put(c,'clockissues',{staffId,site:c.s.staff.find(p=>p.id===staffId)?.site??'',capture,error:text(p.error,'device-reported error',1000),status:'unresolved',receivedAt:c.now,reportedBy:c.a.id,originalActorId:actorId})
}
