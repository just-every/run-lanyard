// DEMAND-001: a cafe's hourly sales forecast and required staffing by role, from the hourly sales entered
// under SALES-001 (labelled Manual), employer events and assumptions. The estimate for an hour is the mean of
// that hour on the same weekday over the prior weeks (event days are left out), widened by one standard
// deviation each way and moved by the cafe's growth and the day's event uplift. A forecast is incomplete,
// never guessed, when no hourly history exists, the latest entered sales are older than the stale threshold,
// or an hour has some history but fewer samples than needed. Role demand is the larger of the role's minimum
// and sales over its sales-per-labor-hour assumption, only for hours with forecast sales. Saved versions are
// immutable; a reasoned override of an hour makes a new version. Nothing here writes shifts or worked time.
import {type Actor,type Context,type State,keys,text,integer,need,manager,put,canonical,sha} from './model'
import {localDate} from './settings'
import {salesSite} from './sales'

export const DEMAND_DEFAULTS={historyWeeks:4,minSamples:2,staleDays:3,growthPercent:0}
const isDate=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v
export const datePlus=(date:string,n:number)=>new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10)
const num=(v:unknown)=>typeof v==='string'&&v.trim()!==''?Number(v):v
const dollars=(v:unknown,label:string)=>{const t=typeof v==='number'?String(v):text(v,label,20).replace(/[$,\s]/g,'');need(/^\d+(\.\d{1,2})?$/.test(t),`Invalid ${label}: dollars and cents`);return Math.round(Number(t)*100)}
const lines=(v:unknown,label:string):any[]=>{
 if(v===undefined||v===null||v==='')return []
 if(Array.isArray(v))return v
 need(typeof v==='string','Invalid '+label);return v.split('\n').map(x=>x.trim()).filter(Boolean).map(x=>x.split('|').map(y=>y.trim()))
}
type Role={position:string;salesPerLaborHourCents:number;minStaff:number}
type Event={date:string;name:string;upliftPercent:number}
export type DemandHour={hour:number;time:string;samples:number;sampleDates:string[];baseCents:number|null;lowCents:number|null;highCents:number|null;confidence:string;override:null|{cents:number;computedCents:number|null;reason:string;by:string;at:string};salesCents:number|null;roles:{position:string;requiredMinutes:number;headcount:number}[]|null}

function parseEvents(v:unknown):Event[] {
 const out=lines(v,'events').map(x=>Array.isArray(x)?{date:x[0],name:x[1],upliftPercent:x[2]}:x)
 need(out.length<=60,'At most 60 events')
 const events=out.map((x:any)=>{need(isDate(x.date),'Invalid event date: use YYYY-MM-DD');return {date:x.date as string,name:text(x.name,'event name',80),upliftPercent:integer(num(String(x.upliftPercent??'').replace('%','').replace('+','')),'event uplift %',-100,500)}})
 need(new Set(events.map(e=>e.date)).size===events.length,'One event per date')
 return events.sort((a,b)=>a.date.localeCompare(b.date))
}
function parseRoles(v:unknown):Role[] {
 const out=lines(v,'roles').map(x=>Array.isArray(x)?{position:x[0],salesPerLaborHour:x[1],minStaff:x[2]}:x)
 need(out.length<=20,'At most 20 roles')
 const roles=out.map((x:any)=>({position:text(x.position,'role',80),salesPerLaborHourCents:x.salesPerLaborHourCents??dollars(x.salesPerLaborHour,'sales per labor hour'),minStaff:integer(num(x.minStaff===undefined||x.minStaff===''?0:x.minStaff),'minimum staff',0,50)}))
 need(roles.every(r=>Number.isSafeInteger(r.salesPerLaborHourCents)&&r.salesPerLaborHourCents>0),'Sales per labor hour must be above zero')
 need(new Set(roles.map(r=>r.position.toLowerCase())).size===roles.length,'One line per role')
 return roles
}
export function demandRule(c:Context,name:string,p:Record<string,any>) {
 if(name!=='demandrule.save')return undefined
 manager(c.a);keys(p,['site','revision','historyWeeks','minSamples','staleDays','growthPercent','events','roles'])
 const site=text(p.site,'site',80,true);need(salesSite(c.s,c.a,site),'You do not set demand assumptions for this cafe',403)
 const old=c.s.demandrules.find(r=>r.site===site)
 if(old)need(Number(p.revision)===old.revision,'Demand assumptions changed; reload before saving',409)
 const pick=(k:keyof typeof DEMAND_DEFAULTS,min:number,max:number)=>p[k]===undefined||p[k]===''?DEMAND_DEFAULTS[k]:integer(num(p[k]),k,min,max)
 const historyWeeks=pick('historyWeeks',1,12),minSamples=pick('minSamples',1,12);need(minSamples<=historyWeeks,'Minimum samples cannot exceed the weeks of history')
 return put(c,'demandrules',{site,historyWeeks,minSamples,staleDays:pick('staleDays',0,60),growthPercent:pick('growthPercent',-50,200),events:parseEvents(p.events),roles:parseRoles(p.roles),savedBy:c.a.id,savedAt:c.now},old)
}
const rulesOf=(s:State,site:string)=>{const r=s.demandrules.find(x=>x.site===site);return {revision:r?.revision??0,...DEMAND_DEFAULTS,events:[] as Event[],roles:[] as Role[],...(r?Object.fromEntries(Object.entries(r).filter(([k])=>['historyWeeks','minSamples','staleDays','growthPercent','events','roles'].includes(k))):{})}}
export const staffing=(roles:Role[],cents:number)=>roles.map(r=>{const minutes=Math.round(Math.max(r.minStaff*60,cents*60/r.salesPerLaborHourCents));return {position:r.position,requiredMinutes:minutes,headcount:Math.round(minutes/6)/10}})
const spread=(values:number[])=>{const mean=values.reduce((n,v)=>n+v,0)/values.length;return {mean,sd:Math.sqrt(values.reduce((n,v)=>n+(v-mean)**2,0)/values.length)}}

