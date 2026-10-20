// SCHEDULE-004: revisioned operational instructions and checklist handover through
// the native command/state doors. Files and job-segment reconciliation remain open.
import {type Actor,type Context,type Row,type State,keys,text,need,get,exact,put,manager,self} from './model'
import {lineageOf} from './history'
import {siteOf} from './team'

const manages=(s:State,a:Actor,site:string)=>a.role==='owner'||a.role==='manager'&&(s.staff.find(p=>p.id===a.staffId)?.site??'')===site
const current=(s:State,lineage:string)=>s.shifts.find(x=>x.status==='published'&&lineageOf(x)===lineage)
const assigned=(s:State,a:Actor,lineage:string)=>a.role!=='agent'&&!!a.staffId&&current(s,lineage)?.staffId===a.staffId
/** Current assignee only; an offer or previous assignment grants no instructions. */
export function workFor(s:State,a:Actor):Row[] {
 return s.shiftwork.flatMap(r=>manages(s,a,r.site)?[r]:assigned(s,a,r.lineage)?[(({versions,...now})=>now as Row)(r)]:[])
}
/** Prior answers stay with their author and the authorized cafe managers. */
export function answersFor(s:State,a:Actor):Row[] {
 return s.taskanswers.filter(r=>manages(s,a,r.site)||a.role!=='agent'&&r.staffId===a.staffId)
}
export function shiftWork(c:Context,name:string,p:Record<string,any>) {
 if(!['shiftwork.save','shiftwork.respond'].includes(name))return undefined
 const x=get(c.s,'shifts',p.shiftId);exact(x,{revision:p.shiftRevision})
 need(x.status==='published','Choose the current published shift',409)
 const lineage=lineageOf(x),site=siteOf(c.s,x),old=c.s.shiftwork.find(r=>r.lineage===lineage)
 if(name==='shiftwork.save') {
  manager(c.a);need(manages(c.s,c.a,site),'Only this cafe’s managers may write instructions',403)
  keys(p,['shiftId','shiftRevision','revision','notes','tasks'])
  if(old)exact(old,p);else need(p.revision===undefined,'Instructions changed; reload',409)
  const notes=text(p.notes,'instructions',4000,true)
  need(Array.isArray(p.tasks)&&p.tasks.length<=30,'Provide at most 30 checklist tasks')
  const tasks=p.tasks.map((v:unknown)=>({id:crypto.randomUUID(),text:text(v,'task',280)}))
  need(notes||tasks.length,'Provide instructions or a checklist')
  // Every edit gets new task identities. Earlier completions cannot silently apply
  // to changed wording, and each answer retains the wording it confirmed.
  const versions=old?[...old.versions,{revision:old.revision,notes:old.notes,tasks:old.tasks,by:old.by,at:old.at,shiftId:old.shiftId}]:[]
  return put(c,'shiftwork',{lineage,site,shiftId:x.id,notes,tasks,by:c.a.id,at:c.now,versions},old)
 }
 keys(p,['shiftId','shiftRevision','revision','completed','blocker'])
 const staffId=self(c.a);need(x.staffId===staffId,'Only the current assignee may respond',403)
 need(old,'No instructions for this shift',404);exact(old,p)
 need(Array.isArray(p.completed)&&p.completed.length<=30,'Provide completed task ids')
 const ids=p.completed.map((v:unknown)=>text(v,'task id'))
 need(new Set(ids).size===ids.length&&ids.every((id:string)=>old.tasks.some((t:any)=>t.id===id)),'Checklist changed; use current task ids',409)
 const blocker=text(p.blocker,'blocker',2000,true)
 need(ids.length||blocker,'Complete a task or report a blocker')
 return put(c,'taskanswers',{lineage,site,shiftId:x.id,shiftRevision:x.revision,workId:old.id,workRevision:old.revision,staffId,by:c.a.id,at:c.now,completed:old.tasks.filter((t:any)=>ids.includes(t.id)),blocker})
}
