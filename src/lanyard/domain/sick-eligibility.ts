import {type State,type Row,type Context,need,keys,text,integer,get,exact,put} from './model'
import {date,dayAfter} from './aca'
import {localDate} from './settings'
import {sickWork,sickRule} from './sick'
import {sickJurisdiction} from './sick-purposes'

// Exclusions require an attributed employer review of the cited jurisdiction,
// never an inference from salary, job title, an app role or a payroll mapping.
const common=['independent-contractor']
export const sickExclusions:Record<string,string[]>={
 CA:[...common,'railroad','aircrew-equivalent-benefit','government-retired-annuitant','qualifying-construction-agreement'],
 CO:[...common,'federal-government','railroad'],
 IL:[...common,'railroad','school-or-park-district','student-employed-by-school','short-term-higher-education','qualifying-construction-or-freight-agreement','express-collective-waiver','existing-local-leave-ordinance'],
 NY:[...common,'government','qualifying-collective-agreement'],
 NYC:[...common,'government','federal-work-study','qualified-scholarship','qualifying-on-call-licensed-professional','work-experience-program','nonemployee-owner','express-comparable-collective-waiver'],
 OR:[...common,'federal-sick-time','assistance-work-training','work-study','railroad','employed-by-parent-spouse-or-child'],
 WA:[...common,'minimum-wage-act-exclusion'],
 // Local coverage can differ from the state floor: a state exemption alone
 // never authorizes turning off a local bank.
 SEATTLE:[...common,'federal-government','qualifying-local-collective-waiver'],
 SF:[...common,'express-local-collective-waiver'],
 LA:[...common,'outside-local-minimum-wage-definition'],
 CHICAGO:[...common,'qualifying-construction-agreement','express-collective-waiver'],
 PHILADELPHIA:[...common,'seasonal','term-under-six-months','adjunct-professor','pool-employee','intern','state-or-federal-government','nonprobationary-collective-agreement'],
}
export const sickClassificationLabel=(value:string)=>value==='covered'?'Covered employee':value==='unresolved'?'Unresolved · human review required':value.split('-').join(' ')
const currentWorker=(rule:Row,staffId:string)=>rule.workerCoverage?.find((w:any)=>w.staffId===staffId&&w.jurisdiction===sickJurisdiction(rule.preset))

function qualifyingDate(s:State,staffId:string,plan:Row,rule:Row,on:string,worker:any){
 const jurisdiction=sickJurisdiction(rule.preset),start=s.employment.find(e=>e.staffId===staffId)?.startDate
 if(!start||on<start)return null
 if(worker?.qualifiedFrom&&worker.qualifiedFrom>=start&&worker.qualifiedFrom<=on)return worker.qualifiedFrom
 const work=sickWork(s,staffId,plan.site).filter(w=>w.date>=start&&w.date<=on).sort((a,b)=>a.date.localeCompare(b.date))
 // These thresholds determine use eligibility. Accrual retains all covered
 // approved work from the start, including the hours that meet the threshold.
 if(['CA','LA'].includes(jurisdiction)){
  const dates=[...new Set(work.map(w=>w.date))]
  for(let i=29;i<dates.length;i++)if(dates[i]<dayAfter(dates[i-29],365))return dates[i]
  return null
 }
 const threshold=jurisdiction==='CHICAGO'?4800:jurisdiction==='PHILADELPHIA'?2400:worker?.occasional&&jurisdiction==='SF'?3360:worker?.occasional&&jurisdiction==='SEATTLE'?14401:0
 if(!threshold)return start
 for(let i=0;i<work.length;i++){
  const from=jurisdiction==='CHICAGO'?dayAfter(work[i].date,-119):work[i].date.slice(0,4)+'-01-01'
  if(work.slice(0,i+1).filter(w=>w.date>=from).reduce((n,w)=>n+w.minutes,0)>=threshold)return work[i].date
 }
 return null
}
export function sickEligibility(s:State,staffId:string,plan:Row,on:string){
 const rule=sickRule(plan,on),person=s.staff.find(p=>p.id===staffId&&!p.erased_at)
 if(!rule||!person)return {status:'unavailable',label:'Policy or employee unavailable',qualifiedFrom:null}
 const worker=currentWorker(rule,staffId)
 // Existing retained policies keep their original covered-core calculation.
 // New maintained versions record the eligibility rules they actually use.
 if(!rule.eligibilityVersion)return {status:'covered',label:'Legacy covered-core assumption; review applicability',qualifiedFrom:null}
 if(worker&&worker.classification!=='covered')return {status:worker.classification==='unresolved'?'unresolved':'excluded',label:worker.classification==='unresolved'?'Employee eligibility needs review':'Employer-reviewed exclusion; no new statutory use',qualifiedFrom:null}
 const start=s.employment.find(e=>e.staffId===staffId)?.startDate
 if(!start||start>on)return {status:'unresolved',label:'Employment start is missing or after this date',qualifiedFrom:null}
 const linked=person.site===plan.site||sickWork(s,staffId,plan.site).some(w=>w.date<=on)||Boolean(worker)
 if(!linked)return {status:'unavailable',label:'No reviewed employment or approved work at this location',qualifiedFrom:null}
 const qualifiedFrom=qualifyingDate(s,staffId,plan,rule,on,worker)
 return {status:qualifiedFrom?'covered':'qualifying',label:qualifiedFrom?'Covered employee; employer applicability review remains required':'Qualifying workplace service not yet established',qualifiedFrom}
}
export function sickWorkCovered(rule:Row,staffId:string){const w=currentWorker(rule,staffId);return !rule.eligibilityVersion||!w||w.classification==='covered'}

