import {type Context,keys,text,need,integer,object} from './model'
import {date} from './aca'

export const REGIONAL_SOURCES={
 AK:'https://labor.alaska.gov/lss/forms/flexplan.pdf',
 NV:'https://labor.nv.gov/uploadedFiles/labornvgov/content/Employer/AO-2025-01%20Daily%20Overtime%20for%204-10%20Employee.pdf',
} as const
export const NV_SUPPLEMENT='https://labor.nv.gov/uploadedFiles/labornvgov/content/Employer/AO%204-10%20Supplemental%20Guidance%201%2025%202021.pdf'
export const REGIONAL_ATTESTATIONS={
 AK:'Employer confirms department approval for this employer, signed and dated voluntary participation by every selected employee after approval, an equivalent ordinary weekly schedule offered with overtime after eight hours, and the approved recurring schedule and employee inclusion at this cafe',
 NV:'Employer confirms a mutual agreement with every selected employee for the recorded recurring four ten-hour days and explicit employee inclusion at this cafe; deviations and employee requests are never inferred from hours alone',
} as const
export const REGIONAL_UNSUPPORTED={
 AK:['Occasional deviations require employer review of historical weeks and the statutory 20 percent limit; no rolling window or eligibility is inferred',
  'Withdrawal, rehire enrollment, plan invalidation and exceptions require separate employer review'],
 NV:['Employee-requested redistribution, employer-controlled shortening, disciplinary absences and additional shifts require explicit facts and separate review',
  'Daily totals use venue dates; complete Nevada consecutive 24-hour workday interpretation remains unsupported',
  'Wage-threshold coverage and weekly overtime remain separate checks; exemption or consent is never inferred'],
} as const

type Common={workUnit:string;staffIds:string[];days:{day:number;minutes:number}[];effectiveFrom:string
 employerAttested:true;reviewer:string;reviewedOn:string
 enrollment:{staffId:string;staffVersion:number;site:string}[];source:string;scope:string}
export type RegionalAlternateWorkweek=Common&(
 {kind:'AK_FLEX_APPROVED';approvalOn:string;approvalEvidence:string;participationOn:string;participationEvidence:string;ordinaryScheduleOffered:true}|
 {kind:'NV_4X10';agreementOn:string;agreementEvidence:string})

/** Employer evidence establishes enrollment; recorded hours establish only
 * adherence, never approval, consent or occasional-deviation eligibility. */
export function regionalConfiguration(c:Context,value:unknown,preset:string,from:string):RegionalAlternateWorkweek|null{
 if(value===null||value===undefined)return null
 const p=object(value),ak=p.kind==='AK_FLEX_APPROVED'
 need(ak||p.kind==='NV_4X10','Only approved Alaska flex plans and mutually agreed Nevada four-ten schedules are supported')
 need(preset===(ak?'AK':'NV'),'The alternate schedule must match the Alaska or Nevada preset')
 keys(p,['kind','workUnit','staffIds','days','effectiveFrom','employerAttested','reviewer','reviewedOn',
  ...(ak?['approvalOn','approvalEvidence','participationOn','participationEvidence','ordinaryScheduleOffered']:['agreementOn','agreementEvidence'])])
 need(p.employerAttested===true,'Employer attestation of approval, participation and the recurring schedule is required')
 const workUnit=text(p.workUnit,'identifiable work unit',200)
 need(Array.isArray(p.staffIds)&&p.staffIds.length>0&&p.staffIds.length<=500,'Select the active employees covered at this cafe')
 const staffIds=p.staffIds.map((id:unknown)=>text(id,'enrolled employee')).sort() as string[]
 need(new Set(staffIds).size===staffIds.length,'Select each enrolled employee once')
 const enrollment=staffIds.map(staffId=>{
  const person=c.s.staff.find(p=>p.id===staffId)
  need(person&&person.active&&!person.erased_at,'Alternate schedule enrollment requires active employees')
  return {staffId,staffVersion:person.version,site:person.site??''}
 })
 need(Array.isArray(p.days)&&p.days.length>=4&&p.days.length<=(ak?7:4),'Specify the approved recurring workdays; Nevada requires exactly four')
 const days=p.days.map((value:unknown)=>{
  const d=object(value);keys(d,['day','minutes'])
  return {day:integer(d.day,'regular weekday',0,6),minutes:integer(d.minutes,'regular day minutes',ak?1:600,600)}
 }).sort((a:{day:number},b:{day:number})=>a.day-b.day) as {day:number;minutes:number}[]
 need(new Set(days.map(d=>d.day)).size===days.length,'Specify each recurring weekday once')
 const weekly=days.reduce((n,d)=>n+d.minutes,0)
 need(weekly>=(ak?1980:2400)&&weekly<=2400,'Supported recurring schedules require Alaska 33–40 hours or Nevada forty hours per week')
 const effectiveFrom=date(p.effectiveFrom,'schedule effective date'),reviewedOn=date(p.reviewedOn,'employer review date')
 need(from>=effectiveFrom,'The policy cannot apply an alternate schedule before its effective date')
 need(reviewedOn<=c.now.slice(0,10),'The employer review cannot be in the future')
 const common={workUnit,staffIds,days,effectiveFrom,employerAttested:true as const,
  reviewer:text(p.reviewer,'approval and participation reviewer',200),reviewedOn,enrollment}
 if(ak){
  const approvalOn=date(p.approvalOn,'department approval date'),participationOn=date(p.participationOn,'signed voluntary participation date')
  need(approvalOn<=participationOn&&participationOn<=effectiveFrom,'Signed employee participation must follow department approval and precede implementation')
  need(reviewedOn>=participationOn,'The employer review must follow approval and signed participation')
  need(p.ordinaryScheduleOffered===true,'An equivalent ordinary weekly schedule with overtime after eight hours must have been offered')
  return {...common,kind:'AK_FLEX_APPROVED',approvalOn,participationOn,ordinaryScheduleOffered:true,
   approvalEvidence:text(p.approvalEvidence,'department-approved plan and employer identity evidence',1000),
   participationEvidence:text(p.participationEvidence,'signed and dated voluntary participation evidence for every enrolled employee',1000),
   source:REGIONAL_SOURCES.AK,scope:'Alaska 8 AAC 15.102; approved voluntary flexible work hour plans'}
 }
 const agreementOn=date(p.agreementOn,'mutual agreement date')
 need(agreementOn<=effectiveFrom&&reviewedOn>=agreementOn,'Employer review and implementation must follow the mutual agreement')
 return {...common,kind:'NV_4X10',agreementOn,
  agreementEvidence:text(p.agreementEvidence,'mutual four-ten agreement evidence for every enrolled employee',1000),
  source:REGIONAL_SOURCES.NV,scope:'Nevada NRS 608.018 and AO-2025-01; regular mutual four-ten schedules'}
}

