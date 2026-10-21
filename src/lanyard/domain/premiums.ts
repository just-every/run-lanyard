// PAYRULE-003: retained employer-reviewed inputs; amounts are not certified payroll.
import {type State,type Context,type Row,canonical,need} from './model'
import {priced} from './workforce'
import {localDate,instantAt} from './settings'
import {dayAfter} from './aca'
import {heldByPeriod} from './periods'

export const premiumSources={CA:['https://www.dir.ca.gov/dlse/faq_reportingtimepay.htm','https://www.dir.ca.gov/dlse/split_shift.htm'],'NY-hospitality':['https://forms.labor.ny.gov/WP/CR146.pdf']}
export const premiumRule=(s:State,site:string,on:string)=>s.premiumrules.filter(r=>r.site===site&&r.from<=on).sort((a,b)=>a.from.localeCompare(b.from)).at(-1)
const siteOf=(s:State,t:any)=>t.site||s.staff.find(p=>p.id===t.staffId)?.site||''
const history=(r:Row)=>[...(r.versions??[]),r]
export const premiumRecords=(s:State)=>s.premiuminputs.filter(r=>!s.premiuminputs.some(x=>x.replacesId===r.id))
const exported=(s:State)=>s.batches.filter(b=>['exported','acknowledged'].includes(b.status)).flatMap(b=>b.lines).filter((l:any)=>l.premiumLine)

/** Read the approval's date and area allocation verbatim. Never resplit actual work. */
function pieces(s:State,t:Row) {
 const segments=t.workSegments?.length?t.workSegments:[{...t,rateBasis:priced(s,t.staffId,t)}]
 return segments.flatMap((w:any)=>w.rateBasis.segments.map((p:any)=>({timeId:t.id,timeRevision:t.revision,rootId:t.rootId,job:w.job??'',area:w.area,site:siteOf(s,w),date:p.date,minutes:p.minutes,rateCents:p.cents,rateBasis:w.rateBasis,start:w.start,end:w.end})))
}
function sourceRows(s:State,r:any) {
 if(!r.timeId)return []
 if(r.kind==='reporting')return s.timesheets.filter(t=>t.id===r.timeId||t.corrects===r.timeId)
 const start=instantAt(r.date,'00:00',s.timezone),end=instantAt(dayAfter(r.date),'00:00',s.timezone)
 return s.timesheets.filter(t=>t.staffId===r.staffId&&t.status!=='superseded'&&t.start<end&&t.end>start&&(siteOf(s,t)===r.site||t.workSegments?.some((w:any)=>siteOf(s,w)===r.site)))
}
/** Revisions, pending corrections, punches and reporting-shift edits fence every decision/export. */
export function premiumFingerprint(s:State,r:any) {
 const rows=sourceRows(s,r),shift=r.shiftId?s.shifts.find(x=>x.id===r.shiftId):undefined
 const start=r.timeId?(r.kind==='reporting'?s.timesheets.find(t=>t.id===r.timeId)?.start:instantAt(r.date,'00:00',s.timezone)):shift?.start
 const end=r.timeId?(r.kind==='reporting'?s.timesheets.find(t=>t.id===r.timeId)?.end:instantAt(dayAfter(r.date),'00:00',s.timezone)):shift?.end
 const clocks=s.clocks.filter(k=>k.staffId===r.staffId&&start&&end&&k.start<end&&(k.end??'9999')>start&&(!r.timeId||k.status==='open'))
 return canonical({anchor:r.timeId?s.timesheets.filter(t=>t.id===r.timeId).map(t=>[t.id,t.revision,t.status]):[],rows:rows.map(t=>({id:t.id,revision:t.revision,status:t.status,start:t.start,end:t.end,minutes:t.minutes,breakMinutes:t.breakMinutes,job:t.job,site:t.site,workSegments:t.workSegments,rateBasis:t.rateBasis})).sort((a,b)=>a.id.localeCompare(b.id)),shift:shift?{id:shift.id,revision:shift.revision,status:shift.status,staffId:shift.staffId,start:shift.start,end:shift.end,minutes:shift.minutes}:null,clocks:clocks.map(k=>({id:k.id,revision:k.revision,status:k.status,start:k.start,end:k.end})).sort((a,b)=>a.id.localeCompare(b.id)),arrivalWork:!r.timeId&&shift?s.timesheets.filter(t=>t.staffId===r.staffId&&t.status!=='superseded'&&t.start<shift.end&&t.end>shift.start).map(t=>[t.id,t.revision,t.status]):[]})
}
export function premiumCurrent(s:State,r:Row) {return premiumRecords(s).some(x=>x.id===r.id)&&r.sourceDigest===premiumFingerprint(s,r)}

