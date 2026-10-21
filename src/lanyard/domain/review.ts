import {workweek} from './payschedules'
import {priced} from './workforce'
// TIME-009: what an approver sees for one timesheet: scheduled, captured and payable times side
// by side, variance against the shift, breaks taken against the cafe's meal rule, the punch's
// network (CLOCK-007), job and cafe, rounding effect, open exceptions, cost, and the person's
// running week with overtime. Photos and geofenced location join it with CLOCK-005 and CLOCK-003.
import {type Row,type State} from './model'
import {siteOf} from './team'
import {breakRuleFor,restsOwed} from './breaks'
import {mealRuleFor} from './mealrules'
import {localDate} from './settings'

const WEEK=40*60
const span=(a:string,b:string)=>Math.round((Date.parse(b)-Date.parse(a))/60000)
/** The Monday of the venue week holding an instant. */
const mondayOf=(s:State,at:string)=>{const d=localDate(at,s.timezone),n=new Date(d+'T00:00:00Z').getUTCDay();return new Date(Date.parse(d+'T00:00:00Z')-((n+6)%7)*86400000).toISOString().slice(0,10)}

export function review(s:State,t:Row) {
 const clock=t.clockId?s.clocks.find(k=>k.id===t.clockId):undefined,shift=clock?.shiftId?s.shifts.find(x=>x.id===clock.shiftId):undefined
 const person=s.staff.find(p=>p.id===t.staffId),captured=t.captured??{start:t.start,end:t.end,breakMinutes:t.breakMinutes,minutes:t.rounding?.capturedMinutes??t.minutes}
 const rule=clock?mealRuleFor(s,clock):undefined,week=workweek(s,t.staffId,localDate(t.start,s.timezone))
 const mine=s.timesheets.filter(x=>x.staffId===t.staffId&&['submitted','approved','returned'].includes(x.status)&&workweek(s,t.staffId,localDate(x.start,s.timezone))===week&&x.start<=t.start)
 const policy=breakRuleFor(s,t.staffId,clock?.shiftId),duration=Math.floor((Date.parse(captured.end)-Date.parse(captured.start))/60000)
 const automaticMeal=rule&&duration>rule.afterMinutes?rule.deductMinutes:0
 const policyMeal=policy&&duration>policy.mealAfterMinutes&&!t.breakWaiver?policy.mealMinutes:0
 const timed=t.breaks??(clock?clock.breaks??[]:null),rests=timed?.filter((b:any)=>b.kind==='rest')
 const restMinutes=(b:any)=>Math.floor((Date.parse(b.end??captured.end)-Date.parse(b.start))/60000)
 const owed=policy?restsOwed(duration,policy.restEveryMinutes):0
 const requiredBreaks={taken:t.breakMinutes,required:Math.max(automaticMeal,policyMeal),...(policy?{policyMealMinutes:policyMeal,automaticMealMinutes:automaticMeal,waived:Boolean(t.breakWaiver),rest:{taken:rests?rests.reduce((n:number,b:any)=>n+restMinutes(b),0):null,required:owed*policy.restMinutes,count:rests?rests.filter((b:any)=>restMinutes(b)>=policy.restMinutes).length:null,requiredCount:owed}}:{})}
 const running=mine.reduce((n,x)=>n+x.minutes,0),basis=priced(s,t.staffId,{...t,job:t.job??shift?.job??'',site:t.site||shift?.site||person?.site||''})
 return {
  scheduled:shift?{start:shift.start,end:shift.end,minutes:shift.minutes}:null,
  captured,
  payable:{start:t.payable?.start??t.start,end:t.payable?.end??t.end,minutes:t.minutes},
  // Positive start variance is late, negative early; positive end variance stayed past the scheduled end.
  variance:shift?{start:span(shift.start,captured.start),end:span(shift.end,captured.end),minutes:captured.minutes-shift.minutes}:null,
  breaks:requiredBreaks,
  network:t.network??null,photo:null,
  job:s.jobs.find(j=>j.id===(t.job??shift?.job))?.name??person?.position??null,site:shift?siteOf(s,shift):person?.site??'',
  roundingMinutes:t.minutes-captured.minutes,
  exceptions:t.exceptions??[],
  costCents:basis.costCents,
  week:{week,runningMinutes:running,overtimeMinutes:Math.max(0,running-WEEK)},
 }
}
