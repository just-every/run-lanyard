// POLICY-001: versioned overtime core. Meal timing and statutory premium payroll
// remain separate unfinished obligations; these estimates never submit wages.
import {type Context,type State,type Row,keys,text,need,integer,put,exact} from './model'
import {date,dayAfter} from './aca'
import {localDate} from './settings'
import {priced} from './workforce'
import {workweek} from './payschedules'

const VERSION='2026-10-24'
const sources:Record<string,string>={
 federal:'https://www.dol.gov/agencies/whd/overtime',
 CA:'https://www.dir.ca.gov/dlse/faq_overtime.htm',
 AK:'https://labor.alaska.gov/lss/whact.htm',
 NV:'https://labor.nv.gov/Employer/Employer_Information/',
 CO:'https://cdle.colorado.gov/dlss/home-page/wage-and-hour-law/overtime',
 OR:'https://www.oregon.gov/boli/employers/pages/overtime.aspx',
 WA:'https://www.lni.wa.gov/workers-rights/wages/overtime/',
 NY:'https://dol.ny.gov/overtime-pay',
 IL:'https://labor.illinois.gov/faqs/overtime-faq.html',
}
export const policyPresets=Object.entries(sources).map(([id,source])=>({id,source,version:VERSION,effectiveFrom:'2026-10-24',scope:'Nonexempt overtime core only; meal timing, rest periods, exemptions and premium payroll are not implemented'}))
const version=(r:Row)=>{const {versions,...v}=r;return v}
export function policyOn(s:State,site:string,on:string){
 return s.policies.filter(r=>r.site===site).flatMap(r=>[...(r.versions??[]),version(r)]).filter(r=>r.from<=on).sort((a,b)=>a.from.localeCompare(b.from)||a.revision-b.revision).at(-1)
}
export function policyLabel(r:any){return r.preset==='custom'?`${r.jurisdiction}: employer-configured, unmaintained`:`${r.preset} overtime core (${r.presetVersion}); meal and rest compliance incomplete`}
export function policyCommand(c:Context,name:string,p:Record<string,any>){
 if(!['policy.save','policy.review'].includes(name))return
 need(c.a.role==='owner','Only the owner maintains or reviews policy calculations',403)
 if(name==='policy.review'){
  keys(p,['staffId','week']);need(c.s.staff.some(x=>x.id===p.staffId),'Person not found',404)
  const week=date(p.week,'workweek');need(workweek(c.s,p.staffId,week)===week,'Use the employee workweek start')
  return policyClassification(c.s,p.staffId,week)
 }
 keys(p,['id','revision','site','from','preset','jurisdiction','dailyMinutes','doubleMinutes','weeklyMinutes','minimumRestMinutes','reviewReason'])
 const site=text(p.site,'site',80,true),old=c.s.policies.find(r=>r.site===site)
 if(old){need(p.id===old.id,'Reload the existing policy',409);exact(old,p)}else need(!p.id,'Policy not found',404)
 const from=date(p.from,'effective date'),preset=text(p.preset,'preset',20)
 need(preset==='custom'||Object.hasOwn(sources,preset),'Choose a shipped preset or custom')
 if(old)need(from>=old.from,'A policy revision cannot precede its previous effective date',409)
 need(!c.s.periods.some(r=>['locked','closed'].includes(r.status)&&r.end>=from),'Policy changes cannot reach locked or closed payroll; choose a later effective date',409)
 const reviewReason=old?text(p.reviewReason,'reviewed recalculation reason',500):text(p.reviewReason,'review reason',500,true)
 const custom=preset==='custom'
 if(!custom)need(['jurisdiction','dailyMinutes','doubleMinutes','weeklyMinutes'].every(k=>p[k]===undefined),'Maintained overtime thresholds cannot be overridden; use custom')
 const limit=(v:any,label:string,fallback:number)=>v===undefined?fallback:integer(Number(v),label,1,10080)
 const dailyMinutes=custom?limit(p.dailyMinutes,'daily threshold',1440):['CA','AK','NV'].includes(preset)?480:preset==='CO'?720:1440
 const doubleMinutes=custom?limit(p.doubleMinutes,'double-time threshold',1440):preset==='CA'?720:1440
 need(doubleMinutes>=dailyMinutes,'Double time cannot begin before overtime')
 const minimumRestMinutes=p.minimumRestMinutes===undefined?0:integer(Number(p.minimumRestMinutes),'employer minimum rest',0,1440)
 if(preset==='CA')need(!c.s.mealrules.some(r=>r.site===site&&r.enabled),'Disable automatic meal deduction before applying California policy',409)
 return put(c,'policies',{site,from,preset,jurisdiction:custom?text(p.jurisdiction,'jurisdiction',120):preset,presetVersion:VERSION,source:custom?'':sources[preset],dailyMinutes,doubleMinutes,weeklyMinutes:custom?limit(p.weeklyMinutes,'weekly threshold',2400):2400,minimumRestMinutes,minimumRestLabel:'Employer-configured, unmaintained minimum rest',reviewReason,by:c.a.id,at:c.now,versions:old?[...(old.versions??[]),version(old)]:[]},old)
}
/** Actuals use approved retained rate allocations; all sites and jobs share the
 * employee workweek. Daily premiums never count twice toward weekly overtime.
 * A date uses the strongest threshold of the sites actually worked that date. */
