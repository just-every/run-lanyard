// TIME-007: forgotten clock-outs. The owner sets, per cafe, a reminder grace after the scheduled
// end and a maximum open-punch length. A punch still open at its point is provisionally closed:
// it stops counting at the scheduled end (or at the cap when unscheduled), the person is reminded
// in the app, payroll holds it and only a confirmed or corrected end becomes submitted time.
import {type Context,type Row,type State,keys,text,integer,need,put} from './model'
import {siteOf} from './team'

/** The cafe's rule: the punch's matched shift's cafe, else the person's home cafe. */
function ruleOf(s:State,clock:Row,shift:Row|undefined) {
 const site=shift?siteOf(s,shift):s.staff.find(p=>p.id===clock.staffId)?.site??''
 return s.closerules.find(r=>r.site===site)
}
/**
 * An open punch's provisional close as of `at`, or null. A scheduled punch (the TIME-006 matched
 * shift) is reminded and provisionally closed at the scheduled end plus the grace and stops at the
 * scheduled end; an unscheduled one at the cap. The cap bounds both.
 */
export function provisional(s:State,clock:Row,at:string):{end:string;due:string;scheduled:boolean}|null {
 if(clock.status!=='open')return null
 const shift=clock.shiftId?s.shifts.find(x=>x.id===clock.shiftId):undefined,rule=ruleOf(s,clock,shift);if(!rule)return null
 const cap=Date.parse(clock.start)+rule.capHours*3600000
 const end=shift?Math.min(Date.parse(shift.end),cap):cap,due=shift?Math.min(Date.parse(shift.end)+rule.graceMinutes*60000,cap):cap
 return Date.parse(at)>=due?{end:new Date(end).toISOString(),due:new Date(due).toISOString(),scheduled:Boolean(shift)&&end<cap}:null
}
export function closeRules(c:Context,name:string,p:Record<string,any>) {
 if(name!=='closerule.save')return undefined
 need(c.a.role==='owner','Owner required',403);keys(p,['site','graceMinutes','capHours','revision'])
 const site=text(p.site,'site',80,true),old=c.s.closerules.find(r=>r.site===site)
 if(old)need(integer(p.revision,'revision',1,Number.MAX_SAFE_INTEGER)===old.revision,'Clock-out rule changed; reload before saving',409)
 const num=(v:unknown)=>typeof v==='string'&&v.trim()!==''?Number(v):v
 const graceMinutes=integer(num(p.graceMinutes),'reminder grace minutes',0,240),capHours=integer(num(p.capHours),'maximum open hours',1,24)
 return put(c,'closerules',{site,graceMinutes,capHours,savedBy:c.a.id,savedAt:c.now},old)
}
