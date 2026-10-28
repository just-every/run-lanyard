// Native owner review only. Employer-supplied eligibility and cash inputs do
// not establish legal eligibility, POS intake, provider acceptance or payment.
import {type Context,type State,type Row,keys,text,integer,need,get,exact,put,canonical,sha} from './model'
import {date} from './aca'
import {localDate} from './settings'
import {tipPieces} from './tip-work'

export const approvedTipPools=(s:State)=>s.tippools.filter(p=>p.status==='approved'&&!s.tippools.some(n=>n.status==='approved'&&n.corrects===p.id))
export const pooledDeclarations=(s:State)=>new Set(approvedTipPools(s).flatMap(p=>p.declarations.map((d:any)=>d.timeId)))
const unique=(value:unknown,label:string)=>{
 need(Array.isArray(value)&&value.length>0&&value.length<=100,`Choose 1–100 ${label}`)
 const result=value.map(v=>text(v,label));need(new Set(result).size===result.length,`Duplicate ${label}`);return result
}
function review(s:State,p:Record<string,any>,ownerEmail:string) {
 const on=date(p.date,'service date'),site=text(p.site,'cafe',80),jobs=unique(p.jobs,'eligible jobs'),participants=unique(p.participants,'eligible people')
 need(jobs.every(id=>s.jobs.some(j=>j.id===id)),'Job not found',404)
 const people=participants.map(id=>{
  const person=s.staff.find(p=>p.id===id&&p.active&&!p.erased_at),profile=s.workforce.find(w=>w.staffId===id)
  need(person?.role==='staff'&&person.email.toLowerCase()!==ownerEmail.toLowerCase()&&profile?.classification==='hourly employee','Only active ordinary hourly employees may participate; owner and manager roles are excluded',409)
  return {id,revision:person.version,profileRevision:profile.revision}
 })
 const sources=s.timesheets.filter(t=>t.status==='approved'&&participants.includes(t.staffId)).flatMap(t=>tipPieces(s,t).filter(x=>x.date===on&&x.site===site&&jobs.includes(x.job)&&x.minutes>0).map(x=>({timeId:t.id,revision:t.revision,staffId:t.staffId,job:x.job,minutes:x.minutes}))).sort((a,b)=>canonical(a).localeCompare(canonical(b)))
 need(participants.every(id=>sources.some(x=>x.staffId===id)),'Every eligible person needs approved work in an eligible job at this cafe on this date',409)
 need(!s.timesheets.some(t=>participants.includes(t.staffId)&&['submitted','returned'].includes(t.status)&&tipPieces(s,t).some(x=>x.site===site&&x.date===on)),'Decide pending time and corrections before approving a pool',409)
 need(!s.clocks.some(k=>participants.includes(k.staffId)&&!k.end&&localDate(k.start,s.timezone)<=on),'Resolve open punches before approving a pool',409)
 need(!s.clockissues.some(i=>i.status==='unresolved'&&participants.includes(i.staffId)&&localDate(i.capture?.input?.capturedAt??i.receivedAt,s.timezone)===on),'Resolve received offline captures before approving a pool',409)
 need(Array.isArray(p.inputs)&&p.inputs.length<=100,'Provide up to 100 reviewed cash or card inputs')
 const inputs=p.inputs.map((v:any)=>{keys(v,['reference','cents']);return {reference:text(v.reference,'tip source reference',200),cents:integer(v.cents,'tip input cents',0,99999999)}})
 need(new Set(inputs.map((v:any)=>v.reference)).size===inputs.length,'Duplicate tip source reference',409)
 need(Array.isArray(p.declarationIds)&&p.declarationIds.length<=100,'Provide declared-tip source IDs')
 const declarationIds=p.declarationIds.map((v:unknown)=>text(v,'declared-tip source'))
 need(new Set(declarationIds).size===declarationIds.length,'Duplicate declaration source',409)
 const declarations=declarationIds.map((id:string)=>{
  const t=get(s,'timesheets',id),current=s.timesheets.find(n=>n.rootId===t.id&&n.status==='approved')
  need((t.rootId===t.id)&&current&&participants.includes(t.staffId)&&tipPieces(s,current).some(x=>x.date===on&&x.site===site&&jobs.includes(x.job)),'Declaration needs current approved eligible work',409)
  const answers=(t.answers??[]).filter((a:any)=>a.kind==='tips'&&typeof a.value==='number')
  need(answers.length,'No cash tips declared on this source',409)
  return {timeId:t.id,revision:t.revision,staffId:t.staffId,cents:answers.reduce((n:number,a:any)=>n+a.value,0)}
 })
 const totalCents=inputs.reduce((n:number,v:any)=>n+v.cents,0)+declarations.reduce((n:number,v:any)=>n+v.cents,0)
 need(Number.isSafeInteger(totalCents)&&totalCents>0&&totalCents<=99999999,'Pool total must be positive and within the supported USD range')
 const current=approvedTipPools(s).filter(r=>r.rootId!==p.rootId)
 need(!current.some(r=>r.inputs.some((v:any)=>inputs.some((i:any)=>v.reference===i.reference))||r.declarations.some((d:any)=>declarationIds.includes(d.timeId))),'Tip input already belongs to an approved pool',409)
 const groups=new Map<string,{staffId:string;job:string;minutes:number}>()
 for(const x of sources){const key=x.staffId+'|'+x.job,old=groups.get(key);groups.set(key,{staffId:x.staffId,job:x.job,minutes:(old?.minutes??0)+x.minutes})}
 const totalMinutes=sources.reduce((n,v)=>n+v.minutes,0)
 const allocations=[...groups.values()].map(g=>({...g,cents:Math.floor(totalCents*g.minutes/totalMinutes),remainder:totalCents*g.minutes%totalMinutes})).sort((a,b)=>b.remainder-a.remainder||a.staffId.localeCompare(b.staffId)||a.job.localeCompare(b.job))
 let left=totalCents-allocations.reduce((n,a)=>n+a.cents,0)
 for(const a of allocations)if(left-->0)a.cents++
 return {date:on,site,jobs,participants,people,sources,inputs,declarations,totalCents,totalMinutes,allocations:allocations.map(({remainder,...a})=>a).sort((a,b)=>a.staffId.localeCompare(b.staffId)||a.job.localeCompare(b.job))}
}
export async function tipPoolCommand(c:Context,name:string,p:Record<string,any>) {
 if(!['tip.pool.prepare','tip.pool.approve'].includes(name))return undefined
 need(c.a.role==='owner','Only the owner reviews native tip pools',403)
 if(name==='tip.pool.prepare'){
  keys(p,['site','date','jobs','participants','inputs','declarationIds','corrects','reason'])
  need(date(p.date,'service date')<localDate(c.now,c.s.timezone),'Close the service date before reviewing its pool',409)
  const old=p.corrects?get(c.s,'tippools',p.corrects):undefined
  if(old)need(approvedTipPools(c.s).some(r=>r.id===old.id)&&old.date===p.date&&old.site===p.site,'Correct the latest approved pool at its original cafe and date',409)
  const rootId=old?.rootId??crypto.randomUUID(),facts=review(c.s,{...p,rootId},c.a.email)
  return put(c,'tippools',{...facts,rootId,corrects:old?.id??null,status:'draft',reason:text(p.reason,'eligibility and source review reason',500),sourceDigest:await sha(canonical(facts)),preparedBy:c.a.id,preparedAt:c.now})
 }
 keys(p,['id','revision','consent']);need(p.consent===true,'Explicit reviewed eligibility and allocation approval is required',403)
 const draft=get(c.s,'tippools',p.id);exact(draft,p);need(draft.status==='draft','This pool was already approved',409)
 if(draft.corrects)need(approvedTipPools(c.s).some(r=>r.id===draft.corrects),'Pool correction source changed; prepare again',409)
 const facts=review(c.s,{...draft,declarationIds:draft.declarations.map((d:any)=>d.timeId)},c.a.email)
 need(await sha(canonical(facts))===draft.sourceDigest,'Pool work, eligibility or inputs changed; prepare again',409)
 const approved=put(c,'tippools',{...draft,status:'approved',approvedBy:c.a.id,approvedAt:c.now},draft)
 // Reuse stable payroll inputs so later mapped exports carry signed differences.
 const existing=c.s.payinputs.filter(r=>r.tipPoolRootId===approved.rootId),ids=new Set([...existing.map(r=>r.staffId),...approved.participants])
 for(const staffId of ids){
  const old=existing.find(r=>r.staffId===staffId),amountCents=approved.allocations.filter((a:any)=>a.staffId===staffId).reduce((n:number,a:any)=>n+a.cents,0)
  put(c,'payinputs',{staffId,site:approved.site,date:approved.date,kind:'tips',minutes:0,amountCents,reference:'tip-pool:'+approved.rootId+':'+staffId,reason:approved.reason,label:'Owner-approved native tip pool; no provider readback',tipPoolRootId:approved.rootId,tipPoolId:approved.id,tipPoolRevision:approved.revision,by:c.a.id,at:c.now,versions:old?[...(old.versions??[]),{...old,versions:undefined}]:[]},old)
 }
 c.entity=approved.id
 return approved
}
