// PAYRULE-003 commands use the existing owner/home-cafe-manager scope, never self.
import {type Context,type Row,keys,text,need,integer,get,exact,put,instant} from './model'
import {date} from './aca'
import {localDate} from './settings'
import {premiumRule,premiumSources,premiumFacts,premiumCurrent,premiumFingerprint,premiumRecords,previousPremium} from './premiums'
const bool=(v:any)=>v===true||v==='true'||v==='on'
const version=(r:Row)=>{const {versions,...v}=r;return v}
function scope(c:Context,site:string,staffId:string) {need(c.a.role==='owner'||c.a.role==='manager'&&c.s.staff.find(p=>p.id===c.a.staffId)?.site===site,'Only the owner or a manager of this cafe',403);need(c.a.staffId!==staffId,'You cannot review your own premium input',403)}
export function premiumCommand(c:Context,name:string,p:Record<string,any>) {
 if(!['premiumrule.save','premium.prepare','premium.decide'].includes(name))return undefined
 p={...p};for(const k of ['id','timeId','shiftId','staffId','reviewDate','reportedAt','canceledAt'])if(p[k]==='')delete p[k]
 for(const k of ['employerSplit','regularlyScheduled','mealOrRest','voluntary','resident'])need(p[k]===undefined||[true,false,'true','false','on',''].includes(p[k]),`Invalid ${k}`)
 if(name==='premiumrule.save'){
  need(c.a.role==='owner','Only the payroll administrator (the owner) can do this',403)
  keys(p,['id','revision','site','from','preset','minimumCents','codes','reportingGuaranteeMinutes','splitMinutes','spreadMinutes','spreadThresholdMinutes'])
  const old=p.id?get(c.s,'premiumrules',p.id):undefined;if(old)exact(old,p)
  const site=text(p.site,'site',80,true),from=date(p.from,'effective date');need(['CA','NY-hospitality','employer'].includes(p.preset),'Choose a supported premium preset or employer rule')
  need(!c.s.premiumrules.some(r=>r.id!==old?.id&&r.site===site&&r.from===from),'A premium rule already starts on this site/date',409)
  const codes=p.codes??{};need(codes&&typeof codes==='object'&&!Array.isArray(codes),'Provide premium pay codes');keys(codes,['reporting','split','spread'])
  const defaults={reporting:p.preset==='NY-hospitality'?'call-in premium':'reporting premium',split:'split shift premium',spread:'spread of hours premium'}
  const custom=p.preset==='employer'?{reportingGuaranteeMinutes:integer(Number(p.reportingGuaranteeMinutes),'reporting guarantee minutes',0,1440),splitMinutes:integer(Number(p.splitMinutes),'split premium minutes',0,1440),spreadMinutes:integer(Number(p.spreadMinutes),'spread premium minutes',0,1440),spreadThresholdMinutes:integer(Number(p.spreadThresholdMinutes),'spread threshold minutes',1,2880)}:{}
  return put(c,'premiumrules',{site,from,preset:p.preset,minimumCents:integer(Number(p.minimumCents),'minimum USD cents per hour',1,999999),codes:Object.fromEntries(Object.keys(defaults).map(k=>[k,text(codes[k]??defaults[k as keyof typeof defaults],'pay code',80)])),...custom,maintained:p.preset!=='employer',label:p.preset==='employer'?'Employer-configured, unmaintained':'Employer-reviewed premium input',sources:p.preset==='employer'?[]:premiumSources[p.preset as keyof typeof premiumSources],sourceVersion:'2026-10-21',by:c.a.id,at:c.now,versions:old?[...(old.versions??[]),version(old)]:[]},old)
 }
 if(name==='premium.decide'){
  keys(p,['id','revision','decision','reason']);const r=get(c.s,'premiuminputs',p.id);exact(r,p);scope(c,r.site,r.staffId)
  need(['prepared','disputed'].includes(r.status),'Prepare a new exact premium review before deciding',409);need(premiumCurrent(c.s,r),'Premium sources changed; prepare the review again',409);need(['approve','dispute'].includes(p.decision),'Choose approve or dispute')
  const reason=text(p.reason,'decision reason',500)
  return put(c,'premiuminputs',{...r,status:p.decision==='approve'?'approved':'disputed',decidedBy:c.a.id,decidedAt:c.now,decision:{by:c.a.id,at:c.now,action:p.decision,reason},decisionReason:reason,versions:[...(r.versions??[]),version(r)]},r)
 }
 keys(p,['id','revision','timeId','shiftId','staffId','kind','reviewDate','reportedAt','canceledAt','employerSplit','regularlyScheduled','mealOrRest','voluntary','resident','reason'])
 need(['reporting','split','spread'].includes(p.kind),'Choose reporting, split or spread')
 const old=p.id?get(c.s,'premiuminputs',p.id):undefined;if(old)exact(old,p)
 const t=p.timeId?get(c.s,'timesheets',p.timeId):undefined;need(!t||t.status==='approved','Approve source time before preparing a premium',409)
 let shift=p.shiftId?get(c.s,'shifts',p.shiftId):undefined
 if(t&&p.kind==='reporting'&&!shift)shift=c.s.shifts.find(x=>x.staffId===t.staffId&&x.status==='published'&&x.start<t.end&&x.end>t.start)
 const staffId=t?.staffId??shift?.staffId;need(staffId,'Choose approved time or a published arrival shift');need(p.staffId===undefined||p.staffId===staffId,'Premium employee must match its source')
 const site=t?.site||shift?.site||c.s.staff.find(x=>x.id===staffId)?.site||'',on=p.reviewDate?date(p.reviewDate,'premium review date'):localDate(t?.start??shift!.start,c.s.timezone);scope(c,site,staffId)
 need(c.s.staff.some(x=>x.id===staffId&&x.active&&!x.erased_at),'Active staff required')
 need(!old||old.staffId===staffId&&old.kind===p.kind&&Boolean(old.timeId)===Boolean(t),'A review must retain its employee, premium kind and worked/arrival source type',409)
 need(!old||(t?old.rootId===t.rootId:!old.timeId&&old.shiftId===shift?.id),'A review must retain its source timesheet lineage or arrival shift',409)
 if(p.kind==='reporting'){need(shift&&shift.status==='published'&&shift.staffId===staffId,'Reporting pay needs the employee’s published shift',409);need(!t||shift.start<t.end&&shift.end>t.start,'Source shift must overlap the approved work',409);need(!t?.site||t.site===(shift.site||site),'Reporting work and shift must be at the same cafe',409)}
 else need(t,'Split and spread premiums require approved actual work',409)
 let reportedAt:string|undefined,canceledAt:string|undefined
 if(!t){need(p.kind==='reporting','Only reporting pay can record a zero-work arrival');reportedAt=instant(p.reportedAt,'reported at');canceledAt=instant(p.canceledAt,'canceled at');need(reportedAt>=shift!.start&&reportedAt<shift!.end&&reportedAt<=canceledAt&&canceledAt<=c.now,'Record an actual arrival at the shift and a cancellation after arrival, no later than now')}
 else need(p.reportedAt===undefined&&p.canceledAt===undefined,'Arrival timestamps are only for zero-work reporting')
 const candidate={staffId,site,date:on,timeId:t?.id??null,timeRevision:t?.revision??null,rootId:t?.rootId??null,shiftId:shift?.id??null,shiftRevision:shift?.revision??null,kind:p.kind,reportedAt:reportedAt??null,canceledAt:canceledAt??null,employerSplit:bool(p.employerSplit),regularlyScheduled:bool(p.regularlyScheduled),mealOrRest:bool(p.mealOrRest),voluntary:bool(p.voluntary),resident:bool(p.resident)}
 const duplicate=premiumRecords(c.s).find(r=>r.id!==old?.id&&r.staffId===staffId&&r.kind===p.kind&&(p.kind==='reporting'?(t?r.rootId===t.rootId:r.shiftId===shift!.id):r.site===site&&r.date===on))
 need(!duplicate||!premiumCurrent(c.s,duplicate),'This source already has a premium review; use its exact revision',409)
 if(t)need(!c.s.claims.some(x=>x.time_id===t.id&&x.time_revision===t.revision),'Correct the exported timesheet before adding or changing a premium',409)
 const prior=previousPremium(c.s,t,p.kind,old??duplicate),rule=prior?.rule??premiumRule(c.s,site,on);need(rule,'Configure an effective premium rule for this cafe/date',409)
 const facts=premiumFacts(c.s,candidate,t,shift,rule,prior),sourceDigest=premiumFingerprint(c.s,candidate)
 return put(c,'premiuminputs',{...candidate,status:'prepared',reason:text(p.reason,'premium reason',500),rule,code:rule.codes[p.kind],facts,allocations:facts.allocations,minutes:facts.minutes,costCents:facts.costCents,sourceDigest,replacesId:old?.replacesId??duplicate?.id??null,preparedBy:c.a.id,at:c.now,versions:old?[...(old.versions??[]),version(old)]:[]},old)
}
