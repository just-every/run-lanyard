// Willow payroll's reviewed file + immutable SHA + unique source claims.
// Each correction exports only the signed difference from prior claimed time.
import {type Context,type Row,keys,text,need,prepare,manager,staff,get,exact,put,sha} from './model'
function cell(value:unknown,numeric=false) { let s=String(value??'');if(!numeric&&/^[\s]*[=+\-@\t\r]/.test(s))s="'"+s;return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s }
export function csv(lines:Row[]|any[]) {
 return 'payroll_id,time_id,revision,start_utc,end_utc,minutes,hours,corrects\r\n'+lines.map(l=>[cell(l.payrollId),cell(l.timeId),cell(l.revision,true),cell(l.start),cell(l.end),cell(l.minutes,true),cell((l.minutes/60).toFixed(4),true),cell(l.corrects)].join(',')).join('\r\n')+'\r\n'
}
export async function payroll(c:Context,name:string,p:Record<string,any>) {
 if(name==='payroll.prepare') {
  prepare(c.a);keys(p,['ids']);need(p.ids===undefined||(Array.isArray(p.ids)&&p.ids.length>0&&p.ids.length<=500),'Provide 1–500 timesheet IDs')
  const ids=p.ids?.map((v:unknown)=>text(v,'time ID'));if(ids)need(new Set(ids).size===ids.length,'Duplicate timesheet IDs')
  const available=c.s.timesheets.filter(t=>t.status==='approved'&&!c.s.claims.some(cl=>cl.time_id===t.id&&cl.time_revision===t.revision))
  const selected=ids?ids.map((id:string)=>{const t=available.find(r=>r.id===id);need(t,'Selected time is not approved or is already exported',409);return t}):available
  need(selected.length>0&&selected.length<=500,'No approved unexported time, or too many entries',409)
  const lines=selected.sort((a:Row,b:Row)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id)).map((t:Row)=>{const person=staff(c,t.staffId);need(person.payroll_id,'Set the staff payroll ID first',409);return {timeId:t.id,revision:t.revision,staffId:t.staffId,payrollId:person.payroll_id,start:t.start,end:t.end,minutes:t.exportMinutes,corrects:t.corrects,rootId:t.rootId}})
  const r=put(c,'batches',{status:'draft',lines,csvPreview:csv(lines),preparedBy:c.a.id,preparedAt:c.now})
  return {...r,approvalRequired:'payroll.export',approval:{id:r.id,revision:r.revision}}
 }
 if(name==='payroll.export') {
  manager(c.a);keys(p,['id','revision']);const b=get(c.s,'batches',p.id);exact(b,p);need(b.status==='draft','Batch already exported',409)
  for(const line of b.lines) {
   const t=get(c.s,'timesheets',line.timeId),person=staff(c,line.staffId)
   need(t.status==='approved'&&t.revision===line.revision&&person.payroll_id===line.payrollId,'Reviewed payroll sources changed; prepare a new batch',409)
   need(!c.s.claims.some(cl=>cl.time_id===t.id&&cl.time_revision===t.revision),'Time revision already claimed by another export',409)
   // A later correction preparation must be decided before exporting its source.
   need(!c.s.timesheets.some(x=>x.corrects===t.id),'A correction is awaiting approval; prepare payroll after its decision',409)
   const prior=c.s.claims.filter(cl=>cl.root_id===t.rootId).reduce((n,cl)=>n+cl.minutes,0)
   need(line.minutes===t.minutes-prior,'Correction delta changed; prepare a new batch',409)
   c.sql.push(c.db.prepare('INSERT INTO l_payroll_claims(time_id,time_revision,batch_id,root_id,minutes) VALUES(?,?,?,?,?)').bind(t.id,t.revision,b.id,t.rootId,line.minutes))
  }
  need(csv(b.lines)===b.csvPreview,'Reviewed file changed',409)
  return put(c,'batches',{...b,status:'exported',csv:b.csvPreview,sha256:await sha(b.csvPreview),exportedBy:c.a.id,exportedAt:c.now},b)
 }
 if(name==='payroll.acknowledge') {
  manager(c.a);keys(p,['id','revision','reference']);const b=get(c.s,'batches',p.id);exact(b,p);need(b.status==='exported','Only exported payroll can be acknowledged',409)
  return put(c,'batches',{...b,status:'acknowledged',reference:text(p.reference,'reference',120),acknowledgedBy:c.a.id,acknowledgedAt:c.now},b)
 }
 return undefined
}
