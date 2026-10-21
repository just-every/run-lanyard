// EARN-001: an employee's own hours and estimated earnings for one workweek, Monday to Sunday on
// the venue calendar (PAY-009 pay schedules replace it). A record counts in the week of its venue
// start date. Approved time over 40 hours in the week is overtime at 1.5x the hourly rate; the
// estimate is approved regular and overtime minutes at that rate, rounded half up to the cent,
// before taxes and deductions. Submitted time is pending and stays out of the estimate. The owner
// turns estimates on or off (on until saved), sets the pay date as days after the week ends and
// links the payroll provider's pay statement, which stays authoritative. Tips (TIPS-001) and
// premiums (PAYRULE-001/002/003, POLICY-001) join the estimate when those clauses ship.
import {type Context,type Row,keys,text,integer,need,put} from './model'
import {holidayEstimate} from './holidays'
import {groupOn,payRange,payPieces,classified} from './payschedules'
import {type State} from './model'
import {localDate} from './settings'

export type EarnSettings={estimates:boolean;statementUrl:string;payDays:number|null}
const WEEK_MINUTES=40*60
const addDays=(date:string,days:number)=>new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10)
const num=(v:unknown)=>typeof v==='string'&&v.trim()!==''?Number(v):v

/** The owner's saved choices, or the defaults: estimates on, no pay date, no statement link. */
export function earnSettings(list:Row[]|any[]):EarnSettings {
 const r=list[0];return {estimates:r?r.estimates!==false:true,statementUrl:r?.statementUrl??'',payDays:typeof r?.payDays==='number'?r.payDays:null}
}

/** One person's week from their own published shifts and timesheets; no coworker row is read. */
export function earningsOf(staffId:string,week:string,tz:string,shifts:any[],timesheets:any[],rateCents:number|null,settings:EarnSettings,state?:State) {
 const holiday=(start:string,end:string)=>{const p=state?holidayEstimate(state,staffId,start,end,new Date().toISOString()):{minutes:0,nonWorkMinutes:0,costCents:0,workedCostCents:0,nonWorkCostCents:0};return settings.estimates?p:{...p,costCents:0,workedCostCents:0,nonWorkCostCents:0}}
 const group=state?groupOn(state,staffId,week):undefined
 if(group&&state){
  const range=payRange(group,week),inside=(d:string)=>range.start<=d&&d<=range.end
  const minutes=(list:any[])=>list.filter(t=>t.staffId===staffId).flatMap(t=>payPieces(state,t)).filter(p=>inside(p.date)).reduce((n,p)=>n+p.minutes,0)
  const approved=timesheets.filter(t=>t.staffId===staffId&&t.status==='approved'),pending=timesheets.filter(t=>t.staffId===staffId&&t.status==='submitted')
  const premium=holiday(range.start,range.end)
  const worked=minutes(approved),overtime=classified(state,staffId).filter(p=>inside(p.date)).reduce((n,p)=>n+p.overtimeMinutes,0),regular=worked-overtime,priced=settings.estimates&&typeof rateCents==='number'
  return {holiday:premium,week:range.start,end:range.end,payDate:range.payDate,statementUrl:settings.statementUrl,scheduledMinutes:minutes(shifts.filter(t=>t.status==='published')),regularMinutes:regular,overtimeMinutes:overtime,pendingMinutes:minutes(pending),approvedIds:approved.map(t=>t.id),pendingIds:pending.map(t=>t.id),estimates:settings.estimates,rateCents:priced?rateCents:null,estimateCents:priced?premium.costCents===null?null:Math.round((regular*rateCents+overtime*rateCents*1.5)/60)+premium.costCents:null}
 }
 const days=[0,1,2,3,4,5,6].map(i=>addDays(week,i)),inWeek=(r:any)=>r.staffId===staffId&&days.includes(localDate(r.start,tz))
 const scheduled=shifts.filter(x=>inWeek(x)&&x.status==='published').reduce((n,x)=>n+Math.round((Date.parse(x.end)-Date.parse(x.start))/60000)-(x.breakMinutes??0),0)
 const approved=timesheets.filter(t=>inWeek(t)&&t.status==='approved'),pending=timesheets.filter(t=>inWeek(t)&&t.status==='submitted')
 const premium=holiday(week,days[6])
 const worked=approved.reduce((n,t)=>n+t.minutes,0),overtime=Math.max(0,worked-WEEK_MINUTES),regular=worked-overtime
 const priced=settings.estimates&&typeof rateCents==='number'
 return {
  holiday:premium,week,end:days[6],payDate:settings.payDays===null?null:addDays(days[6],settings.payDays),statementUrl:settings.statementUrl,
  scheduledMinutes:scheduled,regularMinutes:regular,overtimeMinutes:overtime,pendingMinutes:pending.reduce((n,t)=>n+t.minutes,0),
  approvedIds:approved.map(t=>t.id),pendingIds:pending.map(t=>t.id),estimates:settings.estimates,
  rateCents:priced?rateCents:null,estimateCents:priced?premium.costCents===null?null:Math.round((regular*rateCents+overtime*rateCents*1.5)/60)+premium.costCents:null,
 }
}

export function earnings(c:Context,name:string,p:Record<string,any>) {
 if(name!=='earnings.save')return undefined
 need(c.a.role==='owner','Owner required',403);keys(p,['estimates','statementUrl','payDays','revision'])
 const old=c.s.earnings[0]
 if(old)need(integer(num(p.revision),'revision',1,Number.MAX_SAFE_INTEGER)===old.revision,'Earnings settings changed; reload before saving',409)
 const statementUrl=text(p.statementUrl,'pay statement link',300,true)
 if(statementUrl)need(/^https:\/\/[^\s]+$/.test(statementUrl)&&URL.canParse(statementUrl),'Use an https link to your payroll provider')
 const payDays=p.payDays===undefined||p.payDays===''?null:integer(num(p.payDays),'pay date days',0,31)
 return put(c,'earnings',{estimates:p.estimates===true||p.estimates==='true',statementUrl,payDays,savedBy:c.a.id,savedAt:c.now},old)
}