/** The status and per-hour role demand of a set of hours: only a complete forecast produces required staffing. */
export function finish(hours:DemandHour[],reasons:string[],roles:Role[],minSamples:number) {
 const partial=hours.filter(x=>!x.override&&x.samples>0&&x.samples<minSamples)
 const all=[...reasons,...partial.map(x=>`${x.time}: ${x.samples} prior ${x.samples===1?'day':'days'} of sales, ${minSamples} needed`)]
 const complete=all.length===0
 return {status:complete?'complete':'incomplete',reasons:all,hours:hours.map(x=>({...x,salesCents:x.override?.cents??x.baseCents,roles:complete&&roles.length&&(x.override?.cents??x.baseCents)?staffing(roles,x.override?.cents??x.baseCents!):complete&&(x.override?.cents??x.baseCents)!==null?[]:null}))}
}
export function demandCompute(s:State,site:string,date:string,asOf:string) {
 const rule=rulesOf(s,site),today=localDate(asOf,s.timezone),weekday=new Date(date+'T12:00:00Z').getUTCDay()
 const event=rule.events.find(e=>e.date===date)??null,skip=new Set(rule.events.map(e=>e.date))
 const hourly=s.sales.filter(r=>r.site===site&&r.metric==='sales'&&r.hour!==null)
 const last=hourly.map(r=>r.date).sort().at(-1)??null
 const dates=Array.from({length:rule.historyWeeks},(_,i)=>datePlus(date,-7*(i+1))).filter(d=>d<today&&!skip.has(d))
 const factor=(1+rule.growthPercent/100)*(1+(event?.upliftPercent??0)/100)
 const sources:string[]=[]
 const raw:DemandHour[]=Array.from({length:24},(_,hour)=>{
  const found=dates.map(d=>({d,rows:hourly.filter(r=>r.date===d&&r.hour===hour)})).filter(x=>x.rows.length)
  for(const x of found)for(const r of x.rows)sources.push(`${r.id}:${r.revision}`)
  const values=found.map(x=>x.rows.reduce((n,r)=>n+r.value,0)),n=values.length
  const {mean,sd}=n?spread(values):{mean:0,sd:0}
  const enough=n>=rule.minSamples,cv=mean>0?sd/mean:sd===0?0:1
  return {hour,time:`${String(hour).padStart(2,'0')}:00`,samples:n,sampleDates:found.map(x=>x.d),baseCents:enough?Math.round(mean*factor):null,lowCents:enough?Math.max(0,Math.round((mean-sd)*factor)):null,highCents:enough?Math.round((mean+sd)*factor):null,
   confidence:!enough?'unknown':n>=4&&cv<=0.15?'high':cv<=0.35?'medium':'low',override:null,salesCents:null,roles:null}
 })
 const reasons:string[]=[]
 if(!hourly.length)reasons.push('no hourly sales have been entered for this cafe')
 else if(last!==null&&(Date.parse(today+'T00:00:00Z')-Date.parse(last+'T00:00:00Z'))/86400000>rule.staleDays)reasons.push(`stale inputs: the latest hourly sales entered are for ${last}, more than ${rule.staleDays} days before ${today}`)
 else if(!raw.some(x=>x.samples>0))reasons.push('no entered hourly sales on prior '+['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][weekday]+'s')
 const done=finish(raw,reasons,rule.roles,rule.minSamples)
 const known=done.hours.filter(x=>x.salesCents!==null)
 const byRole:Record<string,number>={}
 for(const x of done.hours)for(const r of x.roles??[])byRole[r.position]=(byRole[r.position]??0)+r.requiredMinutes
 return {site,date,weekday,asOf,source:'Manual (SALES-001)',...done,
  assumptions:{ruleRevision:rule.revision,historyWeeks:rule.historyWeeks,minSamples:rule.minSamples,staleDays:rule.staleDays,growthPercent:rule.growthPercent,event,roles:rule.roles,noStaffingAssumptions:!rule.roles.length},
  inputs:{lastSalesDate:last,sampleDates:[...new Set(raw.flatMap(x=>x.sampleDates))].sort(),sources:sources.sort()},
  totals:{salesCents:known.length?known.reduce((n,x)=>n+x.salesCents!,0):null,requiredMinutes:done.status==='complete'?Object.values(byRole).reduce((n,v)=>n+v,0):null,byRole:done.status==='complete'?byRole:null}}
}
export type Demand=ReturnType<typeof demandCompute>
export const digestOf=(f:Demand)=>sha(canonical({site:f.site,date:f.date,assumptions:f.assumptions,inputs:f.inputs,status:f.status,hours:f.hours.map(x=>[x.hour,x.baseCents,x.samples])}))
/** The cafes this person forecasts for are the cafes they enter sales for. */
export const demandScope=(s:State,a:Actor,site:string)=>salesSite(s,a,site)
export const savedVersions=(s:State,site:string,date:string)=>s.demandforecasts.filter(r=>r.site===site&&r.date===date).sort((a,b)=>b.version-a.version)

export async function demandCommand(c:Context,name:string,p:Record<string,any>) {
 if(name==='demand.save') {
  manager(c.a);keys(p,['site','date','digest'])
  const site=text(p.site,'site',80,true),date=text(p.date,'date',10);need(isDate(date),'Invalid date: use YYYY-MM-DD');need(demandScope(c.s,c.a,site),'You do not forecast for this cafe',403)
  need(date>=localDate(c.now,c.s.timezone),'Forecast today or a future day')
  const f=demandCompute(c.s,site,date,c.now),digest=await digestOf(f)
  need(digest===text(p.digest,'digest',64),'The sales, assumptions or day changed since this forecast was reviewed; review it again',409)
  const old=savedVersions(c.s,site,date)[0]
  return put(c,'demandforecasts',{...f,version:(old?.version??0)+1,digest,kind:'computed',supersedes:old?.id??null,overrides:old?.overrides??{},savedBy:c.a.id,savedAt:c.now})
 }
 if(name==='demand.override') {
  manager(c.a);keys(p,['id','revision','hour','dollars','reason'])
  const old=c.s.demandforecasts.find(r=>r.id===p.id);need(old,'Forecast not found',404);need(demandScope(c.s,c.a,old.site),'Not found',404)
  need(Number(p.revision)===old.revision&&savedVersions(c.s,old.site,old.date)[0].id===old.id,'A newer forecast version exists; reload before overriding',409)
  need(old.date>=localDate(c.now,c.s.timezone),'Override today or a future day')
  const hour=integer(num(p.hour),'hour',0,23),reason=text(p.reason,'reason',280),cents=dollars(p.dollars,'sales')
  const computed=old.hours[hour].baseCents,previous=old.hours[hour].override
  need(cents!==(previous?.cents??computed),'Nothing to override')
  const override={cents,computedCents:computed,reason,by:c.a.id,at:c.now}
  const hours=old.hours.map((x:DemandHour)=>x.hour===hour?{...x,override}:x)
  const rule=old.assumptions
  const base=hours.map((x:DemandHour)=>({...x,roles:null}))
  const done=finish(base,old.reasons.filter((r:string)=>!/^\d\d:00:/.test(r)),rule.roles,rule.minSamples)
  const totals={salesCents:done.hours.filter((x:any)=>x.salesCents!==null).reduce((n:number,x:any)=>n+x.salesCents,0)||null,requiredMinutes:null as number|null,byRole:null as Record<string,number>|null}
  if(done.status==='complete'){const byRole:Record<string,number>={};for(const x of done.hours)for(const r of x.roles??[])byRole[r.position]=(byRole[r.position]??0)+r.requiredMinutes;totals.byRole=byRole;totals.requiredMinutes=Object.values(byRole).reduce((n,v)=>n+v,0)}
  const {id,revision,...rest}=old
  return put(c,'demandforecasts',{...rest,...done,totals,version:old.version+1,kind:'override',supersedes:id,overrides:{...old.overrides,[hour]:[...(old.overrides?.[hour]??[]),{...override,fromVersion:old.version}]},savedBy:c.a.id,savedAt:c.now})
 }
 return undefined
}
