import {priced} from './workforce'
// PAY-001: an opt-in classified ledger retains policy, rate and source identity.
import {type Context,type Row,canonical,need,staff} from './model'
import {policyClassification} from './policy'
import {workweek} from './payschedules'
import {localDate} from './settings'
import {periodOf,heldByPeriod} from './periods'
import {dayAfter} from './aca'
const key=(r:any)=>canonical([r.rootId,r.job,r.area,r.site,r.date,r.earningCode,r.rateCents,r.workflow])
export function classifiedLines(c:Context,lines:any[],template:Row){
 const selected=lines.filter(l=>!l.payCode&&!l.overtimeKey),people=new Set(selected.map(l=>l.staffId))
 for(const l of selected)need(['W-2','1099'].includes(template.employees[l.staffId]?.workflow),'Worker classification is unclassified; owner review is required before output',409)
 const exported=c.s.batches.filter(b=>['exported','acknowledged'].includes(b.status))
 const roots=new Set(selected.map(l=>l.rootId))
 for(const b of exported)for(const l of b.classificationLines??[])if(l.classifiedWorked&&people.has(l.staffId))roots.add(l.rootId)
 // A historical hours-only file cannot establish a provider's applied earning
 // classifications. Refuse an implicit conversion of that external history.
 for(const b of exported)for(const l of b.lines)if(!l.payCode&&roots.has(l.rootId))need(b.classificationLines,'Previously exported hours need reconciliation before classified payroll',409)
 const current=c.s.timesheets.filter(t=>t.status==='approved'&&roots.has(t.rootId)),desired:any[]=[]
 const weeks=new Map<string,ReturnType<typeof policyClassification>>()
 for(const t of current){
  const employee=template.employees[t.staffId];need(employee,'Unmapped employee; update the template',409)
  need(['W-2','1099'].includes(employee.workflow),'Worker classification is unclassified; owner review is required before output',409)
  need(!heldByPeriod(c.s,t),'Classified source period must be locked',409)
  const oldWorkflows=new Set(exported.flatMap(b=>b.classificationLines??[]).filter(l=>l.classifiedWorked&&l.rootId===t.rootId).map(l=>l.workflow))
  need(!oldWorkflows.size||oldWorkflows.has(employee.workflow),'Exported employment workflow cannot be changed implicitly',409)
  const firstPart=desired.length,bases=t.workSegments?.length?t.workSegments:[t]
  const dates=[...new Set(bases.flatMap((area:any)=>priced(c.s,t.staffId,{...t,...area}).segments.map((p:any)=>p.date)))] as string[]
  for(const on of dates){
   const week=workweek(c.s,t.staffId,on),wk=t.staffId+'|'+week
   need(dayAfter(week,6)<localDate(c.now,c.s.timezone),'Close the complete workweek before classified export',409)
   need(!c.s.timesheets.some(x=>x.staffId===t.staffId&&!['approved','superseded','rejected'].includes(x.status)&&workweek(c.s,x.staffId,localDate(x.start,c.s.timezone))===week),'Workweek has unapproved time; resolve it before classified export',409)
   need(!c.s.clocks.some(x=>x.staffId===t.staffId&&!x.end&&workweek(c.s,x.staffId,localDate(x.start,c.s.timezone))===week),'Workweek has an open punch',409)
   if(!weeks.has(wk))weeks.set(wk,policyClassification(c.s,t.staffId,week))
   const report=weeks.get(wk)!
   need(!report.classificationIncomplete,'Consecutive-hours overtime needs qualifying recorded meal evidence before classified export',409)
   need(employee.workflow==='1099'||!(report.overtimeMinutes||report.doubleMinutes)||new Set(report.parts.map((x:any)=>x.cents)).size<=1,'Mixed-rate overtime needs provider-confirmed regular-rate treatment; use reviewed source inputs',409)
   need(!exported.some(b=>!b.classificationLines&&b.lines.some((l:any)=>l.overtimeKey&&l.staffId===t.staffId&&l.trace?.week===week)),'Legacy overtime premiums need reconciliation before classified payroll',409)
   for(const p of report.parts.filter((p:any)=>p.timeId===t.id&&p.date===on)){
    const categories=employee.workflow==='1099'?[['regular',p.minutes,1]]:[['regular',p.regularMinutes,1],['overtime',p.overtimeMinutes,1.5],['double time',p.doubleMinutes,2]]
    for(const [earningCode,minutes,multiplier] of categories as [string,number,number][]){if(!minutes)continue
     need(p.cents!==null,'Classified payroll needs retained job rates',409)
     desired.push({classifiedWorked:true,timeId:t.id,revision:t.revision,rootId:t.rootId,staffId:t.staffId,payrollId:staff(c,t.staffId).payroll_id,start:t.start,end:t.end,sourceStart:t.start,sourceEnd:t.end,job:p.job,area:p.area??'',site:p.site,date:p.date,week,periodId:periodOf(c.s,t)?.id??'',earningCode,minutes,rateCents:p.cents,rateReference:p.rateReference,multiplier,costCents:Math.round(minutes*p.cents*multiplier/60),workflow:employee.workflow,policyRefs:p.rules,rateBasis:{...t.rateBasis,job:p.job,site:p.site,segments:[{date:p.date,minutes,cents:p.cents}]}})
    }
   }
  }
  need(desired.slice(firstPart).reduce((n,l)=>n+l.minutes,0)===t.minutes,'Classified minutes do not reconcile to approved time',409)
 }
 const deltas=new Map<string,any>()
 for(const l of desired){const k=key(l),prior=deltas.get(k);if(prior){prior.minutes+=l.minutes;prior.costCents+=l.costCents}else deltas.set(k,{...l})}
 for(const b of exported)for(const l of b.classificationLines??[]){if(!l.classifiedWorked||!roots.has(l.rootId))continue
  const k=key(l),prior=deltas.get(k)
  if(prior){prior.minutes-=l.minutes;prior.costCents-=l.costCents}else deltas.set(k,{...l,payrollId:staff(c,l.staffId).payroll_id,minutes:-l.minutes,costCents:-l.costCents})
 }
 const worked=[...deltas.values()].filter(l=>l.minutes||l.costCents)
 // PAY-009's half-rate input is already included in the fully classified worked
 // lines. Other approved earning sources remain separate non-work inputs.
 return [...worked,...lines.filter(l=>l.payCode&&!l.overtimeKey).map(l=>({...l,earningCode:l.payCode,workflow:template.employees[l.staffId]?.workflow}))]
}
