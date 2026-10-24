import {policyOn} from './policy'
import {localDate} from './settings'
// BREAK-002: an owner's automatic unpaid meal deduction per cafe. At clock-out with no meal
// recorded on a shift longer than the threshold, the employee confirms the meal (deducted),
// reports it missed or interrupted (full time, flagged for approval), or says nothing
// (deducted and flagged as unconfirmed).
import {type Context,type State,keys,text,integer,need,put} from './model'

export const MEALS=['taken','missed','interrupted']
const num=(v:unknown)=>typeof v==='string'&&v.trim()!==''?Number(v):v

/** The cafe a clock belongs to: its matched shift's cafe, else the person's home cafe. */
export function mealRuleFor(s:State,clock:Record<string,any>) {
 const shift=clock.shiftId?s.shifts.find(x=>x.id===clock.shiftId):undefined,site=shift?.site||s.staff.find(p=>p.id===clock.staffId)?.site||''
 return s.mealrules.find(r=>r.site===site&&r.enabled)
}
/** The break and flags a clock-out records; `entered` is the meal minutes the employee recorded. */
export function mealAtClockOut(s:State,clock:Record<string,any>,end:string,entered:number,meal:unknown,now:string) {
 const rule=mealRuleFor(s,clock),site=s.shifts.find(x=>x.id===clock.shiftId)?.site||s.staff.find(x=>x.id===clock.staffId)?.site||''
 if(policyOn(s,site,localDate(clock.start,s.timezone))?.preset==='CA')return {breakMinutes:entered,exceptions:[] as string[]}
 const span=Math.floor((Date.parse(end)-Date.parse(clock.start))/60000)
 if(!rule||entered>0||span<=rule.afterMinutes)return {breakMinutes:entered,exceptions:[] as string[]}
 need(meal===undefined||MEALS.includes(meal as string),'Say whether you took your meal')
 const deduction={minutes:rule.deductMinutes,answer:(meal as string|undefined)??null,at:now,ruleId:rule.id}
 if(meal==='taken')return {breakMinutes:rule.deductMinutes,exceptions:[],deduction}
 if(meal==='missed'||meal==='interrupted')return {breakMinutes:0,exceptions:[`${meal} meal`],deduction:{...deduction,reversed:true}}
 return {breakMinutes:rule.deductMinutes,exceptions:['unconfirmed meal deduction'],deduction}
}

export function mealRules(c:Context,name:string,p:Record<string,any>) {
 if(name!=='mealrule.save')return undefined
 need(c.a.role==='owner','Owner required',403);keys(p,['site','afterMinutes','deductMinutes','enabled','revision'])
 const site=text(p.site,'site',80,true),old=c.s.mealrules.find(r=>r.site===site)
 if(old)need(integer(p.revision,'revision',1,Number.MAX_SAFE_INTEGER)===old.revision,'Meal deduction changed; reload before saving',409)
 need(!(p.enabled===true||p.enabled==='true')||!c.s.policies.some(r=>r.site===site&&r.preset==='CA'),'California policy requires recorded meal periods; automatic meal deduction is refused',409)
 const afterMinutes=integer(num(p.afterMinutes),'shift length',60,1440),deductMinutes=integer(num(p.deductMinutes),'deduction',1,120)
 need(deductMinutes<afterMinutes,'The deduction must be shorter than the shift it applies to')
 return put(c,'mealrules',{site,afterMinutes,deductMinutes,enabled:p.enabled===true||p.enabled==='true',savedBy:c.a.id,savedAt:c.now},old)
}
