// Willow payroll's reviewed file + immutable SHA + unique source claims.
// Each correction exports only the signed difference from prior claimed time.
import {type Context,type Row,keys,text,need,prepare,manager,staff,get,exact,put,sha} from './model'
import {priced} from './workforce'
import {regularLines} from './segmentpay'
import {provisional} from './closerules'
import {heldByPeriod} from './periods'
function cell(value:unknown,numeric=false) { let s=String(value??'');if(!numeric&&/^[\s]*[=+\-@\t\r]/.test(s))s="'"+s;return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s }
// pay_code: "regular" is net worked time; "meal premium" and "rest premium" are BREAK-001 premium inputs
// (minutes of premium pay at the regular rate, not worked time), exported as signed differences like hours.
export function csv(lines:Row[]|any[]) {
 const segmented=lines.some(l=>l.area!==undefined)
 return 'payroll_id,time_id,revision,start_utc,end_utc,minutes,hours,corrects,pay_code'+(segmented?',job_id,work_area,location,source_start_utc,source_end_utc':'')+'\r\n'+lines.map(l=>[cell(l.payrollId),cell(l.timeId),cell(l.revision,true),cell(l.start),cell(l.end),cell(l.minutes,true),cell((l.minutes/60).toFixed(4),true),cell(l.corrects),cell(l.payCode??'regular'),...(segmented?[cell(l.job),cell(l.area),cell(l.site),cell(l.sourceStart??l.start),cell(l.sourceEnd??l.end)]:[])].join(',')).join('\r\n')+'\r\n'
}
/** Premium minutes already exported for a timesheet's lineage, by pay code. */
const exportedPremium=(c:Context,rootId:string,code:string)=>c.s.batches.filter(b=>b.status==='exported'||b.status==='acknowledged').flatMap(b=>b.lines).filter((l:any)=>l.rootId===rootId&&l.payCode===code).reduce((n:number,l:any)=>n+l.minutes,0)
/** BREAK-001: each premium code's difference from what this lineage already exported. */
function premiumLines(c:Context,t:Row,base:Record<string,any>) {
 const codes=['meal premium','rest premium']
 return codes.map(code=>({...base,payCode:code,minutes:(t.premiums??[]).filter((p:any)=>p.code===code).reduce((n:number,p:any)=>n+p.minutes,0)-exportedPremium(c,t.rootId,code)})).filter(l=>l.minutes!==0)
}
export async function payroll(c:Context,name:string,p:Record<string,any>) {
 if(name==='payroll.prepare') {
  prepare(c.a);keys(p,['ids']);need(p.ids===undefined||(Array.isArray(p.ids)&&p.ids.length>0&&p.ids.length<=500),'Provide 1–500 timesheet IDs')
  const ids=p.ids?.map((v:unknown)=>text(v,'time ID'));if(ids)need(new Set(ids).size===ids.length,'Duplicate timesheet IDs')
  // TIME-004: time in an open defined pay period waits for the period's lock.
  const unclaimed=c.s.timesheets.filter(t=>t.status==='approved'&&!c.s.claims.some(cl=>cl.time_id===t.id&&cl.time_revision===t.revision)),available=unclaimed.filter(t=>!heldByPeriod(c.s,t))
  const selected=ids?ids.map((id:string)=>{const t=available.find(r=>r.id===id);need(t,unclaimed.some(r=>r.id===id)?'Selected time is in an open pay period; lock the period first':'Selected time is not approved or is already exported',409);return t}):available
  // TIME-007: a provisionally closed punch is never exported; it is listed as held until confirmed or corrected and approved.
  const held=[...c.s.clocks.filter(k=>provisional(c.s,k,c.now)).map(k=>({clockId:k.id,staffId:k.staffId,start:k.start,reason:'provisional close'})),...unclaimed.filter(t=>heldByPeriod(c.s,t)).map(t=>({timeId:t.id,staffId:t.staffId,start:t.start,reason:'pay period open'}))]
  need(selected.length>0&&selected.length<=500,`No approved unexported time, or too many entries${held.length?`; ${held.length} provisionally closed punch${held.length===1?'':'es'} held until confirmed`:''}`,409)
  const lines=selected.sort((a:Row,b:Row)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id)).flatMap((t:Row)=>{const person=staff(c,t.staffId);need(person.payroll_id,'Set the staff payroll ID first',409);const base={timeId:t.id,revision:t.revision,staffId:t.staffId,payrollId:person.payroll_id,start:t.start,end:t.end,sourceStart:t.start,sourceEnd:t.end,corrects:t.corrects,rootId:t.rootId,rateBasis:priced(c.s,t.staffId,t)};return [...regularLines(c,t,base),...premiumLines(c,t,base)]})
  const r=put(c,'batches',{status:'draft',lines,held,csvPreview:csv(lines),preparedBy:c.a.id,preparedAt:c.now})
  return {...r,approvalRequired:'payroll.export',approval:{id:r.id,revision:r.revision}}
 }
 if(name==='payroll.export') {
  manager(c.a);keys(p,['id','revision']);const b=get(c.s,'batches',p.id);exact(b,p);need(b.status==='draft','Batch already exported',409)
  const checked=new Set<string>()
  for(const line of b.lines) {
   const t=get(c.s,'timesheets',line.timeId),person=staff(c,line.staffId)
   need(t.status==='approved'&&t.revision===line.revision&&person.payroll_id===line.payrollId,'Reviewed payroll sources changed; prepare a new batch',409)
   need(!heldByPeriod(c.s,t),'This time\'s pay period was reopened; lock it before exporting',409)
   // A premium line rides on its timesheet's regular line, which claims the revision.
   if(line.payCode){need(premiumLines(c,t,{}).some(l=>l.payCode===line.payCode&&l.minutes===line.minutes),'Premium inputs changed; prepare a new batch',409);continue}
   if(checked.has(t.id))continue
   checked.add(t.id)
   need(!c.s.claims.some(cl=>cl.time_id===t.id&&cl.time_revision===t.revision),'Time revision already claimed by another export',409)
   // A later correction preparation must be decided before exporting its source.
   need(!c.s.timesheets.some(x=>x.corrects===t.id),'A correction is awaiting approval; prepare payroll after its decision',409)
   const prior=c.s.claims.filter(cl=>cl.root_id===t.rootId).reduce((n,cl)=>n+cl.minutes,0)
   need(b.lines.filter((l:any)=>l.timeId===t.id&&!l.payCode).reduce((n:number,l:any)=>n+l.minutes,0)===t.minutes-prior&&JSON.stringify(b.lines.filter((l:any)=>l.timeId===t.id&&!l.payCode).map((l:any)=>[l.job,l.area,l.site,l.minutes]))===JSON.stringify(regularLines(c,t,line).map(l=>[l.job,l.area,l.site,l.minutes])),'Correction delta changed; prepare a new batch',409)
   c.sql.push(c.db.prepare('INSERT INTO l_payroll_claims(time_id,time_revision,batch_id,root_id,minutes) VALUES(?,?,?,?,?)').bind(t.id,t.revision,b.id,t.rootId,t.minutes-prior))
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