/** Completed employee workweek totals must include every worked cafe, zeros
 * may be omitted. Do not call this with a partial week or one shift segment.
 * The caller retains weekly overtime and the most protective worked-cafe rule. */
export function regionalLimits(rule:Record<string,any>,staffId:string,on:string,dayMinutes:number,weekDays:{date:string;minutes:number}[]){
 const a=rule.alternate as RegionalAlternateWorkweek|null|undefined
 if(!a||!['AK_FLEX_APPROVED','NV_4X10'].includes(a.kind)||rule.preset!==(a.kind==='AK_FLEX_APPROVED'?'AK':'NV')||!a.staffIds.includes(staffId)||on<a.effectiveFrom||on<rule.from)return null
 const ak=a.kind==='AK_FLEX_APPROVED',weekday=(on:string)=>new Date(on+'T00:00:00Z').getUTCDay()
 const scheduledMinutes=a.days.find(d=>d.day===weekday(on))?.minutes??0
 const totals=new Map<number,number>()
 for(const d of weekDays)totals.set(weekday(d.date),(totals.get(weekday(d.date))??0)+d.minutes)
 const extra=[...totals].some(([day,minutes])=>minutes>0&&!a.days.some(d=>d.day===day))
 const deviation=extra||a.days.some(d=>ak?(totals.get(d.day)??0)!==d.minutes:(totals.get(d.day)??0)<d.minutes)
 const reviewReason=deviation?(ak?
  'Deviation from the approved weekly plan: historical occasional-deviation eligibility has not been reviewed; estimate restores overtime after eight hours across this week':
  'Deviation from the mutual four-ten schedule: employer control, employee choice and special circumstances are unknown; estimate restores overtime after eight hours across this week'):null
 const evidence=ak?{approvalOn:a.approvalOn,approvalEvidence:a.approvalEvidence,participationOn:a.participationOn,participationEvidence:a.participationEvidence,ordinaryScheduleOffered:a.ordinaryScheduleOffered}:
  {agreementOn:a.agreementOn,agreementEvidence:a.agreementEvidence,supplementSource:NV_SUPPLEMENT}
 return {dailyMinutes:deviation?480:600,doubleMinutes:1440,reviewRequired:deviation,reviewReason,
  treatment:deviation?'weekly schedule deviation pending employer review':ak?'approved regular flexible workweek':'mutually agreed regular four-ten workweek; overtime after ten hours',
  scheduledMinutes,actualDayMinutes:dayMinutes,source:a.source,scope:a.scope,workUnit:a.workUnit,effectiveFrom:a.effectiveFrom,
  ...evidence,reviewer:a.reviewer,reviewedOn:a.reviewedOn,enrollment:a.enrollment.find(p=>p.staffId===staffId),
  unsupported:ak?REGIONAL_UNSUPPORTED.AK:REGIONAL_UNSUPPORTED.NV}
}