export function policyClassification(s:State,staffId:string,week:string,planned?:Row[]){
 const rows=planned??s.timesheets.filter(t=>t.staffId===staffId&&t.status==='approved')
 const parts=rows.filter(t=>t.staffId===staffId).flatMap(t=>{
  const areas=t.workSegments?.length?t.workSegments:[t]
  return areas.flatMap((area:any)=>{const basis=area.rateBasis??priced(s,staffId,{...t,...area});return basis.segments.map((p:any)=>({date:p.date,minutes:p.minutes,cents:p.cents,site:basis.site??t.site??s.staff.find(x=>x.id===staffId)?.site??'',timeId:t.id,revision:t.revision,start:area.start??t.start,job:area.job??t.job??''}))})
 }).filter((p:any)=>workweek(s,staffId,p.date)===week).sort((a:any,b:any)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start)||a.timeId.localeCompare(b.timeId))
 let regularWeek=0
 const daily=new Map<string,number>(),rules=new Map<string,any>(),workedDays=new Set<string>(parts.map((p:any)=>p.date))
 for(const p of parts){const r=policyOn(s,p.site,p.date);if(r)rules.set(p.date+'|'+p.site,r)}
 const output=parts.map((p:any)=>{
  const own=policyOn(s,p.site,p.date),dayRules=[...rules.entries()].filter(([key])=>key.startsWith(p.date+'|')).map(([,r])=>r)
  // Nevada's current general minimum wage is USD 12; daily overtime applies
  // below 1.5 times that amount. Missing wage evidence never waives the check.
  const dailyLimit=(r:any)=>r.preset==='NV'&&p.cents!==null&&p.cents>=1800?1440:r.dailyMinutes
  const ca=dayRules.some(r=>r.preset==='CA'),seventh=ca&&Array.from({length:7},(_,i)=>dayAfter(p.date,-i)).every(d=>d>=week&&workedDays.has(d))
  const dailyMax=Math.min(1440,...dayRules.map(dailyLimit)),doubleMax=Math.min(1440,...dayRules.map(r=>r.doubleMinutes)),weeklyMax=Math.min(2400,...dayRules.map(r=>r.weeklyMinutes))
  const before=daily.get(p.date)??0,after=before+p.minutes;daily.set(p.date,after)
  const over=(bound:number)=>Math.max(0,after-bound)-Math.max(0,before-bound)
  const doubleMinutes=over(seventh?480:doubleMax),dailyOvertime=seventh?p.minutes-doubleMinutes:Math.max(0,over(dailyMax)-doubleMinutes)
  const eligible=p.minutes-doubleMinutes-dailyOvertime,weeklyOvertime=Math.max(0,regularWeek+eligible-weeklyMax)-Math.max(0,regularWeek-weeklyMax);regularWeek+=eligible
  const overtimeMinutes=dailyOvertime+weeklyOvertime,regularMinutes=p.minutes-overtimeMinutes-doubleMinutes
  return {...p,regularMinutes,overtimeMinutes,doubleMinutes,rules:dayRules.map(r=>({id:r.id,revision:r.revision,preset:r.preset,version:r.presetVersion,source:r.source,label:policyLabel(r)})),configured:!!own}
 })
 const total=(key:string)=>output.reduce((n:number,p:any)=>n+p[key],0),minutes=total('minutes'),known=output.every((p:any)=>p.cents!==null)
 const weightedRateCents=minutes&&known?output.reduce((n:number,p:any)=>n+p.minutes*p.cents,0)/minutes:null
 const overtimeMinutes=total('overtimeMinutes'),doubleMinutes=total('doubleMinutes')
 return {staffId,week,end:dayAfter(week,6),minutes,regularMinutes:total('regularMinutes'),overtimeMinutes,doubleMinutes,weightedRateCents,estimateCents:weightedRateCents===null?null:Math.round((minutes+overtimeMinutes*.5+doubleMinutes)*weightedRateCents/60),label:'Weighted-average estimate; provider regular-rate treatment is authoritative; meal and rest premiums excluded',parts:output}
}
export function policyWarnings(s:State,shifts:Row[],week:string){
 const all=[...s.shifts.filter(x=>x.status==='published'&&s.rosters.find(r=>r.id===x.rosterId)?.week!==week),...shifts]
 const result:{kind:string;site:string;date?:string;message:string}[]=[]
 for(const x of shifts){const site=x.site??s.staff.find(p=>p.id===x.staffId)?.site??'',r=policyOn(s,site,localDate(x.start,s.timezone));if(!r)continue
  const rest=minimumRestIssue(s,x.staffId,x,[],all);if(rest)result.push({kind:'policy',site,date:localDate(x.start,s.timezone),message:`${s.staff.find(p=>p.id===x.staffId)?.name}: ${rest}`})
  const report=policyClassification(s,x.staffId,workweek(s,x.staffId,localDate(x.start,s.timezone)),all),mine=report.parts.filter((p:any)=>p.timeId===x.id)
  const overtime=mine.reduce((n:number,p:any)=>n+p.overtimeMinutes,0),double=mine.reduce((n:number,p:any)=>n+p.doubleMinutes,0)
  if(overtime||double||r.preset==='custom')result.push({kind:'policy',site,date:localDate(x.start,s.timezone),message:`${s.staff.find(p=>p.id===x.staffId)?.name}: ${policyLabel(r)}: ${overtime} overtime minutes; ${double} double-time minutes. ${report.label}.`})
 }
 return result
}
export function minimumRestIssue(s:State,staffId:string,shift:Row,skip:string[]=[],plans?:Row[]){
 const site=shift.site??s.staff.find(p=>p.id===staffId)?.site??'',r=policyOn(s,site,localDate(shift.start,s.timezone));if(!r?.minimumRestMinutes)return null
 const other=(plans??s.shifts.filter(x=>x.status==='published')).filter(x=>x.staffId===staffId&&x.id!==shift.id&&!skip.includes(x.id))
 const short=other.some(x=>{const gap=x.end<=shift.start?(Date.parse(shift.start)-Date.parse(x.end))/60000:x.start>=shift.end?(Date.parse(x.start)-Date.parse(shift.end))/60000:Infinity;return gap<r.minimumRestMinutes})
 return short?`${r.minimumRestLabel}: ${r.minimumRestMinutes} minutes required (${r.presetVersion})`:null
}
