import {type State} from './model'
import {dayAfter} from './aca'
import {instantAt,localDate} from './settings'
import {workerCoverage} from './policy-coverage'

export const NEVADA_VERSION='2026-10-28'
export const NEVADA_SOURCE='https://www.leg.state.nv.us/NRS/NRS-608.html#NRS608Sec0126'
export const NEVADA_OVERTIME_SOURCE='https://www.leg.state.nv.us/NRS/NRS-608.html#NRS608Sec018'
export const nevadaWorkday=(rule:any)=>rule?.preset==='NV'&&rule.presetVersion===NEVADA_VERSION
const enrolled=(rule:any,id:string)=>rule?.alternate?.kind==='NV_4X10'&&rule.alternate.staffIds.includes(id)

/** NRS 608.0126 starts a workday when work begins, for 24 elapsed hours.
 * NRS 608.018 applies the eight-hour daily limit below 1.5 times the USD 12
 * minimum wage. This release covers reviewed ordinary nonexempt work only;
 * it grants no alternate-schedule exception or legal applicability decision.
 * Recut each retained venue-date allocation with exact integer remainders so
 * neither a break deduction nor a rate is priced or rounded a second time. */
export function nevadaWorkdayParts<T extends {date:string;site:string;start:string;end:string;minutes:number;intervalStart?:string;intervalEnd?:string}>(s:State,staffId:string,parts:T[],ruleOn:(site:string,on:string)=>any,through:string):(T&Record<string,any>)[]{
 // Prior work supplies the anchor and elapsed daily minutes. Later work and
 // policy releases cannot activate or invalidate an earlier week's treatment.
 const intervals=parts.filter(p=>p.date<=through).map(p=>({p,begin:Math.max(Date.parse(p.intervalStart??p.start),Date.parse(instantAt(p.date,'00:00',s.timezone))),end:Math.min(Date.parse(p.intervalEnd??p.end),Date.parse(instantAt(dayAfter(p.date),'00:00',s.timezone)))})).sort((a,b)=>a.begin-b.begin||a.end-b.end)
 if(!intervals.some(({p})=>nevadaWorkday(ruleOn(p.site,p.date))&&!enrolled(ruleOn(p.site,p.date),staffId)))return parts
 let anchor=-Infinity
 const slices=intervals.flatMap(({p,begin,end})=>{
  if(!Number.isFinite(begin)||!Number.isFinite(end)||end<=begin||!Number.isSafeInteger(p.minutes)||p.minutes<0)throw new Error('Retained payable allocation has no valid Nevada workday interval')
  const chunks:{start:number;end:number;anchor:number;minutes:number;remainder:bigint}[]=[]
  for(let start=begin;start<end;){
   if(start>=anchor+86400000)anchor=start
   const finish=Math.min(end,anchor+86400000),weight=BigInt(p.minutes)*BigInt(finish-start),total=BigInt(end-begin)
   chunks.push({start,end:finish,anchor,minutes:Number(weight/total),remainder:weight%total});start=finish
  }
  let left=p.minutes-chunks.reduce((n,c)=>n+c.minutes,0)
  for(const c of [...chunks].sort((a,b)=>a.remainder===b.remainder?a.start-b.start:a.remainder>b.remainder?-1:1))if(left-->0)c.minutes++
  return chunks.map(c=>({...p,original:p,minutes:c.minutes,nevadaAnchor:c.anchor,intervalStart:new Date(c.start).toISOString(),intervalEnd:new Date(c.end).toISOString()}))
 })
 const active=new Set(slices.filter(p=>nevadaWorkday(ruleOn(p.site,p.date))&&!enrolled(ruleOn(p.site,p.date),staffId)).map(p=>p.nevadaAnchor))
 const groups=new Map<T,typeof slices>()
 for(const p of slices)groups.set(p.original,[...(groups.get(p.original)??[]),p])
 return parts.flatMap<any>(original=>{
  const cuts=groups.get(original)??[]
  if(!cuts.some(p=>active.has(p.nevadaAnchor)))return [original]
  return cuts.map(({original,...p})=>{
   if(!active.has(p.nevadaAnchor))return p
   const rule=ruleOn(p.site,p.date),profile=workerCoverage(rule,staffId)
   const reviewed=nevadaWorkday(rule)&&!enrolled(rule,staffId)&&profile?.federalOvertime==='covered'&&profile?.stateWeekly==='covered'&&profile?.stateDaily==='covered'&&!!profile.legalBasis&&!!profile.evidenceReference
   const start=new Date(p.nevadaAnchor).toISOString()
   return {...p,workdayDate:localDate(start,s.timezone),workdayKey:`${staffId}|${localDate(start,s.timezone)}|NV:${start}`,workdayStart:start,workdayEnd:new Date(p.nevadaAnchor+86400000).toISOString(),workdayTreatment:'Nevada consecutive 24-hour workday from first work',nevadaReviewRequired:!reviewed}
  })
 })
}
