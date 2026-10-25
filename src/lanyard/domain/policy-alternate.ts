import {type Context,keys,text,need,integer,object} from './model'
import {date,dayAfter} from './aca'

export const ALTERNATE_SOURCE='https://www.dir.ca.gov/t8/11050.html'
export const ALTERNATE_SCOPE='California Wage Order 5, sections 3(B)(1)–(2) and 3(C)'
export const ALTERNATE_ATTESTATION='Employer attests that the identified work unit adopted the written schedule by a valid secret ballot with at least two-thirds approval, required advance disclosures and meetings, timely reporting and implementation, and required employee protections; the evidence identifies every selected employee covered at this cafe'
export const ALTERNATE_UNSUPPORTED=[
 'Employee-requested day substitutions and schedule menus require separate review; consent is never inferred',
 'Health care shifts above ten hours, grandfathered agreements, makeup time and other industry variants are unsupported',
 'Exempt status is never inferred from salary, position or work unit',
]
export type AlternateWorkweek={
 kind:'CA_WO5_GENERAL';workUnit:string;staffIds:string[];days:{day:number;minutes:number}[]
 employerAttested:true;electionOn:string;announcedOn:string;effectiveFrom:string
 electionEvidence:string;implementationEvidence:string;reviewer:string;reviewedOn:string
 enrollment:{staffId:string;staffVersion:number;site:string}[];source:string;scope:string
}

/** The employer supplies evidence of a valid election and implementation, not
 * an inferred exemption. This bounded schedule cannot represent every variant
 * permitted by the order. Each cafe requires its own explicit enrollment. */
export function alternateConfiguration(c:Context,value:unknown,preset:string,from:string):AlternateWorkweek|null{
 if(value===null||value===undefined)return null
 need(preset==='CA','Alternative workweeks require the California preset')
 const p=object(value)
 keys(p,['kind','workUnit','staffIds','days','employerAttested','electionOn','announcedOn','effectiveFrom','electionEvidence','implementationEvidence','reviewer','reviewedOn'])
 need(p.kind==='CA_WO5_GENERAL','Only the general elected California Wage Order 5 alternative workweek is supported')
 need(p.employerAttested===true,'Employer attestation of the valid work unit election and implementation is required')
 const workUnit=text(p.workUnit,'identifiable work unit',200)
 need(Array.isArray(p.staffIds)&&p.staffIds.length>0&&p.staffIds.length<=500,'Select the active employees covered at this cafe')
 const staffIds=p.staffIds.map((id:unknown)=>text(id,'enrolled employee')).sort() as string[]
 need(new Set(staffIds).size===staffIds.length,'Select each enrolled employee once')
 const enrollment=staffIds.map(staffId=>{
  const person=c.s.staff.find(p=>p.id===staffId)
  need(person&&person.active&&!person.erased_at,'Alternative workweek enrollment requires active employees')
  return {staffId,staffVersion:person.version,site:person.site??''}
 })
 need(Array.isArray(p.days)&&p.days.length>0&&p.days.length<=7,'Specify the regularly recurring workdays')
 const days=p.days.map((value:unknown)=>{
  const d=object(value);keys(d,['day','minutes'])
  return {day:integer(d.day,'regular weekday',0,6),minutes:integer(d.minutes,'regular day minutes',240,600)}
 }).sort((a:{day:number},b:{day:number})=>a.day-b.day) as {day:number;minutes:number}[]
 need(new Set(days.map(d=>d.day)).size===days.length,'Specify each regular weekday once')
 need(days.reduce((n,d)=>n+d.minutes,0)<=2400,'Alternative workweek regular hours cannot exceed forty per week')
 const electionOn=date(p.electionOn,'election date'),announcedOn=date(p.announcedOn,'final election announcement'),effectiveFrom=date(p.effectiveFrom,'alternative workweek implementation date'),reviewedOn=date(p.reviewedOn,'review date')
 need(electionOn<=announcedOn,'The final announcement cannot precede the election')
 need(effectiveFrom>=dayAfter(announcedOn,30),'New alternative workweek hours require thirty days after the final election announcement')
 need(from>=effectiveFrom,'The policy cannot apply alternative workweek hours before the reviewed implementation date')
 need(reviewedOn>=electionOn&&reviewedOn<=c.now.slice(0,10),'Review must follow the election and cannot be in the future')
 return {kind:'CA_WO5_GENERAL',workUnit,staffIds,days,employerAttested:true,electionOn,announcedOn,effectiveFrom,
  electionEvidence:text(p.electionEvidence,'written agreement, disclosure, secret ballot and reporting evidence',1000),
  implementationEvidence:text(p.implementationEvidence,'implementation and employee inclusion evidence',1000),
  reviewer:text(p.reviewer,'election and implementation reviewer',200),reviewedOn,enrollment,source:ALTERNATE_SOURCE,scope:ALTERNATE_SCOPE}
}

/** `on` is the venue workday date. `actualDayMinutes` includes all work that
 * date across cafes. Pass the completed day total, never one segment's length.
 * Weekly overtime and seventh-day rules remain the caller's responsibility. */
export function alternateLimits(rule:Record<string,any>,staffId:string,on:string,actualDayMinutes:number){
 const a=rule.alternate as AlternateWorkweek|null|undefined
 if(rule.preset!=='CA'||a?.kind!=='CA_WO5_GENERAL'||!a.staffIds.includes(staffId)||on<a.effectiveFrom||on<rule.from)return null
 const weekday=new Date(on+'T00:00:00Z').getUTCDay(),scheduledMinutes=a.days.find(d=>d.day===weekday)?.minutes??0
 const shortened=scheduledMinutes>0&&actualDayMinutes<scheduledMinutes
 // Without a recorded reason, a shortened day cannot establish voluntary
 // employee consent. Use the protective employer-shortening treatment and
 // retain the unresolved reason for the caller's classification review.
 return {dailyMinutes:scheduledMinutes?(shortened?480:scheduledMinutes):0,doubleMinutes:scheduledMinutes?720:480,
  reviewRequired:shortened,reviewReason:shortened?'Shortened regular day: employer requirement or employee request is unknown; estimate uses overtime after eight hours pending review':null,
  treatment:scheduledMinutes?(shortened?'shortened regular day pending review':'regular elected workday'):'additional workday; no employee-requested substitution inferred',
  scheduledMinutes,actualDayMinutes,source:a.source,scope:a.scope,workUnit:a.workUnit,effectiveFrom:a.effectiveFrom,
  electionOn:a.electionOn,announcedOn:a.announcedOn,electionEvidence:a.electionEvidence,implementationEvidence:a.implementationEvidence,
  reviewer:a.reviewer,reviewedOn:a.reviewedOn,enrollment:a.enrollment.find(p=>p.staffId===staffId),unsupported:ALTERNATE_UNSUPPORTED}
}