export function sickWorkerCommand(c:Context,name:string,p:Record<string,any>){
 if(name!=='sickworker.save')return
 need(c.a.role==='owner','Only the owner reviews private leave eligibility',403)
 keys(p,['id','revision','staffId','from','classification','occasional','qualifiedFrom','legalBasis','evidenceReference','reviewReason'])
 const old=get(c.s,'sickpolicies',p.id);exact(old,p)
 const staffId=text(p.staffId,'person'),person=c.s.staff.find(w=>w.id===staffId&&w.active&&!w.erased_at);need(person,'Active employee required',404)
 const from=date(p.from,'effective date'),jurisdiction=sickJurisdiction(old.preset)
 need(from>=old.from&&from>=localDate(c.now,c.s.timezone),'Eligibility reviews take effect after the current policy and no earlier than today',409)
 need(!c.s.periods.some(r=>['locked','closed'].includes(r.status)&&r.end>=from),'Eligibility review cannot reach locked or closed payroll',409)
 need(!sickWork(c.s,staffId,old.site).some(w=>w.date>=from)&&!c.s.sickuses.some(u=>u.staffId===staffId&&u.policyId===old.id&&u.status==='approved'&&u.date>=from),'Eligibility review cannot rewrite approved work or leave; choose a later effective date',409)
 need(sickExclusions[jurisdiction],'Use the employer policy for an unmaintained jurisdiction')
 const classification=text(p.classification,'classification');need(['covered','unresolved',...sickExclusions[jurisdiction]].includes(classification),'Choose an applicable jurisdiction classification')
 const qualifiedFrom=p.qualifiedFrom?date(p.qualifiedFrom,'qualifying service date'):''
 const start=c.s.employment.find(e=>e.staffId===staffId)?.startDate
 need(!qualifiedFrom||start&&qualifiedFrom>=start&&qualifiedFrom<=from,'Qualifying service date must be within employment and no later than this review')
 need(!qualifiedFrom||classification==='covered','An excluded or unresolved employee cannot receive a qualifying-service override')
 need(p.occasional===undefined||['yes','no'].includes(p.occasional),'Review occasional work')
 need(p.occasional!=='yes'||['SF','SEATTLE'].includes(jurisdiction),'Occasional-work threshold is specific to San Francisco or Seattle')
 const profile={staffId,jurisdiction,classification,occasional:p.occasional==='yes',qualifiedFrom,
  legalBasis:text(p.legalBasis,'applicability legal basis',500),evidenceReference:text(p.evidenceReference,'employer evidence reference',300),reviewReason:text(p.reviewReason,'review reason',500),
  by:c.a.id,at:c.now,staffRevision:person.version,source:old.source,version:old.eligibilityVersion??'2026-10-28'}
 const {versions,...prior}=old
 return put(c,'sickpolicies',{...prior,from,eligibilityVersion:'2026-10-28',workerCoverage:[...(old.workerCoverage??[]).filter((w:any)=>w.staffId!==staffId),profile],by:c.a.id,at:c.now,versions:[...(versions??[]),prior]},old)
}
