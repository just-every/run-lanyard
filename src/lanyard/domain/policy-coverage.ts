import {type Context,type State,type Row,keys,text,need,exact,put,canonical} from './model'
import {date} from './aca'
import {releasePreview} from './policy-release'

export const coverageKinds=['federalOvertime','stateWeekly','stateDaily','stateConsecutive','stateSeventh','meal','rest','weeklyRest'] as const
export type CoverageKind=typeof coverageKinds[number]
export const coverageLabels:Record<CoverageKind,string>={federalOvertime:'Federal weekly overtime',stateWeekly:'State weekly overtime',stateDaily:'State daily overtime and double time',stateConsecutive:'State consecutive-hours overtime',stateSeventh:'State seventh-day overtime',meal:'Meal periods',rest:'Paid rest periods',weeklyRest:'Weekly day of rest'}
export function workerCoverage(rule:Row|undefined,staffId:string){return rule?.coverage?.find((r:any)=>r.staffId===staffId&&r.preset===rule.preset)}
export function covered(rule:Row|undefined,staffId:string,kind:CoverageKind){return workerCoverage(rule,staffId)?.[kind]!=='reviewed-not-applicable'}

/** Exemption is an explicit, attributed employer decision for each rule family.
 * Salary, role, title and contractor mapping never establish applicability. */
export async function policyWorkerCommand(c:Context,name:string,p:Record<string,any>){
 if(!['policy.worker.preview','policy.worker.save'].includes(name))return
 need(c.a.role==='owner','Only the owner maintains reviewed worker policy inputs',403)
 keys(p,['id','revision','site','from','staffId','legalBasis','evidenceReference','reviewReason','reviewDigest',...coverageKinds])
 const old=c.s.policies.find(r=>r.site===p.site);need(old,'Configure the cafe policy first',404)
 need(p.id===old.id,'Reload the cafe policy',409);exact(old,p)
 const from=date(p.from,'effective date');need(from>=old.from,'Worker policy review cannot precede the current site policy',409)
 need(!c.s.periods.some(r=>['locked','closed'].includes(r.status)&&r.end>=from),'Worker policy changes cannot reach locked or closed payroll',409)
 const staffId=text(p.staffId,'person'),person=c.s.staff.find(r=>r.id===staffId&&r.active&&!r.erased_at);need(person,'Active staff required',404)
 const status=Object.fromEntries(coverageKinds.map(k=>{need(['covered','reviewed-not-applicable'].includes(p[k]),'Review every rule family explicitly');return [k,p[k]]}))
 const hasExemption=coverageKinds.some(k=>status[k]==='reviewed-not-applicable')
 const legalBasis=text(p.legalBasis,'applicability legal basis',500,!hasExemption),evidenceReference=text(p.evidenceReference,'employer evidence reference',300,!hasExemption),reviewReason=text(p.reviewReason,'review reason',500)
 const profile={staffId,preset:old.preset,...status,legalBasis,evidenceReference,reviewReason,by:c.a.id,staffRevision:person.version,label:'Employer-reviewed applicability; Lanyard does not determine legal exemption'}
 const {versions,...prior}=old
 const candidate={...prior,from,coverage:[...(old.coverage??[]).filter((r:any)=>r.staffId!==staffId),profile].sort((a,b)=>a.staffId.localeCompare(b.staffId)),reviewReason,by:c.a.id,at:c.now,versions:[...(versions??[]),prior]}
 const review=await releasePreview(c.s,candidate,old)
 if(name==='policy.worker.preview')return {...review,worker:profile}
 need(p.reviewDigest===review.digest,'Review current worker applicability and affected open periods before applying',409)
 candidate.coverage=candidate.coverage.map(r=>r.staffId===staffId?{...r,at:c.now}:r)
 return put(c,'policies',{...candidate,releaseReview:{...review,reason:reviewReason,by:c.a.id,at:c.now}},old)
}

/** Mixed applicability requires a separate employer review. It never silently
 * turns off another site's protection or supplies a definitive payroll amount. */
export function coverageReview(s:State,staffId:string,parts:any[],ruleOn:(site:string,on:string)=>Row|undefined){
 const entries=parts.map(p=>{const rule=ruleOn(p.site,p.date),profile=workerCoverage(rule,staffId);return {site:p.site,date:p.date,policyId:rule?.id,policyRevision:rule?.revision,preset:rule?.preset,profile}})
 const issues:string[]=[]
 if(parts.some(p=>{const r=ruleOn(p.site,p.date);return r?.coverage?.some((v:any)=>v.staffId===staffId&&v.preset!==r.preset)}))issues.push('Retained applicability evidence belongs to another preset; review the current jurisdiction')
 for(const kind of coverageKinds.slice(0,5))if(new Set(entries.map(e=>e.profile?.[kind]??'covered')).size>1)issues.push(`${coverageLabels[kind]} applicability differs within this workweek; review all sites and effective dates`)
 if(entries.some(e=>e.preset==='NY'&&e.profile?.federalOvertime==='reviewed-not-applicable'&&e.profile?.stateWeekly!=='reviewed-not-applicable'))issues.push('New York state overtime for federally exempt work requires reviewed minimum-wage treatment')
 const unique=new Map(entries.filter(e=>e.profile).map(e=>[canonical([e.policyId,e.policyRevision,e.profile]),e]))
 return {issues,inputs:[...unique.values()],label:entries.some(e=>!e.profile)?'No worker-specific exemption decision: covered core calculation assumption':'Explicit employer-reviewed applicability; legal eligibility remains the employer’s responsibility'}
}
