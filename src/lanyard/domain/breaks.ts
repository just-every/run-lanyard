// BREAK-001: timed paid rest and unpaid meal breaks on the phone clock, and the owner's break
// policy per cafe. Clock-out checks the punch's timed breaks against the policy: a missed, short
// or late meal and missed or short rest breaks become exceptions on the timesheet, with premium
// pay inputs when the policy pays them. Only timed unpaid meal minutes reduce worked time.
import {type Context,type Row,type State,keys,text,integer,need,put,instant,self} from './model'
import {siteOf} from './team'

export const KINDS=['meal','rest']
export const WAIVER='I chose to waive my meal break on this shift.'
export const ATTEST_BREAKS='I confirm my breaks on this shift are recorded accurately.'
type Break={kind:string;start:string;end:string|null}
type Worked={start:string;end:string;breakMinutes:number}
const num=(v:unknown)=>typeof v==='string'&&v.trim()!==''?Number(v):v
const mins=(a:string,b:string)=>Math.floor((Date.parse(b)-Date.parse(a))/60000)

/** The cafe's rule: the punch's matched shift's cafe, else the person's home cafe. */
export function breakRuleFor(s:State,staffId:string,shiftId?:string|null) {
 const shift=shiftId?s.shifts.find(x=>x.id===shiftId):undefined,site=shift?siteOf(s,shift):s.staff.find(p=>p.id===staffId)?.site??''
 return s.breakrules.find(r=>r.site===site)
}
/** Rest breaks owed: one per full `every` minutes worked, plus one when the remainder is longer than half of `every`. */
export const restsOwed=(span:number,every:number)=>every?Math.floor(span/every)+(span%every>every/2?1:0):0

/**
 * The policy check for worked time. `timed` is the punch's timed breaks (an empty list for a punch
 * that timed none); without it only the recorded meal minutes are known, so meals are checked by
 * duration and rest is unknown (null). A meal is due when the span is longer than `mealAfterMinutes`
 * and must start by that worked minute and last `mealMinutes`; a shift up to `waiveUpTo` minutes may
 * waive it by the employee's own attestation. Premiums: one hour per timesheet for a meal exception,
 * one for a rest exception, when the rule pays them.
 */
export function checkBreaks(s:State,staffId:string,shiftId:string|null|undefined,w:Worked,timed?:Break[],waived=false) {
 const rule=breakRuleFor(s,staffId,shiftId);if(!rule)return null
 const span=mins(w.start,w.end),dur=(b:Break)=>mins(b.start,b.end??w.end),meals=(timed??[]).filter(b=>b.kind==='meal')
 let meal:string|null=null,waiver=false
 if(span>rule.mealAfterMinutes) {
  const latest=Date.parse(w.start)+rule.mealAfterMinutes*60000
  if(meals.length){if(!meals.some(b=>dur(b)>=rule.mealMinutes&&Date.parse(b.start)<=latest))meal=meals.some(b=>dur(b)>=rule.mealMinutes)?'late meal break':'short meal break'}
  else if(w.breakMinutes<rule.mealMinutes)meal=w.breakMinutes===0?'missed meal break':'short meal break'
  if(meal&&waived&&span<=rule.waiveUpTo){meal=null;waiver=true}
 }
 let rest:string|null|undefined=undefined
 if(timed){const owed=restsOwed(span,rule.restEveryMinutes),rests=timed.filter(b=>b.kind==='rest'),full=rests.filter(b=>dur(b)>=rule.restMinutes).length;rest=full>=owed?null:rests.length>full?'short rest break':'missed rest break'}
 return {rule,meal,rest,waiver}
}
/** Exceptions and premiums after a check; an unknown rest result keeps the earlier rest exception and premium. */
export function breakOutcome(check:ReturnType<typeof checkBreaks>,before:Row|Record<string,any>={}):{exceptions?:string[];premiums?:{code:string;minutes:number}[]} {
 if(!check)return before.exceptions?.length?{exceptions:before.exceptions}:{}
 const exceptions=[...(before.exceptions??[])],add=(e:string|null|undefined)=>{if(e&&!exceptions.includes(e))exceptions.push(e)}
 add(check.meal);add(check.rest)
 const earlierRest=(before.premiums??[]).filter((p:any)=>p.code==='rest premium')
 const premiums=check.rule.premium?[...(check.meal?[{code:'meal premium',minutes:60}]:[]),...(check.rest===undefined?earlierRest:check.rest?[{code:'rest premium',minutes:60}]:[])]:[]
 return {...(exceptions.length?{exceptions}:{}),premiums}
}
/** Total minutes of finished timed meal breaks: the unpaid time a punch records. */
export const mealMinutes=(timed:Break[]|undefined,end:string)=>(timed??[]).filter(b=>b.kind==='meal').reduce((n,b)=>n+mins(b.start,b.end??end),0)
/** Timed breaks still describe edited time only when its meal minutes match them. */
export const timedFor=(r:Record<string,any>,breakMinutes:number)=>r.breaks&&mealMinutes(r.breaks,r.end)===breakMinutes?r.breaks:undefined

