// FAIR-001: four reproducible measures. No wage, protected-trait or feedback inputs.
import {type State,type Actor,manager,need,integer,text} from './model'
import {date,dayAfter} from './aca'
import {localDate} from './settings'
import {salesSite} from './sales'
import {cohortOn,memberEligible} from './fairness-policy'
import {spanDays,shiftSite,preferenceRow,preferenceGroups,cohortWindows,undesirableMeasure,violationMeasure,eligibleShift,type PreferenceRow} from './fairness-measures'
import {equityMeasure} from './fairness-equity'
export {fairnessCommands,eligibleAt,eligibleMembers} from './fairness-policy'
export {offerRequestBasis} from './fairness-equity'

/** Whole Mon–Sun weeks ending with `week`, inclusive; missing evidence stays unknown. */
export function preferenceReport(s:State,a:Actor,week:string,site:string,weeks=8,options:{asOf?:string}={}) {
 manager(a);date(week,'ending week');need(new Date(week+'T00:00:00Z').getUTCDay()===1,'Choose an ending week by its Monday')
 integer(weeks,'trailing weeks',1,52);text(site,'site',80,true)
 need(salesSite(s,a,site),'Not found',404)
 const first=dayAfter(week,-7*(weeks-1)),last=dayAfter(week,6),windows=cohortWindows(s,site,first,last)
 const people=s.staff.filter(p=>!p.erased_at&&(p.site??'')===site&&(p.active||s.shifts.some(x=>x.staffId===p.id&&x.status==='published'&&localDate(x.start,s.timezone)>=first&&localDate(x.start,s.timezone)<=last)))
 const rows:PreferenceRow[]=[]
 for(let i=0;i<weeks;i++) {
  const on=dayAfter(first,i*7),dates=spanDays(on,dayAfter(on,6)),covered=new Set<string>()
  for(const {record:c} of windows)for(const m of c.members) {
   if(!dates.some(d=>cohortOn(s,site,c.position,d)?.id===c.id&&memberEligible(m,site,c.position,d)))continue
   const person=s.staff.find(p=>p.id===m.staffId);if(person?.erased_at)continue
   rows.push(preferenceRow(s,{id:m.staffId,name:person?.name??'Former employee',position:c.position},on,site,c));covered.add(m.staffId)
  }
  // Keep the original display rows, explicitly unconfirmed, when historical membership is unknown.
  for(const person of people)if(!covered.has(person.id))rows.push(preferenceRow(s,person,on,site))
 }
 const groups=preferenceGroups(windows.length?rows.filter(r=>r.membership==='confirmed'):rows),undesirable=undesirableMeasure(s,site,first,last),violations=violationMeasure(s,site,first,last),equity=equityMeasure(s,site,first,last,options.asOf)
 const confirmed=rows.filter(r=>r.membership==='confirmed'),unique=new Map(confirmed.map(r=>[r.staffId+'|'+r.week,r]))
 const gaps=[...unique.values()].map(r=>r.gapMinutes).filter((v):v is number=>v!==null)
 const positions=[...new Set(windows.map(c=>c.record.position))]
 const missingDates=positions.flatMap(position=>spanDays(first,last).filter(on=>!cohortOn(s,site,position,on)).map(date=>({position,date,reason:'No employer-confirmed role/site eligibility'})))
 const unknownMembership=rows.filter(r=>r.membership!=='confirmed').map(r=>({staffId:r.staffId,position:r.position,week:r.week,membership:r.membership,reason:r.membership==='partial'?'Eligibility changes within this week':'Current home cafe and position are display context, not historical eligibility evidence'}))
 const sourceShifts=s.shifts.filter(x=>x.status==='published'&&shiftSite(s,x)===site&&localDate(x.start,s.timezone)>=first&&localDate(x.start,s.timezone)<=last)
 const unconfirmedShifts=sourceShifts.filter(x=>!windows.some(({record:c})=>{const m=c.members.find(m=>m.staffId===x.staffId);return Boolean(m&&eligibleShift(s,c,m,x))})).map(x=>({id:x.id,revision:x.revision,staffId:x.staffId,reason:'Assigned shift has no confirmed eligible historical role/site cohort'}))
 const complete=undesirable.groups.length>0&&undesirable.groups.every(g=>g.spread!==null)&&!missingDates.length&&!unconfirmedShifts.length
 const knownSpreads=undesirable.groups.map(g=>g.spread).filter((v):v is number=>v!==null)
 const cohortViolations=windows.map(({record:c,dates})=>{const own=violations.inputs.filter(x=>dates.includes(localDate(x.start,s.timezone))&&c.members.some(m=>m.staffId===x.staffId&&eligibleShift(s,c,m,sourceShifts.find(v=>v.id===x.id)!)));return {cohortId:c.id,position:c.position,count:own.filter(x=>x.preferNot===true).length,unknown:own.filter(x=>x.preferNot===null).length,shiftIds:own.map(x=>x.id)}})
 const totals={spread:complete?Math.max(...knownSpreads):null,meanGapMinutes:gaps.length?gaps.reduce((n,v)=>n+v,0)/gaps.length:null,maxGapMinutes:gaps.length?Math.max(...gaps):null,violations:windows.length&&!cohortViolations.some(v=>v.unknown)&&!unconfirmedShifts.length?cohortViolations.reduce((n,v)=>n+v.count,0):null,
  gapSamples:gaps.length,gapExcluded:unique.size-gaps.length,reasons:[...(!windows.length?['Historical eligibility is unknown; current display gaps are excluded from objective totals']:[]),...(missingDates.length?['Historical cohort membership is missing on some window dates']:[]),...(unconfirmedShifts.length?['Some assignments are outside confirmed historical cohorts']:[]),...(!undesirable.policy?['Employer has not selected undesirable tags']:[]),...(undesirable.groups.some(g=>g.reasons.length)?['Some cohort spread inputs are incomplete']:[])]}
 return {site,timezone:s.timezone,first,last,week,weeks,cohort:windows.length?'Employer-confirmed effective role/site eligibility; unconfirmed current display rows remain explicitly unknown':'Current home cafe and position; historical eligibility is not reconstructed',groups,legacyGroups:windows.length?preferenceGroups(rows.filter(r=>r.membership!=='confirmed')):[],rows,totals,undesirable,violations:{...violations,groups:cohortViolations},equity,
  cohorts:{records:windows.map(({record:c,dates})=>({...c,dates})),unknownMembership,missingDates,unconfirmedShifts,definition:'A cohort retains the complete employer-confirmed population and source qualifications for its effective dates. Certificate expiry is evaluated on each shift date. Current staff fields do not reconstruct earlier eligibility.'}}
}
