// TIME-005: the owner's punch rounding per cafe, effective from a venue date. Nearest rounding
// moves each punch to the nearest 5-, 6- or 15-minute mark on the venue clock face, an exact half
// rounding up. Snap-to-schedule moves a late arrival within the window to the scheduled start and
// an early or late departure within the window to the scheduled end; early arrivals are never
// snapped (every accepted early clock-in is permitted or approved under TIME-006). Only phone-clock
// time is rounded, never manual entries or corrections. The timesheet keeps its captured start and
// end; its minutes become the payable minutes, which approval, payroll and EARN-001 pay.
import {type Context,type State,type Row,keys,text,integer,need,fail,put} from './model'
import {localDate,wall} from './settings'

export const METHODS=['nearest','snap'],INCREMENTS=[5,6,15],APPLY=['capture','approval']
export type Rule={site:string;from:string;method:string;increment:number;window:number;apply:string}
const num=(v:unknown)=>typeof v==='string'&&v.trim()!==''?Number(v):v

/** The cafe's rule in effect on a venue date: the latest one starting on or before it. */
export function roundRuleFor(s:State,site:string,date:string):(Rule&Row)|undefined {
 return (s.roundrules as (Rule&Row)[]).filter(r=>r.site===site&&r.from<=date).sort((a,b)=>b.from.localeCompare(a.from))[0]
}
/** An instant moved to the nearest increment on the venue clock face (half up). */
function nearest(at:string,increment:number,tz:string) {
 const t=Date.parse(at),w=wall(t,tz),offset=Date.parse(`${w.date}T${w.time}:00Z`)-Math.floor(t/60000)*60000,size=increment*60000
 const local=t+offset;return new Date(Math.floor((local+size/2)/size)*size-offset).toISOString()
}
function snap(at:string,target:string|undefined,window:number,arrival:boolean) {
 if(!target)return at
 const d=Date.parse(at)-Date.parse(target)
 if(arrival)return d>0&&d<=window*60000?target:at
 return Math.abs(d)<=window*60000?target:at
}
/** The payable span and minutes of one clocked span under a rule snapshot. */
export function payable(rule:Rule,start:string,end:string,breakMinutes:number,tz:string,shift?:Row) {
 const ps=rule.method==='nearest'?nearest(start,rule.increment,tz):snap(start,shift?.start,rule.window,true)
 const pe=rule.method==='nearest'?nearest(end,rule.increment,tz):snap(end,shift?.end,rule.window,false)
 const minutes=Math.floor((Date.parse(pe)-Date.parse(ps))/60000)-breakMinutes
 return minutes>0?{start:ps,end:pe,minutes}:null
}
/** The rule snapshot a phone-clock timesheet carries, and its payable time when rounded at capture. */
export function roundAtCapture(s:State,clock:Row,end:string,breakMinutes:number,minutes:number) {
 const shift=clock.shiftId?s.shifts.find(x=>x.id===clock.shiftId):undefined,site=shift?.site||s.staff.find(p=>p.id===clock.staffId)?.site||''
 const found=roundRuleFor(s,site,localDate(clock.start,s.timezone));if(!found)return {}
 const rule:Rule={site:found.site,from:found.from,method:found.method,increment:found.increment,window:found.window,apply:found.apply}
 const paid=rule.apply==='capture'?payable(rule,clock.start,end,breakMinutes,s.timezone,shift):null
 return {rounding:{...rule,ruleId:found.id,ruleRevision:found.revision,capturedMinutes:minutes},...(paid?{payable:{start:paid.start,end:paid.end},minutes:paid.minutes}:{})}
}
/** At approval, a timesheet whose rule rounds at approval gets its payable time first. */
export function roundAtApproval(s:State,r:Row):Row {
 if(!r.rounding||r.payable||r.rounding.apply!=='approval')return r
 const clock=s.clocks.find(c=>c.id===r.clockId),shift=clock?.shiftId?s.shifts.find(x=>x.id===clock.shiftId):undefined
 const paid=payable(r.rounding,r.start,r.end,r.breakMinutes,s.timezone,shift)
 return paid?{...r,payable:{start:paid.start,end:paid.end},minutes:paid.minutes}:r
}
/** Per employee, the net minutes rounding added (+) or removed (−) on these timesheets. */
export function neutrality(timesheets:any[]) {
 const net=new Map<string,number>()
 for(const t of timesheets)if(t.payable&&t.status!=='superseded')net.set(t.staffId,(net.get(t.staffId)??0)+t.minutes-t.rounding.capturedMinutes)
 return net
}

export function rounding(c:Context,name:string,p:Record<string,any>) {
 if(name!=='roundrule.save')return undefined
 need(c.a.role==='owner','Owner required',403);keys(p,['site','from','method','increment','window','apply','direction','revision'])
 // Rounding must be neutral: a rule that only rounds down (or only up) is refused at setup.
 if(p.direction==='down')fail('A rule that only reduces paid time is not allowed: rounding must go both up and down')
 need(p.direction===undefined||p.direction===''||p.direction==='both','Rounding must go both up and down')
 const site=text(p.site,'site',80,true),from=text(p.from,'effective date',10)
 need(/^\d{4}-\d{2}-\d{2}$/.test(from)&&new Date(from+'T00:00:00Z').toISOString().slice(0,10)===from,'Invalid effective date')
 need(METHODS.includes(p.method),'Choose nearest rounding or snap-to-schedule');need(APPLY.includes(p.apply),'Choose when rounding applies')
 const increment=p.method==='nearest'?integer(num(p.increment),'increment',1,60):0,window=p.method==='snap'?integer(num(p.window),'window',1,30):0
 if(p.method==='nearest')need(INCREMENTS.includes(increment),'Round to 5 minutes, a tenth of an hour (6) or a quarter hour (15)')
 const old=c.s.roundrules.find(r=>r.site===site&&r.from===from)
 if(old)need(integer(num(p.revision),'revision',1,Number.MAX_SAFE_INTEGER)===old.revision,'Rounding rule changed; reload before saving',409)
 return put(c,'roundrules',{site,from,method:p.method,increment,window,apply:p.apply,savedBy:c.a.id,savedAt:c.now},old)
}
