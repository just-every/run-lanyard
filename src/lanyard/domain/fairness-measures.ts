// FAIR-001 calculations use only scheduling, approved preferences and confirmed eligibility.
import {type State,type Row} from './model'
import {dayAfter} from './aca'
import {patternOn,patternFit} from './patterns'
import {localDate,wall} from './settings'
import {cohortOn,memberEligible,fairnessPolicy,type FairCohort,type EligibilityMember} from './fairness-policy'

export const spanDays=(from:string,until:string)=>Array.from({length:Math.max(0,Math.round((Date.parse(until)-Date.parse(from))/86400000)+1)},(_,i)=>dayAfter(from,i))
export const shiftSite=(s:State,x:Row)=>x.site||s.staff.find(p=>p.id===x.staffId)?.site||''
export function roleMatches(m:EligibilityMember,position:string,x:Record<string,any>) {
 return x.job?m.jobs.some(j=>j.id===x.job&&(j.id===position||j.name===position)):m.position===position&&!m.profile?.jobs.length
}
export function eligibleShift(s:State,c:FairCohort,m:EligibilityMember,x:Row) {
 const first=localDate(x.start,s.timezone),last=localDate(new Date(Date.parse(x.end)-1).toISOString(),s.timezone)
 return roleMatches(m,c.position,x)&&spanDays(first,last).every(on=>cohortOn(s,c.site,c.position,on)?.id===c.id&&memberEligible(m,c.site,c.position,on,x.job||undefined))
}
export function cohortWindows(s:State,site:string,first:string,last:string) {
 return s.fairnesscohorts.filter(r=>r.site===site&&r.from<=last&&(!r.until||r.until>=first)).map(r=>{
  const c=r as FairCohort,dates=spanDays(first,last).filter(on=>cohortOn(s,site,c.position,on)?.id===c.id)
  return {record:c,dates}
 }).filter(c=>c.dates.length)
}
export function preferenceRow(s:State,person:{id:string;name:string;position?:string|null},week:string,site:string,cohort?:FairCohort) {
 const end=dayAfter(week,6),published=s.rosters.find(r=>r.week===week&&r.status==='published')
 const shifts=s.shifts.filter(x=>x.staffId===person.id&&x.status==='published'&&shiftSite(s,x)===site&&localDate(x.start,s.timezone)>=week&&localDate(x.start,s.timezone)<=end)
 const patterns=spanDays(week,end).map(date=>{const p=patternOn(s,person.id,date);return {date,id:p?.id??null,revision:p?.revision??null,preferredHours:p?.preferredHours??null,blocks:p?.blocks??null,exceptions:p?.exceptions??null}})
 const values=patterns.map(p=>p.preferredHours),known=values.every(v=>typeof v==='number'),stable=known&&new Set(values).size===1
 const preferredMinutes=stable?values[0]*60:null,scheduledMinutes=published?shifts.reduce((n,x)=>n+x.minutes,0):null
 const member=cohort?.members.find(m=>m.staffId===person.id)
 const eligibleDays=cohort&&member?patterns.filter(p=>cohortOn(s,site,cohort.position,p.date)?.id===cohort.id&&memberEligible(member,site,cohort.position,p.date)).map(p=>p.date):[]
 const historical=eligibleDays.length===7
 const reasons=[...(!published?['No published week']:[]),...(!known?['Preferred hours missing on one or more days']:known&&!stable?['Preferred hours change within this week']:[]),...(cohort&&!historical?['Eligibility changes within this week']:[])]
 const inputs=shifts.map(x=>{const fit=patternFit(s,person.id,x);return {id:x.id,revision:x.revision,start:x.start,end:x.end,minutes:x.minutes,job:x.job??'',site:shiftSite(s,x),preferred:fit?.preferred??null,preferNot:fit?.known?fit.preferNot:null}})
 return {staffId:person.id,name:person.name,position:cohort?.position??person.position??'',week,roster:published?{id:published.id,revision:published.revision}:null,scheduledMinutes,preferredMinutes,gapMinutes:scheduledMinutes!==null&&preferredMinutes!==null&&(!cohort||historical)?Math.abs(scheduledMinutes-preferredMinutes):null,preferredShifts:inputs.filter(x=>x.preferred===true).length,preferNotShifts:inputs.filter(x=>x.preferNot===true).length,unknownBlockShifts:inputs.filter(x=>x.preferred===null).length,patterns,shifts:inputs,reasons,cohortId:cohort?.id??null,cohortRevision:cohort?.revision??null,membership:cohort?(historical?'confirmed':'partial'):'unknown',eligibleDays}
}
export type PreferenceRow=ReturnType<typeof preferenceRow>
export function preferenceGroups(rows:PreferenceRow[]) {
 return [...new Set(rows.map(r=>r.position))].sort().map(position=>{const own=rows.filter(r=>r.position===position),gaps=own.map(r=>r.gapMinutes).filter((v):v is number=>v!==null);return {position,samples:gaps.length,excluded:own.length-gaps.length,meanGapMinutes:gaps.length?gaps.reduce((n,v)=>n+v,0)/gaps.length:null,maxGapMinutes:gaps.length?Math.max(...gaps):null}})
}
function tagsFor(s:State,x:Row,policy:Row) {
 const on=localDate(x.start,s.timezone),endOn=localDate(x.end,s.timezone),endTime=wall(x.end,s.timezone).time,startTime=wall(x.start,s.timezone).time
 const closing=endOn>on||endTime>=policy.closingTime
 const prior=s.shifts.filter(p=>p.status==='published'&&p.staffId===x.staffId&&p.id!==x.id&&p.end<=x.start&&shiftSite(s,p)===shiftSite(s,x)).sort((a,b)=>b.end.localeCompare(a.end))[0]
 const priorOn=prior?localDate(prior.start,s.timezone):null
 const priorClosing=prior&&(localDate(prior.end,s.timezone)>priorOn!||wall(prior.end,s.timezone).time>=policy.closingTime)
 const rest=prior?(Date.parse(x.start)-Date.parse(prior.end))/3600000:null
 const closeOpen=Boolean(priorClosing&&startTime<=policy.openingTime&&rest!==null&&rest<=policy.closeOpenHours)
 const touched=spanDays(on,localDate(new Date(Date.parse(x.end)-1).toISOString(),s.timezone))
 const holidays=s.holidays.filter(h=>h.site===shiftSite(s,x)&&h.enabled&&touched.includes(h.date)).map(h=>({id:h.id,revision:h.revision,date:h.date}))
 const weekday=new Date(on+'T12:00:00Z').getUTCDay()
 const all=[...(closing?['closing']:[]),...(closeOpen?['close-then-open']:[]),...(weekday===0||weekday===6?['weekend']:[]),...(holidays.length?['holiday']:[])]
 return {tags:all.filter(t=>policy.tags.includes(t)),allTags:all,priorShift:prior?{id:prior.id,revision:prior.revision,start:prior.start,end:prior.end}:null,restHours:rest,holidays}
}
export function undesirableMeasure(s:State,site:string,first:string,last:string) {
 const policy=fairnessPolicy(s,site),windows=cohortWindows(s,site,first,last),inputs:any[]=[]
 const groups=windows.map(({record:c,dates})=>{
  const published=dates.every(on=>s.rosters.some(r=>r.status==='published'&&r.week<=on&&dayAfter(r.week,6)>=on))
  const reasons=[...(!policy?['Employer has not selected undesirable tags']:[]),...(!published?['One or more cohort weeks are unpublished']:[])]
  const counts=c.members.flatMap(m=>{
   const eligibleDays=dates.filter(on=>memberEligible(m,site,c.position,on));if(!eligibleDays.length)return []
   const shifts=s.shifts.filter(x=>x.status==='published'&&x.staffId===m.staffId&&shiftSite(s,x)===site&&eligibleDays.includes(localDate(x.start,s.timezone))&&eligibleShift(s,c,m,x))
   const facts=shifts.map(x=>({id:x.id,revision:x.revision,staffId:m.staffId,cohortId:c.id,start:x.start,end:x.end,job:x.job??'',minutes:x.minutes,...(policy?tagsFor(s,x,policy):{tags:[],allTags:[],priorShift:null,restHours:null,holidays:[]})}))
   inputs.push(...facts)
   return [{staffId:m.staffId,eligibleDays,count:policy?facts.filter(f=>f.tags.length>0).length:null,tags:Object.fromEntries((policy?.tags??[]).map((tag:string)=>[tag,facts.filter(f=>f.tags.includes(tag)).length])),shiftIds:facts.map(f=>f.id)}]
  })
  const values=counts.map(r=>r.count).filter((v):v is number=>v!==null),mean=values.length?values.reduce((n,v)=>n+v,0)/values.length:null
  return {id:c.id,cohortId:c.id,cohortRevision:c.revision,site,position:c.position,dates,counts,spread:!reasons.length&&values.length?Math.max(...values)-Math.min(...values):null,standardDeviation:!reasons.length&&mean!==null?Math.sqrt(values.reduce((n,v)=>n+(v-mean)**2,0)/values.length):null,reasons}
 })
 return {policy:policy?{id:policy.id,revision:policy.revision,tags:policy.tags,closingTime:policy.closingTime,openingTime:policy.openingTime,closeOpenHours:policy.closeOpenHours}:null,definition:'A shift matching any selected tag counts once; tag counts are also shown. Weekend uses the start venue date; holidays use every touched venue date. Close-then-open counts the opening shift after the preceding same-site closing shift.',groups,inputs,reasons:[...(!windows.length?['Historical role/site eligibility has not been confirmed']:[]),...(!policy?['Employer has not selected undesirable tags']:[])]}
}
export function violationMeasure(s:State,site:string,first:string,last:string) {
 const inputs=s.shifts.filter(x=>x.status==='published'&&shiftSite(s,x)===site&&localDate(x.start,s.timezone)>=first&&localDate(x.start,s.timezone)<=last).map(x=>{
  const fit=patternFit(s,x.staffId,x),lastDay=localDate(new Date(Date.parse(x.end)-1).toISOString(),s.timezone)
  return {id:x.id,revision:x.revision,staffId:x.staffId,start:x.start,end:x.end,preferNot:fit?.known?fit.preferNot:null,patterns:spanDays(localDate(x.start,s.timezone),lastDay).map(date=>{const p=patternOn(s,x.staffId,date);return {date,id:p?.id??null,revision:p?.revision??null,blocks:p?.blocks??null,exceptions:p?.exceptions??null}})}
 })
 const unknown=inputs.filter(x=>x.preferNot===null).length
 return {count:inputs.filter(x=>x.preferNot===true).length,unknown,inputs,reasons:unknown?['One or more shifts have missing effective preference patterns']:[]}
}
