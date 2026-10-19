// TIME-006: the owner's clock-in rules per cafe and position. A clock-in is compared with
// the person's published schedule at its captured time: too early is refused (naming when
// clock-in opens) or accepted and flagged; a punch with no shift is refused, accepted
// pending approval (flagged) or allowed. Flags travel to the timesheet as exceptions.
import {type Context,type State,keys,text,integer,need,fail,put} from './model'

const EARLY=['any','refuse','flag'],UNSCHEDULED=['allow','pending','refuse'],HORIZON=12*3600000
export type Rule={site:string;position:string;early:string;earlyMinutes:number;unscheduled:string}
const OPEN:Rule={site:'',position:'',early:'any',earlyMinutes:0,unscheduled:'allow'}

/** The most specific rule: this cafe and position, else the whole cafe, else no limits. */
export function ruleFor(s:State,site:string,position:string):Rule {
 const rules=s.clockrules as unknown as Rule[]
 return rules.find(r=>r.site===site&&r.position===position&&position!=='')??rules.find(r=>r.site===site&&r.position==='')??OPEN
}
const wall=(at:number,tz:string)=>new Intl.DateTimeFormat('en-US',{timeZone:tz,hour:'numeric',minute:'2-digit'}).format(new Date(at)).replace(/\s?([AP])M/,(_,m)=>` ${m.toLowerCase()}m`)

/**
 * The punch's shift is the person's published shift in progress at the captured time, else
 * the earliest one starting within 12 hours after it; none means the punch is unscheduled.
 */
export function checkClockIn(s:State,staffId:string,at:string):{shiftId:string|null;exceptions:string[]} {
 const person=s.staff.find(p=>p.id===staffId),t=Date.parse(at)
 const shift=s.shifts.filter(x=>x.staffId===staffId&&x.status==='published'&&Date.parse(x.end)>t&&Date.parse(x.start)-t<=HORIZON).sort((a,b)=>a.start.localeCompare(b.start))[0]
 const rule=ruleFor(s,shift?.site||person?.site||'',person?.position??'')
 if(!shift) {
  if(rule.unscheduled==='refuse')fail('No scheduled shift: clock-in without a shift is not allowed here. Ask a manager to record your time.',409)
  return {shiftId:null,exceptions:rule.unscheduled==='pending'?['unscheduled punch']:[]}
 }
 const opens=Date.parse(shift.start)-rule.earlyMinutes*60000
 if(rule.early==='any'||t>=opens)return {shiftId:shift.id,exceptions:[]}
 if(rule.early==='refuse')fail(`Too early: clock-in opens at ${wall(opens,s.timezone)}, ${rule.earlyMinutes} minutes before your ${wall(Date.parse(shift.start),s.timezone)} shift.`,409)
 return {shiftId:shift.id,exceptions:['early clock-in']}
}

export function clockRules(c:Context,name:string,p:Record<string,any>) {
 if(name!=='clockrule.save')return undefined
 need(c.a.role==='owner','Owner required',403);keys(p,['site','position','early','earlyMinutes','unscheduled','revision'])
 const site=text(p.site,'site',80,true),position=text(p.position,'position',80,true),old=c.s.clockrules.find(r=>r.site===site&&r.position===position)
 if(old)need(integer(p.revision,'revision',1,Number.MAX_SAFE_INTEGER)===old.revision,'Clock-in rule changed; reload before saving',409)
 need(EARLY.includes(p.early),'Choose how early clock-in is handled');need(UNSCHEDULED.includes(p.unscheduled),'Choose how a clock-in without a shift is handled')
 const earlyMinutes=p.early==='any'?0:integer(typeof p.earlyMinutes==='string'?Number(p.earlyMinutes):p.earlyMinutes,'early minutes',0,720)
 return put(c,'clockrules',{site,position,early:p.early,earlyMinutes,unscheduled:p.unscheduled,savedBy:c.a.id,savedAt:c.now},old)
}
