import {type State,type Context,type Row,keys,text,need,integer,put,get,exact,window,overlap,canonical,self} from './model'
import {sickCoverage} from './sick-coverage'
import {sickPreset} from './sick-presets'
import {date,dayAfter} from './aca'
import {localDate} from './settings'
import {priced,rateAt} from './workforce'
import {heldByPeriod} from './periods'
const cEmploymentStart=(s:State,staffId:string)=>s.employment.find(e=>e.staffId===staffId)?.startDate
export const sickRule=(plan:Row,on:string)=>[...(plan.versions??[]),plan].filter(r=>r.from<=on).sort((a,b)=>a.from.localeCompare(b.from)||a.revision-b.revision).at(-1)
export function sickWork(s:State,staffId:string,site:string){
 return s.timesheets.filter(t=>t.staffId===staffId&&t.status==='approved').flatMap(t=>(t.workSegments?.length?t.workSegments:[{...t,rateBasis:priced(s,staffId,t)}]).flatMap((w:any)=>(w.rateBasis.site||s.staff.find(p=>p.id===staffId)?.site||'')===site?w.rateBasis.segments.map((p:any)=>({kind:'work',id:t.id,revision:t.revision,date:p.date,minutes:p.minutes,site,job:w.job??'',area:w.area??''})):[]))
}
/** Rebuild from current approved source revisions; pending and superseded time never accrue.
 * Fractional minutes use 1/840 minute units (LCM 30,35,40); no per-punch rounding loss.
 * Annual accrual/use counters reset Jan 1, balance carries to the next year's cap. */
