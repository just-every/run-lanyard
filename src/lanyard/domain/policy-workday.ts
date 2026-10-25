// POLICY-001: an employer-selected California workday never changes the
// retained venue-date allocation used by PAY-009 or its approved rate inputs.
import {type State} from './model'
import {dayAfter} from './aca'
import {instantAt} from './settings'

type Part={date:string;minutes:number;site:string;start:string;end:string;[key:string]:any}
type RuleOn=(site:string,on:string)=>Record<string,any>|undefined
type WorkdayFields={workdayDate?:string;workdayKey?:string;workdayStart?:string;intervalStart?:string;intervalEnd?:string}

/** Split each retained payable allocation, rather than pricing its shift again.
 * Midnight policies keep their existing parts and behavior. Workday identity
 * includes the selected anchor so callers can refuse conflicting cafe anchors.
 * Classification must consume all relevant workday context before filtering
 * output and weekly totals by the original venue date. */
export function workdayParts<T extends Part>(s:State,staffId:string,parts:T[],ruleOn:RuleOn):(T&WorkdayFields)[] {
 return parts.flatMap(p=>{
  const rule=ruleOn(p.site,p.date),anchor=rule?.preset==='CA'?(rule.workdayStart??'00:00'):'00:00'
  if(anchor==='00:00')return [p]
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(anchor))throw new Error('California workday requires an HH:MM anchor')
  // A retained part's start and end may cover the entire overnight area. Clip to
  // its own venue date first, or both dates would allocate the same interval.
  const begin=Math.max(Date.parse(p.start),Date.parse(instantAt(p.date,'00:00',s.timezone)))
  const end=Math.min(Date.parse(p.end),Date.parse(instantAt(dayAfter(p.date),'00:00',s.timezone)))
  if(!Number.isFinite(begin)||!Number.isFinite(end)||end<=begin||!Number.isSafeInteger(p.minutes)||p.minutes<0)throw new Error('Retained payable allocation has no valid workday interval')
  const cut=Date.parse(instantAt(p.date,anchor,s.timezone))
  const boundaries=[begin,...(cut>begin&&cut<end?[cut]:[]),end]
  const total=BigInt(end-begin),minutes=BigInt(p.minutes)
  const slices=boundaries.slice(0,-1).map((start,i)=>{
   const finish=boundaries[i+1],weighted=minutes*BigInt(finish-start)
   return {start,end:finish,minutes:Number(weighted/total),remainder:weighted%total}
  })
  let left=p.minutes-slices.reduce((n,x)=>n+x.minutes,0)
  // Exact integer remainders avoid floating-point tie drift. Earlier slices
  // receive the remaining whole minute when elapsed weights tie.
  for(const x of [...slices].sort((a,b)=>a.remainder===b.remainder?a.start-b.start:a.remainder>b.remainder?-1:1))if(left-->0)x.minutes++
  return slices.map(x=>{
   const workdayDate=x.start<cut?dayAfter(p.date,-1):p.date
   return {...p,minutes:x.minutes,workdayDate,workdayKey:`${staffId}|${workdayDate}|${anchor}`,workdayStart:anchor,intervalStart:new Date(x.start).toISOString(),intervalEnd:new Date(x.end).toISOString()}
  })
 })
}