export function breaks(c:Context,name:string,p:Record<string,any>) {
 if(name==='breakrule.save') {
  need(c.a.role==='owner','Owner required',403);keys(p,['site','mealAfterMinutes','mealMinutes','waiveUpTo','restEveryMinutes','restMinutes','premium','revision'])
  const site=text(p.site,'site',80,true),old=c.s.breakrules.find(r=>r.site===site)
  if(old)need(integer(p.revision,'revision',1,Number.MAX_SAFE_INTEGER)===old.revision,'Break policy changed; reload before saving',409)
  const mealAfterMinutes=integer(num(p.mealAfterMinutes),'meal due by (minutes worked)',60,1440),mealMinutes=integer(num(p.mealMinutes),'meal length',10,120)
  const waiveUpTo=integer(num(p.waiveUpTo??0),'waiver limit',0,1440),restEveryMinutes=integer(num(p.restEveryMinutes??0),'rest interval',0,720),restMinutes=integer(num(p.restMinutes??10),'rest length',5,60)
  need(restEveryMinutes===0||restEveryMinutes>=60,'Rest breaks are owed at most once an hour')
  return put(c,'breakrules',{site,mealAfterMinutes,mealMinutes,waiveUpTo,restEveryMinutes,restMinutes,premium:p.premium===true||p.premium==='true',savedBy:c.a.id,savedAt:c.now},old)
 }
 if(name==='clock.breakStart'||name==='clock.breakEnd') {
  keys(p,name==='clock.breakStart'?['commandId','capturedAt','kind']:['commandId','capturedAt']);const staffId=self(c.a),at=instant(p.capturedAt,'capturedAt');need(Date.parse(at)<=Date.parse(c.now)+60000,'Break capture cannot be in the future')
  const open=c.s.clocks.find(r=>r.staffId===staffId&&r.status==='open');need(open,'Clock in before taking a break',409)
  const list:Break[]=open.breaks??[],last=list[list.length-1]
  if(name==='clock.breakStart') {
   const kind=text(p.kind,'break kind',10);need(KINDS.includes(kind),'Choose a meal or rest break');need(!last||last.end,'You are already on a break',409)
   need(at>=open.start&&(!last||at>=last.end!),'A break cannot start before your clock-in or your last break',409)
   need((open.transfers??[]).every((t:any)=>at>=t.at),'A break follows your last job change',409)
   return put(c,'clocks',{...open,breaks:[...list,{kind,start:at,end:null,receivedAt:c.now}]},open)
  }
  need(last&&!last.end,'You are not on a break',409);need(at>last.start,'A break ends after it starts',409)
  return put(c,'clocks',{...open,breaks:[...list.slice(0,-1),{...last,end:at,endReceivedAt:c.now}]},open)
 }
 return undefined
}