/** Retain the rule and rates from an earlier approved review on a corrected lineage. */
export function previousPremium(s:State,t:Row|undefined,kind:string,old?:Row) {
 const candidates=s.premiuminputs.flatMap(history).filter(r=>r.status==='approved'&&r.kind===kind&&((old&&r.id===old.id)||(t&&(r.rootId===t.rootId||r.facts?.pieces?.some((p:any)=>p.rootId===t.rootId)))))
 return candidates.sort((a,b)=>(a.decidedAt??a.at).localeCompare(b.decidedAt??b.at)).at(-1)
}
export function premiumFacts(s:State,r:any,t:Row|undefined,shift:Row|undefined,rule:Row,prior?:Row) {
 const rows=sourceRows(s,r)
 need(rows.every(t=>t.status==='approved'),'Approve all source time and corrections before reviewing a premium',409)
 const dayStart=instantAt(r.date,'00:00',s.timezone),dayEnd=instantAt(dayAfter(r.date),'00:00',s.timezone)
 need(!s.clocks.some(k=>k.staffId===r.staffId&&k.status==='open'&&k.start<(r.kind==='reporting'?t?.end??shift?.end:dayEnd)&&(k.end??'9999')>(r.kind==='reporting'?t?.start??shift?.start:dayStart)),'A source punch is still open',409)
 let parts=rows.flatMap(x=>pieces(s,x)).filter(p=>p.site===r.site&&(r.kind==='reporting'||p.date===r.date))
 if(prior)parts=parts.map(p=>{if(!prior.facts.pieces.some((x:any)=>x.rootId===p.rootId))return p;const retained=prior.facts.pieces.find((x:any)=>x.rootId===p.rootId&&x.job===p.job&&x.area===p.area&&x.site===p.site&&x.date===p.date)??prior.facts.pieces.find((x:any)=>x.rootId===p.rootId&&x.job===p.job&&x.area===p.area&&x.site===p.site);need(retained,'Corrected premium has no retained rate for this job/area',409);return {...p,rateCents:retained.rateCents,rateBasis:retained.rateBasis}})
 const workedMinutes=parts.reduce((n,p)=>n+p.minutes,0),workedCostCents=parts.reduce((n,p)=>{need(typeof p.rateCents==='number','Set and approve the source job rate before reviewing premiums',409);return n+Math.round(p.minutes*p.rateCents/60)},0)
 if(!t&&shift){need(!s.timesheets.some(x=>x.staffId===r.staffId&&x.status!=='superseded'&&x.start<shift.end&&x.end>shift.start),'Recorded or pending work exists for this arrival',409);need(!s.clocks.some(k=>k.staffId===r.staffId&&k.start<shift.end&&(k.end??'9999')>shift.start),'A recorded punch exists for this arrival',409)
  const basis=prior?.facts.arrivalBasis??priced(s,r.staffId,shift),scheduled=basis.workSegments?.length?basis.workSegments:[{...shift,rateBasis:basis}]
  parts=scheduled.flatMap((w:any)=>w.rateBasis.segments.map((p:any)=>({timeId:null,timeRevision:null,rootId:null,job:w.job??'',area:w.area,site:r.site,date:r.date,minutes:0,weight:p.minutes,rateCents:p.cents,rateBasis:w.rateBasis,start:r.reportedAt,end:r.reportedAt})))
 }
 const starts=parts.map(x=>x.start),ends=parts.map(x=>x.end),elapsedMinutes=t&&parts.length?Math.floor((Math.min(Date.parse(dayEnd),Math.max(...ends.map(Date.parse)))-Math.max(Date.parse(dayStart),Math.min(...starts.map(Date.parse))))/60000):0
 const separate=rows.some((x,i)=>rows.some((y,j)=>j!==i&&x.end<y.start)),unpaid=rows.some(x=>x.breakMinutes>0)
 let minutes=0,costCents=0
 if(r.kind==='reporting'){
  need(shift,'Reporting pay needs its published source shift',409)
  const guarantee=rule.preset==='CA'?Math.max(120,Math.min(240,Math.ceil(shift.minutes/2))):rule.preset==='NY-hospitality'?(r.regularlyScheduled?Math.min(180,shift.minutes):180):rule.reportingGuaranteeMinutes
  minutes=rule.preset==='CA'&&workedMinutes*2>=shift.minutes?0:Math.max(0,guarantee-workedMinutes)
 } else if(r.kind==='split'){
  need(rule.preset!=='NY-hospitality','The New York hospitality preset does not supply split-shift pay')
  if(r.employerSplit&&!r.mealOrRest&&!r.voluntary&&!r.resident&&(separate||unpaid)){minutes=rule.preset==='CA'?60:rule.splitMinutes;costCents=Math.max(0,Math.round((workedMinutes+minutes)*rule.minimumCents/60)-workedCostCents);if(!costCents)minutes=0}
 } else {
  need(rule.preset!=='CA','The California preset does not supply spread-of-hours pay')
  if(elapsedMinutes>(rule.preset==='NY-hospitality'?600:rule.spreadThresholdMinutes))minutes=rule.preset==='NY-hospitality'?60:rule.spreadMinutes
 }
 parts=parts.filter(p=>p.minutes>0||p.weight>0)
 const weights=parts.map(p=>p.minutes||p.weight||0),total=weights.reduce((n,v)=>n+v,0);need(total>0||prior&&r.kind!=='reporting'&&minutes===0&&costCents===0,'The source has no payable allocation basis',409)
 let leftMinutes=minutes,leftCents=costCents
 const allocations=parts.map((p,i)=>{const last=i===parts.length-1,m=last?leftMinutes:Math.floor(minutes*weights[i]/total);leftMinutes-=m
  if(r.kind==='reporting'&&rule.preset==='CA')need(typeof p.rateCents==='number','Reporting pay needs its retained job rate',409)
  const cents=r.kind==='split'?(last?leftCents:Math.floor(costCents*weights[i]/total)):Math.round(m*(rule.preset==='CA'?Math.max(p.rateCents,rule.minimumCents):rule.minimumCents)/60);leftCents-=cents
  need(Number.isSafeInteger(cents)&&cents>=0,'Premium needs the retained job rate',409)
  return {...p,workedMinutes:p.minutes,minutes:m,costCents:cents,unitCents:r.kind==='reporting'&&rule.preset==='CA'?Math.max(p.rateCents,rule.minimumCents):rule.minimumCents,code:rule.codes[r.kind]}
 })
 costCents=allocations.reduce((n,p)=>n+p.costCents,0)
 return {workedMinutes,workedCostCents,elapsedMinutes,scheduledMinutes:shift?.minutes??null,separateShifts:separate,unpaidInterval:unpaid,pieces:parts,sources:rows.map(x=>({id:x.id,revision:x.revision,rootId:x.rootId,start:x.start,end:x.end,minutes:x.minutes,workSegments:x.workSegments,rateBasis:x.rateBasis})),arrivalBasis:!t&&shift?(prior?.facts.arrivalBasis??priced(s,r.staffId,shift)):null,allocationBasis:t?'approved payable minutes':'scheduled allocation; zero minutes worked',minutes,costCents,allocations}
}

