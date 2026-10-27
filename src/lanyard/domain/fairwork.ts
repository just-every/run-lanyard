import {type Context,keys,text,integer,need,put,get,exact,work} from './model'
import {localDate} from './settings'
import {fairworkCoverage} from './fairwork-catalog'
const number=(v:unknown,label:string)=>integer(typeof v==='string'?Number(v):v,label,0,10000000)
/** Owner-reviewed applicability and retained consequence previews; no change authorization is granted. */
export function fairworkCommand(c:Context,name:string,p:Record<string,any>){
 if(!name.startsWith('fairwork.'))return undefined
 need(c.a.role==='owner','Owner required for fair-workweek review',403)
 if(name==='fairwork.save'){
  keys(p,['site','revision','preset','industry','employees','locations','localEmployees','subjectToBusinessTax','reason'])
  const site=text(p.site,'site',80),old=c.s.fairworkpolicies.find(r=>r.site===site)
  if(old)exact(old,p)
  const preset=text(p.preset,'jurisdiction',100),industry=text(p.industry,'industry',80),employees=number(p.employees,'worldwide employees'),locations=number(p.locations,'worldwide locations'),localEmployees=number(p.localEmployees,'local employees')
  need(localEmployees<=employees,'Local employees exceed worldwide employees')
  const subjectToBusinessTax=p.subjectToBusinessTax===true||p.subjectToBusinessTax==='on'
  const coverage=fairworkCoverage(preset,industry,employees,locations,localEmployees,subjectToBusinessTax)
  const policy=put(c,'fairworkpolicies',{site,preset,industry,employees,locations,localEmployees,subjectToBusinessTax,...coverage,reason:text(p.reason,'review reason',500),by:c.a.id,at:c.now,versions:old?[...(old.versions??[]),(({versions,...v})=>v)(old)]:[]},old)
  // Restore the prior employer choice when a preset no longer activates the flag.
  const offer=c.s.offerrules.find(r=>r.site===site),activate=Boolean(coverage.covered&&coverage.rule?.accessToHours)
  if(activate||offer?.fairworkPolicyId){
   const priorAccess=offer?.fairworkPolicyId?Boolean(offer.fairworkPriorAccess):Boolean(offer?.accessToHours)
   put(c,'offerrules',{...offer,site,order:offer?.order??'all',accessToHours:activate||priorAccess,fairworkPolicyId:activate?policy.id:null,fairworkPriorAccess:activate?priorAccess:null,savedBy:c.a.id,savedAt:c.now},offer)
  }
  c.entity=policy.id;return policy
 }
 if(name==='fairwork.preview'){
  keys(p,['shiftId','shiftRevision','action','start','end','reason','exception'])
  need(!p.exception,'Exceptions are not authorized by this review; no obligation is waived',409)
  const shift=get(c.s,'shifts',p.shiftId);exact(shift,{revision:number(p.shiftRevision,'shift revision')})
  need(shift.status==='published','Choose a current published shift',409)
  const policy=c.s.fairworkpolicies.find(r=>r.site===shift.site);need(policy,'Review this cafe coverage first',409)
  need(['change','cancel'].includes(p.action),'Choose change or cancel')
  const proposed=p.action==='cancel'?null:work({start:p.start,end:p.end,breakMinutes:shift.breakMinutes})
  need(!proposed||proposed.start!==shift.start||proposed.end!==shift.end,'Change the shift time')
  const rule=policy.covered?policy.rule:null,noticeMinutes=Math.floor((Math.min(Date.parse(shift.start),proposed?Date.parse(proposed.start):Infinity)-Date.parse(c.now))/60000)
  need(noticeMinutes>=0,'Review a change before the shift starts',409)
  const insideNotice=Boolean(rule?.noticeDays&&noticeMinutes<rule.noticeDays*1440)
  const added=proposed?Math.max(0,proposed.minutes-shift.minutes):0,lost=proposed?Math.max(0,shift.minutes-proposed.minutes):shift.minutes
  const neighbors=c.s.shifts.filter(x=>x.status==='published'&&x.staffId===shift.staffId&&x.id!==shift.id)
  const gaps=proposed?neighbors.flatMap(x=>x.end<=proposed.start?[{shiftId:x.id,minutes:(Date.parse(proposed.start)-Date.parse(x.end))/60000}]:proposed.end<=x.start?[{shiftId:x.id,minutes:(Date.parse(x.start)-Date.parse(proposed.end))/60000}]:[]):[]
  const shortRest=rule?.restMinutes?gaps.filter(g=>{const other=neighbors.find(x=>x.id===g.shiftId)!;const first=other.end<=proposed!.start?other:proposed!,second=other.end<=proposed!.start?proposed!:other;return g.minutes<rule.restMinutes&&localDate(first.start,c.s.timezone)!==localDate(second.start,c.s.timezone)}):[]
  // Core employer-requested change only. Statutory exceptions require a separate reviewed implementation.
  const premiumInputs=insideNotice?[...(added>(rule.id==='Oregon'?30:0)||proposed&&proposed.minutes===shift.minutes?[{kind:'change',minutes:60,multiplier:1}]:[]),...(lost>0?[{kind:'lost-hours',minutes:lost,multiplier:0.5}]:[])]:[]
  const record=put(c,'fairworkreviews',{staffId:shift.staffId,site:shift.site,policyId:policy.id,policyRevision:policy.revision,policy:{...policy,versions:undefined},shiftId:shift.id,shiftRevision:shift.revision,before:{start:shift.start,end:shift.end,minutes:shift.minutes},proposed,action:p.action,insideNotice,noticeMinutes,consentRequired:Boolean(rule&&(insideNotice&&proposed||shortRest.length)),shortRest,premiumInputs,postings:c.s.postings.filter(r=>r.rosterId===shift.rosterId).map(r=>({id:r.id,revision:r.revision,postedAt:r.postedAt})),reason:text(p.reason,'review reason',500),by:c.a.id,at:c.now,status:'review-only',boundary:'Preview only. Employee consent, change enforcement, rest pay and payroll transfer remain unimplemented.'})
  return record
 }
 return undefined
}
