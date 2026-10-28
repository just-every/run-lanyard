import {type Context,type State,type Row,type Kind,need,keys,text,get,exact,put} from './model'
import {date} from './aca'

/** Maintained minimums are review inputs, never automatic deletion authority. */
export const recordPresets=[
 {id:'federal-payroll',years:3,recordClass:'payroll',anchor:'last entry',source:'https://www.dol.gov/agencies/whd/fact-sheets/21-flsa-recordkeeping'},
 {id:'federal-wage-computation',years:2,recordClass:'time cards and schedules',anchor:'last entry',source:'https://www.dol.gov/agencies/whd/fact-sheets/21-flsa-recordkeeping'},
 {id:'chicago-fair-workweek',years:3,recordClass:'fair-workweek records',anchor:'record date',source:'https://codelibrary.amlegal.com/codes/chicago/latest/chicago_il/0-0-0-2640045'},
 {id:'chicago-paid-leave',years:5,recordClass:'paid-leave records and supporting facts',anchor:'record date',source:'https://codelibrary.amlegal.com/codes/chicago/latest/chicago_il/0-0-0-2700758'},
 {id:'california-hours-wages',years:3,recordClass:'hours and wage records',anchor:'last entry or later employment end',source:'https://www.dir.ca.gov/dlse/California_Equal_Pay_Act.htm'},
 {id:'california-sick-leave',years:3,recordClass:'sick-leave accrual and use',anchor:'record date',source:'https://dir.ca.gov/dlse/paid_sick_leave.htm'},
].map(p=>({...p,effectiveDate:'2026-10-27',applicability:'Owner review required; longer employment-duration, jurisdictional and other duties remain controlling'}))
const sourceKinds:Kind[]=['timesheets','shifts','rosters','batches','sickuses','sickpolicies','fairworkreviews','auditpackets']
const anniversary=(on:string,years:number)=>{const d=new Date(on+'T00:00:00Z');d.setUTCFullYear(d.getUTCFullYear()+years);return d.toISOString().slice(0,10)}
function source(s:State,kind:unknown,id:unknown){need(sourceKinds.includes(kind as Kind),'Unsupported record class');return get(s,kind as Kind,id)}
export function auditReferences(packet:Row){return packet.sourceRefs??[...new Map(packet.report.rows.flatMap((r:any)=>[{kind:r.sourceKind,id:r.sourceId,staffId:r.staffId},...(r.facts.previousSource?[{kind:r.facts.previousSource.kind,id:r.facts.previousSource.id,staffId:r.staffId}]:[]),...(r.facts.sources??[]).map((ref:any)=>({kind:'timesheets',id:ref.id,staffId:r.staffId}))]).map((r:any)=>[r.kind+':'+r.id,r])).values()] as {kind:string;id:string;staffId:string}[]}
export function recordReview(s:State,kind:string,record:Row,now:string){
 const refs=kind==='auditpackets'?[{kind,id:record.id,staffId:''},...auditReferences(record)]:[{kind,id:record.id,staffId:record.staffId??''}]
 const obligations=refs.flatMap(ref=>s.recordduties.filter(d=>d.sourceKind===ref.kind&&d.sourceId===ref.id))
 const unresolved=refs.filter(ref=>!obligations.some(d=>d.sourceKind===ref.kind&&d.sourceId===ref.id)).map(ref=>({sourceKind:ref.kind,sourceId:ref.id,reason:'Applicability has not been reviewed'}))
 for(const d of obligations)if(d.applicability==='unknown')unresolved.push({sourceKind:d.sourceKind,sourceId:d.sourceId,reason:'Unknown applicability cannot authorize disposition'})
 const dates=obligations.filter(d=>d.applicability==='applies').map(d=>d.retainThrough).sort()
 const retainThrough=dates.at(-1)??null,people=new Set(refs.map(ref=>ref.staffId).filter(Boolean))
 const holds=s.privacyholds.filter(h=>h.hold&&h.type==='history'&&people.has(h.staffId)).map(h=>({id:h.id,caseId:h.caseId??'',staffId:h.staffId,reason:h.reason}))
 return {sourceKind:kind,sourceId:record.id,sourceRevision:record.revision,obligations,retainThrough,unresolved,holds,reviewDue:!unresolved.length&&!holds.length&&retainThrough!==null&&now.slice(0,10)>retainThrough,dispositionSupported:false,boundary:'Review only. No source or retained copy is erased. Separate eligible disposition, complete legal applicability, external copies and provider fulfillment remain open.'}
}
export function recordRetentionCommand(c:Context,name:string,p:Record<string,any>){
 if(!['privacy.recordDuty','privacy.records.review'].includes(name))return undefined
 need(c.a.role==='owner','Only the owner reviews record retention',403)
 if(name==='privacy.records.review'){
  keys(p,['sourceKind','sourceId']);const record=source(c.s,p.sourceKind,p.sourceId);c.entity=record.id
  return {...recordReview(c.s,p.sourceKind,record,c.now),presets:recordPresets}
 }
 keys(p,['id','revision','sourceKind','sourceId','sourceRevision','preset','applicability','anchor','employmentThrough','reason','consent'])
 need(p.consent===true,'Explicit owner authorization required',403)
 const record=source(c.s,p.sourceKind,p.sourceId);need(p.sourceRevision===record.revision,'Record changed; review again',409)
 const preset=recordPresets.find(x=>x.id===p.preset);need(preset,'Unknown maintained preset')
 need(['applies','does-not-apply','unknown'].includes(p.applicability),'Review applicability explicitly')
 const old=c.s.recordduties.find(d=>d.sourceKind===p.sourceKind&&d.sourceId===record.id&&d.preset.id===preset.id)
 if(old){need(p.id===old.id,'Use the current duty revision',409);exact(old,p)}else need(!p.id,'Duty not found',404)
 const anchor=date(p.anchor,'retention anchor'),floor=(record.end??record.through??record.date??record.createdAt??'').slice(0,10)
 need(!floor||anchor>=floor,'Retention anchor cannot precede the covered record',409)
 const employmentThrough=p.employmentThrough?date(p.employmentThrough,'later employment date'):''
 need(!employmentThrough||employmentThrough>=anchor,'Employment end cannot shorten the anchor')
 const unresolvedEmployment=preset.id==='california-hours-wages'&&!employmentThrough
 const applicability=unresolvedEmployment&&p.applicability==='applies'?'unknown':p.applicability
 const basis=employmentThrough>anchor?employmentThrough:anchor
 return put(c,'recordduties',{sourceKind:p.sourceKind,sourceId:record.id,sourceRevision:record.revision,preset:{...preset},applicability,anchor,employmentThrough,retainThrough:applicability==='applies'?anniversary(basis,preset.years):null,reason:text(p.reason,'applicability and authority reason',500),by:c.a.id,at:c.now,ownerAuthorized:true,versions:old?[...(old.versions??[]),Object.fromEntries(Object.entries(old).filter(([k])=>k!=='versions'))]:[]},old)
}