export function sickBalance(s:State,staffId:string,plan:Row,on:string,exclude?:string){
 if(plan.grantMinutes!==undefined)return grantedBalance(s,staffId,plan,on,exclude)
 const events=[...sickWork(s,staffId,plan.site),...s.sickuses.filter(u=>u.staffId===staffId&&u.policyId===plan.id&&u.status==='approved'&&u.id!==exclude).map(u=>({...u,kind:'use'}))].filter(e=>e.date<=on&&sickRule(plan,e.date)).sort((a,b)=>a.date.localeCompare(b.date)||(a.kind==='work'?-1:1)-(b.kind==='work'?-1:1)||a.id.localeCompare(b.id))
 const firstRule=[...(plan.versions??[]),plan].sort((a,b)=>a.from.localeCompare(b.from))[0]
 let balance=0,annualAccrued=0,annualUsed=0,fraction=0,year=Number(firstRule.from.slice(0,4));const sources:any[]=[]
 const carryTo=(target:number)=>{while(year<target){year++;const rule=sickRule(plan,`${year}-01-01`)??sickRule(plan,`${year-1}-12-31`);if(rule&&rule.carry!==null)balance=Math.min(balance,rule.carry);annualAccrued=0;annualUsed=0;sources.push({kind:'carry',date:`${year}-01-01`,balanceMinutes:balance,presetVersion:rule?.version})}}
 for(const e of events){carryTo(Number(e.date.slice(0,4)));const rule=sickRule(plan,e.date)!
  if(e.kind==='work'){fraction+=e.minutes*(840/rule.denominator);const earned=Math.floor((fraction+1e-8)/840);fraction-=earned*840;const credited=Math.max(0,Math.min(earned,rule.annualAccrual===null?Infinity:rule.annualAccrual-annualAccrued,rule.bankCap===null?Infinity:rule.bankCap-balance));balance+=credited;annualAccrued+=credited;sources.push({...e,creditedMinutes:credited,balanceMinutes:balance,policyRevision:rule.revision,presetVersion:rule.version})}
  else{balance-=e.minutes;annualUsed+=e.minutes;sources.push({...e,balanceMinutes:balance})}
 }
 carryTo(Number(on.slice(0,4)))
 const current=sickRule(plan,on),pending=s.sickuses.filter(u=>u.staffId===staffId&&u.policyId===plan.id&&u.status==='pending').reduce((n,u)=>n+u.minutes,0)
 return {staffId,policyId:plan.id,site:plan.site,asOf:on,preset:current?.preset,label:current?.label??'Not effective',code:current?.code,paid:current?.paid!==false,balanceMinutes:balance,annualAccrued,annualUsed,pendingMinutes:pending,reconciliationRequired:balance<0,sources}
}
// Fixed grants never accrue from worked time. Prenatal leave starts a new
// 52-week window at first use; the NYC immediate bank renews each January 1.
function grantedBalance(s:State,staffId:string,plan:Row,on:string,exclude?:string){
 const first=[...(plan.versions??[]),plan].sort((a,b)=>a.from.localeCompare(b.from))[0],employmentStart=cEmploymentStart(s,staffId)
 const from=[first.from,first.notBefore??first.from,employmentStart??on].sort().at(-1)!,rule=sickRule(plan,on)
 const eligible=!!employmentStart&&(s.staff.find(p=>p.id===staffId)?.site===plan.site||sickWork(s,staffId,plan.site).some(w=>w.date<=on))
 let balance=0,annualUsed=0,periodStart:string|null=null,year=Number(from.slice(0,4));const sources:any[]=[]
 const grant=(date:string)=>{const r=sickRule(plan,date);balance=r?.grantMinutes??0;annualUsed=0;sources.push({kind:'grant',date,minutes:balance,balanceMinutes:balance,policyRevision:r?.revision,presetVersion:r?.version})}
 const annual=(date:string)=>{while(year<Number(date.slice(0,4))){year++;grant(year+'-01-01')}}
 if(eligible&&from<=on){
  grant(from)
  for(const u of s.sickuses.filter(u=>u.staffId===staffId&&u.policyId===plan.id&&u.status==='approved'&&u.id!==exclude&&u.date>=from&&u.date<=on).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))){
   if(first.entitlementDays){
    if(periodStart===null)periodStart=u.date
    else if(u.date>=dayAfter(periodStart,first.entitlementDays)){periodStart=u.date;grant(u.date)}
   }else annual(u.date)
   balance-=u.minutes;annualUsed+=u.minutes;sources.push({...u,kind:'use',balanceMinutes:balance})
  }
  if(first.entitlementDays){if(periodStart&&on>=dayAfter(periodStart,first.entitlementDays)){grant(dayAfter(periodStart,first.entitlementDays));periodStart=null}}
  else annual(on)
 }
 return {staffId,policyId:plan.id,site:plan.site,asOf:on,preset:rule?.preset,label:rule?.label??'Not effective',code:rule?.code,paid:rule?.paid!==false,balanceMinutes:balance,annualAccrued:0,annualUsed,pendingMinutes:s.sickuses.filter(u=>u.staffId===staffId&&u.policyId===plan.id&&u.status==='pending').reduce((n,u)=>n+u.minutes,0),reconciliationRequired:balance<0,periodStart,periodEnd:periodStart&&first.entitlementDays?dayAfter(periodStart,first.entitlementDays):null,sources}
}
export function sickReports(s:State,on:string,staffId?:string){return s.sickpolicies.flatMap(p=>s.staff.filter(w=>!w.erased_at&&(!staffId||w.id===staffId)).map(w=>sickBalance(s,w.id,p,on)).filter(r=>r.sources.some(x=>x.kind!=='carry')||r.pendingMinutes||s.staff.find(w=>w.id===r.staffId)?.site===p.site))}
function useAllowed(c:Context,u:any,minutes:number){
 const plan=get(c.s,'sickpolicies',u.policyId),rule=sickRule(plan,u.date);need(rule,'Leave policy is not effective',409)
 need(c.s.staff.find(w=>w.id===u.staffId)?.site===plan.site||sickWork(c.s,u.staffId,plan.site).some(w=>w.date<=u.date),'No employment or approved work at this location',409)
 const start=cEmploymentStart(c.s,u.staffId)
 need(!rule.wait||start&&u.date>=dayAfter(start,rule.wait),'Waiting period is not complete or employment start date is missing',409)
 need(minutes%rule.increment===0,'Use the policy usage increment',409)
 need(!u.policyRevision||u.policyRevision===rule.revision,'Leave policy changed; reject and resubmit the request',409)
 const balance=sickBalance(c.s,u.staffId,plan,u.date,u.id)
 need(balance.balanceMinutes>=minutes,'Insufficient accrued leave balance',409)
 need(rule.annualUse===null||balance.annualUsed+minutes<=rule.annualUse,'Annual paid-leave use limit exceeded',409)
}
export function sickCommand(c:Context,name:string,p:Record<string,any>){
 if(!name.startsWith('sick'))return
 if(name==='sickpolicy.save'){
  need(c.a.role==='owner','Owner required',403);keys(p,['id','revision','site','from','preset','code','denominator','annualAccrual','bankCap','carry','annualUse','wait','increment','reasons','normalDayMinutes','employeeCount','incomeBand','domesticWorkers','portlandLocation','chainLocations'])
  const site=text(p.site,'cafe',80),bank=p.preset==='NYC_SUPPLEMENTAL'?'supplemental':p.preset==='NY_PRENATAL'?'prenatal':'sick',old=c.s.sickpolicies.find(x=>x.site===site&&(x.bank??'sick')===bank);need(!p.id||old?.id===p.id,'Reload the bank matching this preset',409);if(old){need(p.id===old.id,'Reload the existing policy',409);exact(old,p)}
  const from=date(p.from,'effective date');need(!old||from>old.from,'New versions take effect after the prior version',409)
  const normalDayMinutes=integer(Number(p.normalDayMinutes??480),'longest normal workday minutes',1,1440)
  const preset=sickPreset(p.preset,normalDayMinutes)
  need(preset||p.preset==='employer','Choose a listed preset or employer-configured')
  const cap=(v:any,label:string)=>v===''||v===null||v===undefined?null:integer(Number(v),label,0,60000)
  const custom=preset??{denominator:integer(Number(p.denominator),'worked minutes per leave minute',1,840),annualAccrual:cap(p.annualAccrual,'annual accrual cap'),bankCap:cap(p.bankCap,'bank cap'),carry:cap(p.carry,'carryover cap'),annualUse:cap(p.annualUse,'annual use cap'),wait:integer(Number(p.wait),'waiting days',0,365),increment:integer(Number(p.increment),'usage increment',1,480),reasons:['employer-approved'],source:'Employer configuration',version:'employer',paid:true,label:'Employer-configured, unmaintained'}
  need(!old||(old.paid!==false)===(custom.paid!==false),'An existing bank cannot change between paid and unpaid protection',409)
  const {versions,...prior}:any=old??{}
  return put(c,'sickpolicies',{...custom,coverageFacts:sickCoverage(p.preset,p),preset:p.preset,bank,site,from,code:custom.paid===false?'':text(p.code,'mapped paid-leave code',80),by:c.a.id,at:c.now,versions:old?[...(versions??[]),prior]:[]},old)
 }
 if(name==='sick.request'){
  keys(p,['policyId','start','end','minutes','purpose']);const staffId=self(c.a)!,plan=get(c.s,'sickpolicies',p.policyId),w=window(p,1),on=localDate(w.start,c.s.timezone)
  need(localDate(new Date(Date.parse(w.end)-1).toISOString(),c.s.timezone)===on,'Request one venue date at a time')
  const rule=sickRule(plan,on);need(rule&&(!rule.notBefore||on>=rule.notBefore),'Policy is not effective',409);need(rule.reasons.includes(p.purpose),'Choose a listed permitted reason')
  const minutes=integer(Number(p.minutes),'paid-leave minutes',1,1440);need(minutes<=(Date.parse(w.end)-Date.parse(w.start))/60000,'Paid minutes exceed the absence')
  need(!c.s.leave.some(l=>l.staffId===staffId&&['approved','pending'].includes(l.status)&&overlap(l,w)),'Leave overlaps an existing request',409)
  const facts={staffId,paid:rule.paid!==false,policyId:plan.id,site:plan.site,date:on,...w,minutes,purpose:p.purpose};useAllowed(c,facts,minutes)
  const leave=put(c,'leave',{staffId,...w,reason:rule.paid===false?'Unpaid leave':'Paid leave',status:'pending',requestedBy:c.a.id,requestedAt:c.now})
  return put(c,'sickuses',{...facts,leaveId:leave.id,status:'pending',policyRevision:rule.revision,presetVersion:rule.version,code:rule.code,requestedBy:c.a.id,requestedAt:c.now})
 }
 need(c.a.role==='owner','Only the owner reviews private paid-leave use',403)
 if(name==='sick.decide'){
  keys(p,['id','revision','decision','reference']);const u=get(c.s,'sickuses',p.id);exact(u,p);need(u.status==='pending','Request already decided',409);need(u.staffId!==c.a.staffId&&u.requestedBy!==c.a.id,'You cannot decide your own leave',403);need(['approved','rejected'].includes(p.decision),'Choose approve or reject')
  const leave=get(c.s,'leave',u.leaveId),reference=p.decision==='approved'&&u.paid!==false?text(p.reference,'paid-service source reference',120):''
  if(p.decision==='approved'){
   useAllowed(c,u,u.minutes);need(!c.s.shifts.some(x=>x.staffId===u.staffId&&x.status==='published'&&overlap(x,u)),'Remove the conflicting published shift before approving leave',409)
   if(u.paid!==false){need(!c.s.sickuses.some(x=>x.id!==u.id&&x.reference===reference)&&!c.s.holidaypay.some(x=>x.reference===reference),'Paid-service reference is already used',409)
   const credit=c.s.acaCredits.find(x=>x.reference===reference);need(!credit||credit.staffId===u.staffId&&credit.date===u.date&&credit.minutes===u.minutes,'Paid-service reference conflicts with ACA credit',409)}
  }
  const rate=u.paid===false?{cents:0}:rateAt(c.s,u.staffId,'',u.date);if(p.decision==='approved'&&u.paid!==false)need(rate.cents!==null,'Set the employee rate first',409)
  put(c,'leave',{...leave,status:p.decision,decidedBy:c.a.id,decidedAt:c.now},leave)
  return put(c,'sickuses',{...u,status:p.decision,reference,rateCents:rate.cents,costCents:rate.cents===null?null:Math.round(u.minutes*rate.cents/60),decidedBy:c.a.id,decidedAt:c.now},u)
 }
 if(name==='sick.correct'){
  keys(p,['id','revision','minutes','reason']);const u=get(c.s,'sickuses',p.id);exact(u,p);need(u.status==='approved','Only approved use can be corrected',409);need(u.staffId!==c.a.staffId,'You cannot correct your own leave',403)
  const minutes=integer(Number(p.minutes),'paid minutes',0,1440);need(minutes<=(Date.parse(u.end)-Date.parse(u.start))/60000,'Paid minutes exceed the absence');if(minutes)useAllowed(c,u,minutes)
  const {versions,...prior}=u
  return put(c,'sickuses',{...u,minutes,costCents:Math.round(minutes*u.rateCents/60),versions:[...(versions??[]),prior],correctedBy:c.a.id,correctedAt:c.now,reason:text(p.reason,'correction reason',500)},u)
 }
}
export function sickLines(c:Context){
 return c.s.sickuses.filter(u=>u.status==='approved'&&u.paid!==false&&!heldByPeriod(c.s,u)).map(u=>{const prior=c.s.batches.filter(b=>['exported','acknowledged'].includes(b.status)).flatMap(b=>b.lines).filter((l:any)=>l.sickUseId===u.id),report=sickBalance(c.s,u.staffId,get(c.s,'sickpolicies',u.policyId),u.date)
  return {sickLine:true,sickUseId:u.id,revision:u.revision,staffId:u.staffId,payrollId:c.s.staff.find(p=>p.id===u.staffId)?.payroll_id,start:u.start,end:u.end,minutes:u.minutes-prior.reduce((n:number,l:any)=>n+l.minutes,0),costCents:u.costCents-prior.reduce((n:number,l:any)=>n+l.costCents,0),payCode:u.code,policyId:u.policyId,policyRevision:u.policyRevision,presetVersion:u.presetVersion,balanceMinutes:report.balanceMinutes,sourceReference:u.reference}
 }).filter(l=>l.minutes||l.costCents)
}
export function sickCsv(s:State,on:string){
 const cell=(v:any)=>{const raw=String(v??''),safe=typeof v!=='number'&&/^[\s]*[=+@-]/.test(raw)?"'"+raw:raw;return '"'+safe.replaceAll('"','""')+'"'}
 const lines=[['payroll_id','staff_id','site','as_of','preset','policy_id','balance_minutes','annual_accrued_minutes','annual_used_minutes','pending_minutes','paid','pay_code','source_id','source_revision','source_minutes','credited_minutes']]
 for(const r of sickReports(s,on)){const person=s.staff.find(p=>p.id===r.staffId)!;const base=[person.payroll_id??'',r.staffId,r.site,on,r.preset,r.policyId,r.balanceMinutes,r.annualAccrued,r.annualUsed,r.pendingMinutes,r.paid,r.code];lines.push([...base,'','','',''] as string[]);for(const e of r.sources)lines.push([...base,e.id??'',e.revision??'',e.minutes??'',e.creditedMinutes??''] as string[])}
 return lines.map(l=>l.map(cell).join(',')).join('\r\n')+'\r\n'
}
