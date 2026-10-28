import {tipPoolCurrent} from './tip-pools'
// Employer-approved non-work inputs stay separate from punches and leave banks.
import {type Context,type Row,keys,text,need,integer,staff,get,exact,put,canonical} from './model'
import {date,dayAfter} from './aca'
import {heldByPeriod} from './periods'
import {tipChecks} from './tipcredit'
import {localDate,instantAt} from './settings'
import {workweek} from './payschedules'
export function payrollInputCommand(c:Context,name:string,p:Record<string,any>){
 if(name!=='payroll.input.save')return
 need(c.a.role==='owner','Only the payroll administrator (the owner) approves payroll inputs',403)
 keys(p,['id','revision','staffId','date','kind','minutes','amountCents','reference','reason'])
 const old=p.id?get(c.s,'payinputs',p.id):undefined;if(old)exact(old,p)
 need(!old?.tipPoolId,'Correct a pool allocation through its reviewed tip pool',409)
 const person=staff(c,p.staffId),on=date(p.date,'earning date');need(['PTO','tips'].includes(p.kind),'Choose PTO or tips')
 if(old)need(old.staffId===person.id&&old.date===on&&old.kind===p.kind,'Correct the original person, date and earning kind',409)
 const minutes=integer(p.minutes,'paid non-work minutes',0,1440),amountCents=integer(p.amountCents,'approved USD cents',0,99999999)
 need(p.kind!=='tips'||minutes===0,'Tips carry money only; never worked minutes')
 need(p.kind!=='PTO'||minutes>0||old,'PTO needs paid minutes')
 const reference=text(p.reference,'employer source reference',200),reason=text(p.reason,'approval or correction reason',500)
 need(!c.s.payinputs.some(x=>x.id!==old?.id&&x.reference===reference),'Employer source reference already used',409)
 return put(c,'payinputs',{staffId:person.id,site:person.site??'',date:on,kind:p.kind,minutes,amountCents,reference,reason,label:'Employer-approved payroll input; no provider readback or leave balance change',by:c.a.id,at:c.now,versions:old?[...(old.versions??[]),{...old,versions:undefined}]:[]},old)
}
const exports=(c:Context)=>c.s.batches.filter(b=>['exported','acknowledged'].includes(b.status)).flatMap(b=>b.lines)
export function payrollInputLines(c:Context){
 const past=exports(c)
 return c.s.payinputs.flatMap(r=>{
  if(r.tipPoolId)need(tipPoolCurrent(c.s,get(c.s,'tippools',r.tipPoolId)),'Approved tip pool sources changed; review its correction before payroll',409)
  const start=instantAt(r.date,'12:00',c.s.timezone),source={...r,start}
  if(heldByPeriod(c.s,source))return []
  const before=past.filter((l:any)=>l.payInputId===r.id),minutes=r.minutes-before.reduce((n:number,l:any)=>n+l.minutes,0),costCents=r.amountCents-before.reduce((n:number,l:any)=>n+l.costCents,0)
  if(!minutes&&!costCents)return []
  const person=staff(c,r.staffId)
  return [{payInputId:r.id,revision:r.revision,staffId:r.staffId,site:r.site,payrollId:person.payroll_id,start,end:start,date:r.date,minutes,costCents,payCode:r.kind==='PTO'?'PTO':'tips',sourceReference:r.reference,approval:{by:r.by,at:r.at,reason:r.reason}}]
 })
}
export function makeUpLines(c:Context){
 const past=exports(c),weeks=[...new Set(c.s.timesheets.filter(t=>t.status==='approved').map(t=>workweek(c.s,t.staffId,localDate(t.start,c.s.timezone))))]
 const checks=tipChecks(c.s,c.a,weeks),rows=new Map(checks.map(r=>[r.staffId+'|'+r.week,r]))
 for(const l of past.filter((l:any)=>l.makeupKey))if(!rows.has(l.makeupKey))rows.set(l.makeupKey,{staffId:l.staffId,week:l.week,makeUpCents:0,sources:[],sites:[],tipSources:[],rateMissing:false})
 return [...rows.entries()].flatMap(([makeupKey,r])=>{
  const costCents=r.makeUpCents===null?null:r.makeUpCents-past.filter((l:any)=>l.makeupKey===makeupKey).reduce((n:number,l:any)=>n+l.costCents,0)
  if(costCents===0)return []
  need(costCents!==null,r.poolReviewRequired?'Approved tip pool sources changed; review its correction before payroll':'Tip make-up source has a missing retained rate',409)
  need(!c.s.timesheets.some(t=>t.staffId===r.staffId&&!['approved','superseded','rejected'].includes(t.status)&&workweek(c.s,t.staffId,localDate(t.start,c.s.timezone))===r.week),'Tip make-up workweek has unapproved time',409)
  need(!c.s.clocks.some(t=>t.staffId===r.staffId&&!t.end&&workweek(c.s,t.staffId,localDate(t.start,c.s.timezone))===r.week),'Tip make-up workweek has an open punch',409)
  need(dayAfter(r.week,6)<localDate(c.now,c.s.timezone),'Close the workweek before exporting tip make-up',409)
  need(!r.sources.some((x:any)=>heldByPeriod(c.s,c.s.timesheets.find(t=>t.id===x.timesheetId)!)),'Lock the source period before exporting tip make-up',409)
  need(r.sites.length<=1,'Multi-site tip make-up needs an employer-reviewed allocation',409)
  return [{site:r.sites[0]?.site??'',makeupKey,staffId:r.staffId,payrollId:staff(c,r.staffId).payroll_id,week:r.week,start:instantAt(r.week,'12:00',c.s.timezone),end:instantAt(dayAfter(r.week,7),'12:00',c.s.timezone),minutes:0,costCents,payCode:'tip make-up',sourceDigest:canonical({sources:r.sources,sites:r.sites,tipSources:r.tipSources,makeUpCents:r.makeUpCents})}]
 })
}
