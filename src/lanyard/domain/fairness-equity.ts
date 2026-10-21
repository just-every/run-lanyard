// Offered extra hours come from opened recipient tiers, never from acceptance or assigned hours.
import {type State,type Row} from './model'
import {localDate,instantAt} from './settings'
import {dayAfter} from './aca'
import {cohortOn,memberEligible,requestOn,type EligibilityMember} from './fairness-policy'
import {cohortWindows,shiftSite,spanDays,roleMatches} from './fairness-measures'

const monday=(on:string)=>dayAfter(on,-((new Date(on+'T12:00:00Z').getUTCDay()+6)%7))
function requestBasis(s:State,m:EligibilityMember,dates:string[]) {
 const weeks=[...new Set(dates.map(monday))],inputs=weeks.map(week=>{
  const days=dates.filter(d=>monday(d)===week),values=days.map(d=>requestOn(s,m.staffId,d))
  const stable=days.length===7&&values.every(v=>v!==null)&&new Set(values.map(v=>v?.minutes)).size===1
  return {week,minutes:stable?values[0]!.minutes as number:null,days:days.map((date,i)=>({date,id:values[i]?.id??null,revision:values[i]?.revision??null,minutes:values[i]?.minutes??null,recordedAt:values[i]?.recordedAt??null})),reason:stable?null:days.length!==7?'Eligibility covers only part of this week':'Requested extra minutes missing or changing within this week'}
 })
 return {minutes:inputs.every(x=>x.minutes!==null)?inputs.reduce((n,v)=>n+v.minutes!,0):null,inputs}
}
/** A posting-time request lookup. Callers may retain this result on newly posted offers. */
export function offerRequestBasis(s:State,staffId:string,on:string,postedAt:string) {
 const r=requestOn(s,staffId,on,postedAt)
 return r?{id:r.id,revision:r.revision,from:r.from,until:r.until,minutes:r.minutes,recordedAt:r.recordedAt}:null
}
type OfferInput={kind:'open shift'|'cover';id:string;revision:number;staffId:string;site:string;position:string;date:string;start:string;end:string;minutes:number;payableBasis:Record<string,any>;openedAt:string;closedAt:string|null;postedAt:string;shiftId:string|null;shiftRevision:number|null;request:any;cohortId:string|null;included:boolean;reason:string|null}
function offerInputs(s:State,site:string,first:string,last:string,asOf:string) {
 const out:OfferInput[]=[],positions=[...new Set(s.fairnesscohorts.filter(c=>c.site===site).map(c=>c.position as string))]
 const append=(base:Omit<OfferInput,'position'|'request'|'cohortId'|'included'|'reason'>,job:string,position:string,request?:any)=>{
  if(base.date<first||base.date>last)return
  const roles=position?[position]:positions.filter(role=>{const c=cohortOn(s,site,role,base.date),m=c?.members.find(v=>v.staffId===base.staffId);return Boolean(m&&roleMatches(m,role,{job}))})
  if(!roles.length)roles.push(position)
  for(const role of roles){const c=cohortOn(s,site,role,base.date),m=c?.members.find(v=>v.staffId===base.staffId)
   const eligible=Boolean(c&&m&&memberEligible(m,site,role,base.date,job||undefined))
   const durationKnown=Number.isSafeInteger(base.minutes)&&base.minutes>0
   const reached=base.openedAt<=asOf&&(!base.closedAt||base.openedAt<base.closedAt)
   const basis=request??offerRequestBasis(s,base.staffId,base.date,base.postedAt)
   out.push({...base,position:role,request:basis,cohortId:c?.id??null,included:eligible&&reached&&durationKnown,reason:!durationKnown?'Offer duration was not retained':!c?'Historical role/site eligibility has not been confirmed':!eligible?'Recipient not eligible under confirmed historical basis':!reached?'Tier had not opened before closure or report cutoff':null})
  }
 }
 for(const o of s.openshifts.filter(o=>o.site===site&&o.status!=='draft')) {
  const on=localDate(o.start,s.timezone),closed=[o.filledAt,o.closedAt,o.cancelledAt,o.start].filter(Boolean).sort()[0]??null
  // Missing legacy offer logs are unknown, not evidence that all coworkers received an offer.
  if(!o.tiers)continue
  for(const tier of o.tiers)for(const staffId of tier.staffIds)append({kind:'open shift',id:o.id,revision:o.revision,staffId,site,date:on,start:o.start,end:o.end,minutes:Math.floor((Date.parse(o.end)-Date.parse(o.start))/60000)-o.breakMinutes,payableBasis:{start:o.start,end:o.end,breakMinutes:o.breakMinutes},openedAt:tier.opensAt,closedAt:closed,postedAt:o.postedAt,shiftId:o.shiftId??null,shiftRevision:null},o.job??'',o.position??'',o.fairnessRequests?.find((r:any)=>r.staffId===staffId)?.request)
 }
 for(const o of s.offers) {
  const x=s.shifts.find(x=>x.id===o.shiftId);if(!x||shiftSite(s,x)!==site)continue
  const closed=[o.closedAt,o.expiresAt??x.end].filter(Boolean).sort()[0]??null
  const position=s.fairnesscohorts.find(c=>c.site===site&&c.members.some((m:EligibilityMember)=>m.staffId===o.staffId&&roleMatches(m,c.position,x)))?.position??''
  append({kind:'cover',id:o.id,revision:o.revision,staffId:o.staffId,site,date:localDate(x.start,s.timezone),start:x.start,end:o.expiresAt??x.end,minutes:o.after-o.before,payableBasis:{before:o.before,after:o.after},openedAt:o.opensAt??o.sentAt??o.createdAt,closedAt:closed,postedAt:o.createdAt,shiftId:x.id,shiftRevision:o.shiftRevision??null},x.job??'',position,o.fairnessRequest)
 }
 // Reoffering the same shift to the same employee is one opportunity, not more hours.
 const seen=new Set<string>()
 for(const o of out.filter(o=>o.included).sort((a,b)=>a.openedAt.localeCompare(b.openedAt))){const key=[o.kind,o.kind==='cover'?o.shiftId:o.id,o.staffId,o.cohortId].join('|');if(seen.has(key)){o.included=false;o.reason='Repeat offer of the same opportunity to this employee'}else seen.add(key)}
 return out
}
export function equityMeasure(s:State,site:string,first:string,last:string,now?:string) {
 const windowEnd=instantAt(dayAfter(last),'00:00',s.timezone),current=now??new Date().toISOString(),asOf=current<windowEnd?current:windowEnd
 const inputs=offerInputs(s,site,first,last,asOf),windows=cohortWindows(s,site,first,last)
 const missingLogs=s.openshifts.filter(o=>o.site===site&&o.status!=='draft'&&!o.tiers&&localDate(o.start,s.timezone)>=first&&localDate(o.start,s.timezone)<=last).map(o=>({id:o.id,revision:o.revision,reason:'Legacy open shift has no retained recipient offer log'}))
 const groups=[...new Set(windows.map(w=>w.record.position))].map(position=>{
  const sources=windows.filter(w=>w.record.position===position),cohortIds=sources.map(w=>w.record.id),ids=[...new Set(sources.flatMap(w=>w.record.members.map(m=>m.staffId)))]
  const people=ids.map(staffId=>({member:{staffId} as EligibilityMember,dates:spanDays(first,last).filter(on=>{const c=cohortOn(s,site,position,on),m=c?.members.find(m=>m.staffId===staffId);return Boolean(m&&m.employment?.type==='part-time'&&memberEligible(m,site,position,on))})})).filter(p=>p.dates.length)
  const bases=people.map(({member:m,dates})=>{const requested=requestBasis(s,m,dates),offers=inputs.filter(o=>cohortIds.includes(o.cohortId??'')&&o.staffId===m.staffId&&o.included)
   const missingPosting=offers.some(o=>!o.request),requestsKnown=requested.minutes!==null
   return {staffId:m.staffId,offeredMinutes:offers.reduce((n,o)=>n+o.minutes,0),requestedMinutes:requested.minutes,requests:requested.inputs,offerIds:offers.map(o=>o.id),reasons:[...(!requestsKnown?['Requested extra minutes missing or changing within an eligible week']:[]),...(missingPosting?['One or more offers have no request recorded by posting time']:[])]}
  })
  const totalOfferedMinutes=bases.reduce((n,r)=>n+r.offeredMinutes,0),known=bases.length>0&&bases.every(r=>r.requestedMinutes!==null&&!r.reasons.length),totalRequestedMinutes=known?bases.reduce((n,r)=>n+r.requestedMinutes!,0):null
  const rows=bases.map(r=>{const offeredShare=!missingLogs.length&&totalOfferedMinutes>0?r.offeredMinutes/totalOfferedMinutes:null,requestedShare=totalRequestedMinutes? r.requestedMinutes!/totalRequestedMinutes:null;return {...r,offeredShare,requestedShare,shareGap:offeredShare!==null&&requestedShare!==null?offeredShare-requestedShare:null}})
  return {cohortId:cohortIds[0],cohortIds,position,site,rows,totalOfferedMinutes,totalRequestedMinutes,reasons:[...(missingLogs.length?['Historical recipient offer logs are incomplete']:[]),...(!known?['Requested shares are unknown until every eligible part-time employee has explicit effective requests and posting-time request evidence']:[]),...(!totalOfferedMinutes?['No reached extra-hours offers in this window']:[]),...(totalRequestedMinutes===0?['Total requested extra hours is zero']:[])]}
 })
 return {definition:'Offered payable minutes count once per recipient and opportunity when its tier actually opened, whether accepted or declined. Requested extra minutes are explicitly recorded per eligible venue week; preferred hours are not a request. Shares compare eligible part-time employees in the same confirmed cohort.',asOf,groups,inputs,missingLogs,reasons:[...(!windows.length?['Historical role/site eligibility has not been confirmed']:[]),...(missingLogs.length?['Some historical recipient offers are unknown']:[])]}
}
