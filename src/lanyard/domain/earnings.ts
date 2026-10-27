import {differentialEstimate} from './differentials'
// EARN-001: own approved hours use POLICY-001's complete workweek classification
// and retained rates. Pay groups keep their period windows. Break-review estimates
// stay outside pay; the provider's regular-rate treatment remains authoritative.
import {type Context,type Row,keys,text,integer,need,put} from './model'
import {premiumEstimate} from './premiums'
import {holidayEstimate} from './holidays'
import {groupOn,payRange,payPieces,workweek} from './payschedules'
import {policyClassification} from './policy'
import {type State} from './model'
import {localDate} from './settings'

export type EarnSettings={estimates:boolean;statementUrl:string;payDays:number|null}
const addDays=(date:string,days:number)=>new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10)
const num=(v:unknown)=>typeof v==='string'&&v.trim()!==''?Number(v):v

/** The owner's saved choices, or the defaults: estimates on, no pay date, no statement link. */
export function earnSettings(list:Row[]|any[]):EarnSettings {
 const r=list[0];return {estimates:r?r.estimates!==false:true,statementUrl:r?.statementUrl??'',payDays:typeof r?.payDays==='number'?r.payDays:null}
}

/** Compute only on the server, before policy and retained wage inputs are redacted. */
export function earningsOf(staffId:string,week:string,tz:string,shifts:any[],timesheets:any[],rateCents:number|null,settings:EarnSettings,state?:State) {
 need(state,'Complete earnings inputs are required',500)
 const group=groupOn(state,staffId,week),range=group?payRange(group,week):{start:week,end:addDays(week,6),payDate:settings.payDays===null?null:addDays(week,6+settings.payDays)}
 const inside=(date:string)=>date>=range.start&&date<=range.end
 // Unassigned records keep EARN-001's venue-start-date window. Grouped periods
 // slice retained allocations by venue date, including a partial workweek.
 const eligible=(t:any)=>t.staffId===staffId&&(!!group||inside(localDate(t.start,tz)))
 const approved=timesheets.filter(t=>eligible(t)&&t.status==='approved'),pending=timesheets.filter(t=>eligible(t)&&t.status==='submitted')
 const pieces=(list:any[])=>list.flatMap(t=>payPieces(state,t)).filter(p=>!group||inside(p.date))
 const minutes=(list:any[])=>pieces(list).reduce((n,p)=>n+p.minutes,0)
 const approvedIds=new Set(approved.map(t=>t.id)),weeks=[...new Set(pieces(approved).map(p=>workweek(state,staffId,p.date)))]
 const reports=weeks.map(w=>policyClassification(state,staffId,w))
 const parts=reports.flatMap(report=>report.parts.filter((p:any)=>approvedIds.has(p.timeId)&&(!group||inside(p.date))).map((p:any)=>({...p,weightedRateCents:report.weightedRateCents})))
 const total=(key:string)=>parts.reduce((n,p)=>n+p[key],0),regularMinutes=total('regularMinutes'),overtimeMinutes=total('overtimeMinutes'),doubleMinutes=total('doubleMinutes')
 const priced=settings.estimates&&typeof rateCents==='number'
 const known=reports.every(r=>!r.classificationIncomplete)&&parts.every(p=>p.cents!==null&&p.weightedRateCents!==null)
 // Retained straight-time earnings plus the weighted workweek premium. Work
 // outside a split pay period establishes overtime without being paid twice.
 const buckets=[['regularMinutes',0],['overtimeMinutes',.5],['doubleMinutes',1]] as const
 const raw=buckets.map(([key,premium])=>parts.reduce((n,p)=>n+p[key]*(p.cents+premium*p.weightedRateCents),0)/60)
 const workedCostCents=priced&&known?Math.round(raw.reduce((n,v)=>n+v,0)):null
 const rounded=raw.map(Math.floor)
 if(workedCostCents!==null){let left=workedCostCents-rounded.reduce((n,v)=>n+v,0)
  for(const i of [0,1,2].sort((a,b)=>(raw[b]-rounded[b])-(raw[a]-rounded[a])||a-b))if(left-->0)rounded[i]++
 }
 const [regularCostCents,overtimeCostCents,doubleCostCents]=rounded.map(v=>workedCostCents===null?null:v)
 const uses=state.sickuses.filter(u=>u.staffId===staffId&&u.status==='approved'&&u.paid!==false&&inside(u.date)),diff=differentialEstimate(state,staffId,range.start,range.end),holiday=holidayEstimate(state,staffId,range.start,range.end,new Date().toISOString()),extra=premiumEstimate(state,staffId,range.start,range.end)
 // Only totals cross the employee boundary: no rule records, source facts,
 // retained rate references, policy revisions or another person's records.
 const paidLeave={minutes:uses.reduce((n,u)=>n+u.minutes,0),costCents:priced?uses.reduce((n,u)=>n+(u.costCents??0),0):null}
 const differential={minutes:diff.minutes,costCents:priced?diff.costCents:null}
 const jurisdiction={minutes:extra.minutes,costCents:priced?extra.costCents:null}
 const premium={minutes:holiday.minutes,nonWorkMinutes:holiday.nonWorkMinutes,costCents:priced?holiday.costCents:null,workedCostCents:priced?holiday.workedCostCents:null,nonWorkCostCents:priced?holiday.nonWorkCostCents:null}
 return {
  requestedWeek:week,week:range.start,end:range.end,payDate:range.payDate,statementUrl:settings.statementUrl,
  scheduledMinutes:minutes(shifts.filter(t=>eligible(t)&&t.status==='published')),regularMinutes,overtimeMinutes,doubleMinutes,pendingMinutes:minutes(pending),
  policyReviewRequired:reports.some(r=>r.classificationIncomplete),approvedIds:approved.map(t=>t.id),pendingIds:pending.map(t=>t.id),estimates:settings.estimates,rateCents:priced?rateCents:null,
  regularCostCents,overtimeCostCents,doubleCostCents,paidLeave,differential,jurisdiction,holiday:premium,
  estimateCents:workedCostCents===null||premium.costCents===null||diff.costCents===null?null:workedCostCents+premium.costCents+extra.costCents+diff.costCents+paidLeave.costCents!,
 }
}
export type EarningsEstimate=ReturnType<typeof earningsOf>

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