const lineKey=(l:any)=>canonical([l.kind==='reporting'?l.rootId:l.staffId,l.job??'',l.area??'',l.site,l.date,l.kind,l.payCode??l.code])
export function premiumLines(c:Context,t:Row,base:Record<string,any>) {
 const records=premiumRecords(c.s).filter(r=>r.timeId&&(r.rootId===t.rootId||r.facts.sources.some((x:any)=>x.rootId===t.rootId)))
 for(const r of records)need(premiumCurrent(c.s,r),'Premium source changed; prepare and approve a fresh review before payroll',409)
 const reportingPrior=exported(c.s).filter((l:any)=>l.rootId===t.rootId&&l.kind==='reporting'&&!l.arrivalPremiumId)
 for(const l of reportingPrior)need(records.some(r=>r.kind===l.kind&&r.status==='approved'&&r.timeId===t.id&&r.timeRevision===t.revision),'A corrected timesheet needs a fresh approved premium review',409)
 need(!records.some(r=>r.status==='prepared'),'Decide the prepared premium input before payroll',409)
 const anchors=records.filter(r=>r.status==='approved'&&r.timeId===t.id&&r.timeRevision===t.revision)
 const prior=[...reportingPrior,...exported(c.s).filter((l:any)=>l.kind!=='reporting'&&anchors.some(r=>r.kind===l.kind&&r.staffId===l.staffId&&r.site===l.site&&r.date===l.date))]
 const grouped=new Map<string,any>()
 for(const r of anchors)for(const a of r.facts.allocations){
  const line={...a,...base,timeId:t.id,revision:t.revision,rootId:t.rootId,staffId:r.staffId,kind:r.kind,date:r.date,premiumLine:true,premiumInputId:r.id,premiumRevision:r.revision,payCode:r.code,ruleId:r.rule.id,ruleRevision:r.rule.revision,trace:{rule:r.rule,facts:r.facts,sources:r.facts.sources,sourceDigest:r.sourceDigest,reason:r.reason},sourceStart:a.start,sourceEnd:a.end};const k=lineKey(line),old=grouped.get(k)
  grouped.set(k,{...line,minutes:(old?.minutes??0)+a.minutes,costCents:(old?.costCents??0)+a.costCents})
 }
 for(const l of prior){const k=lineKey(l),old=grouped.get(k);grouped.set(k,{...l,...base,...old,timeId:t.id,revision:t.revision,rootId:t.rootId,minutes:(old?.minutes??0)-l.minutes,costCents:(old?.costCents??0)-l.costCents})}
 return [...grouped.values()].filter(l=>l.minutes!==0||l.costCents!==0)
}
export function arrivalLines(c:Context) {
 return premiumRecords(c.s).filter(r=>!r.timeId&&r.status==='approved').flatMap(r=>{
  need(premiumCurrent(c.s,r),'Arrival facts changed; review the arrival premium again before payroll',409)
  const previous=exported(c.s).filter((l:any)=>l.arrivalPremiumId===r.id)
  return r.facts.allocations.map((a:any)=>{const old=previous.filter((l:any)=>lineKey(l)===lineKey({...a,rootId:null,kind:r.kind,date:r.date,payCode:r.code}));return {...a,rootId:null,staffId:r.staffId,revision:r.revision,timeId:null,start:r.reportedAt,end:r.reportedAt,sourceStart:r.reportedAt,sourceEnd:r.reportedAt,date:r.date,kind:r.kind,minutes:a.minutes-old.reduce((n:number,l:any)=>n+l.minutes,0),costCents:a.costCents-old.reduce((n:number,l:any)=>n+l.costCents,0),payCode:r.code,payrollId:c.s.staff.find(p=>p.id===r.staffId)?.payroll_id,premiumLine:true,premiumInputId:r.id,premiumRevision:r.revision,arrivalPremiumId:r.id,ruleId:r.rule.id,ruleRevision:r.rule.revision,trace:{rule:r.rule,facts:r.facts,sources:r.facts.sources,sourceDigest:r.sourceDigest,reportedAt:r.reportedAt,canceledAt:r.canceledAt,reason:r.reason}}})
 }).filter(l=>(l.minutes!==0||l.costCents!==0)&&!heldByPeriod(c.s,l as Row))
}
export function premiumReviews(s:State) {return premiumRecords(s).map(r=>({...r,current:premiumCurrent(s,r),name:s.staff.find(p=>p.id===r.staffId)?.name}))}
export function premiumEstimate(s:State,staffId:string,startDate:string,endDate:string) {
 const records=premiumRecords(s).filter(r=>r.staffId===staffId&&r.date>=startDate&&r.date<=endDate&&r.status==='approved'&&(typeof r.current==='boolean'?r.current:premiumCurrent(s,r)))
 return {costCents:records.reduce((n,r)=>n+r.costCents,0),minutes:records.reduce((n,r)=>n+r.minutes,0),facts:records}
}
