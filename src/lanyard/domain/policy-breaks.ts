// Source-backed break review estimates. Missing timing is unknown, never proof
// that a meal or paid rest was taken. No result mutates payroll or captured time.
import {type Row,need} from './model'
import {BREAK_VERSION as PREVIOUS_VERSION,policyBreaks as previousBreaks} from './policy-breaks-20261026'
import {wall} from './settings'

export const BREAK_VERSION='2026-10-26.2'
export const BREAK_VERSIONS=[PREVIOUS_VERSION,'2026-10-26.1',BREAK_VERSION] as const
export const breakSources:Record<string,string[]>={
 NV:['https://www.leg.state.nv.us/NRS/NRS-608.html#NRS608Sec019','https://www.leg.state.nv.us/NAC/NAC-608.html#NAC608Sec145'],
 CO:['https://cdle.colorado.gov/dlss-home-page/wage-and-hour-law/breaks-rest-meal-periods'],
 CA:['https://www.dir.ca.gov/dlse/FAQ_MealPeriods.htm','https://www.dir.ca.gov/dlse/FAQ_RestPeriods.htm'],
 OR:['https://secure.sos.state.or.us/oard/view.action?ruleNumber=839-020-0050','https://www.oregon.gov/boli/workers/Pages/meals-and-breaks.aspx'],
 WA:['https://www.lni.wa.gov/workers-rights/workplace-policies/rest-breaks-meal-periods-and-schedules'],
 NY:['https://www.nysenate.gov/legislation/laws/LAB/162','https://dol.ny.gov/day-rest-and-meal-periods'],
 IL:['https://labor.illinois.gov/laws-rules/fls/odrisa.html'],
}
type Issue={kind:'meal'|'rest'|'weekly rest';message:string;state:'exception'|'unknown'}
export function policyBreaks(rule:Row|undefined,row:Row,tz:string,planned=false){
 if(!rule?.breakVersion)return null
 if(rule.breakVersion===PREVIOUS_VERSION)return previousBreaks(rule,row,tz,planned)
 need((BREAK_VERSIONS as readonly string[]).includes(rule.breakVersion),'Unsupported break-rule version; review the policy release before classification',409)
 if(!breakSources[rule.preset])return null
 const current=rule.breakVersion===BREAK_VERSION
 const span=Math.floor((Date.parse(row.end)-Date.parse(row.start))/60000),net=span-(row.breakMinutes??0)
 const timed=Array.isArray(row.breaks),valid=(row.breaks??[]).filter((b:any)=>b.end&&b.start>=row.start&&b.end<=row.end&&b.end>b.start)
 const duration=(b:any)=>(Date.parse(b.end)-Date.parse(b.start))/60000,offset=(b:any)=>(Date.parse(b.start)-Date.parse(row.start))/60000
 const meals=valid.filter((b:any)=>b.kind==='meal'),rests=valid.filter((b:any)=>b.kind==='rest'),issues:Issue[]=[]
 const issue=(kind:Issue['kind'],message:string,unknown=false)=>issues.push({kind,message,state:unknown?'unknown':'exception'})
 const checkMeal=(index:number,length:number,earliest:number,latest:number,b:any,completeBy?:number)=>{
  const starts=current&&rule.preset==='CA'&&b?offset(b)-meals.filter((m:any)=>m.end<=b.start).reduce((n:number,m:any)=>n+duration(m),0):b?offset(b):0
  if(!timed){issue('meal',`Meal ${index+1}: ${length} minutes required between elapsed minutes ${earliest} and ${latest}; timing not recorded`,planned||(row.breakMinutes??0)>=length);return}
  if(!b)issue('meal',`Meal ${index+1}: missed ${length}-minute meal`)
  else if(duration(b)<length)issue('meal',`Meal ${index+1}: short meal`)
  else if(starts<earliest||starts>latest||completeBy!==undefined&&offset(b)+duration(b)>completeBy)issue('meal',`Meal ${index+1}: late or out-of-window meal`)
 }
 const meal=(index:number,length:number,earliest:number,latest:number)=>checkMeal(index,length,earliest,latest,meals[index])
 const rest=(owed:number,length:number)=>{
  if(!owed)return
  if(!timed){issue('rest',`${owed} paid ${length}-minute rest periods required; timing not recorded`,true);return}
  if(rests.filter((b:any)=>duration(b)>=length).length<owed)issue('rest',`Missed or short paid rest: ${owed} periods of ${length} minutes required`)
 }
 if(rule.preset==='CA'){
  if((current?net:span)>300)meal(0,30,0,300)
  // Duty-free meal minutes do not trigger the ten-hours-worked obligation.
  if(net>600)meal(1,30,0,600)
  rest(net<210?0:Math.floor(net/240)+(net%240>120?1:0),10)
 }else if(rule.preset==='NV'){
  if(span>=480)meal(0,30,0,480)
  rest(net<210?0:current?Math.floor((net+60)/240):Math.floor(net/240)+(net%240>120?1:0),10)
 }else if(rule.preset==='CO'){
  if(span>300)meal(0,30,60,span-90)
  rest(net<=120?0:Math.ceil((net-120)/240),10)
 }else if(rule.preset==='OR'){
  // OAR 839-020-0050 excludes unpaid meals from the work period. Exactly
  // seven working hours retain the shorter window; the meal must finish
  // before the fifth hour (or sixth hour for a longer work period).
  const count=net>=1320?3:net>=840?2:net>=360?1:0,short=net<=420
  for(let i=0;i<count;i++){
   if(current&&i>0){if(!timed)issue('meal',`Meal ${i+1}: thirty-minute meal required; timing not recorded`,true);else if(!meals[i]||duration(meals[i])<30)issue('meal',`Meal ${i+1}: missed or short thirty-minute meal`);else issue('meal',`Meal ${i+1}: placement requires review against the work period`,true)}
   else checkMeal(i,30,i*480+(short?120:180),i*480+(short?210:270),meals[i],i*480+(short?240:300))
  }
  rest(net<=120?0:Math.ceil((net-120)/240),10)
 }else if(rule.preset==='WA'){
  if(!current)for(let i=0;i<Math.max(0,Math.ceil(span/300)-1);i++)meal(i,30,i*300+120,i*300+300)
  else{
   let cursor=0,index=0
   const remaining=()=>span-cursor-meals.filter((b:any)=>offset(b)>=cursor).reduce((n:number,b:any)=>n+duration(b),0)
   while(remaining()>300){
    const b=meals.find((b:any)=>offset(b)>=cursor&&duration(b)>=30)??meals.find((b:any)=>offset(b)>=cursor)
    checkMeal(index,30,index===0?120:cursor,cursor+300,b)
    if(!b)break
    cursor=offset(b)+duration(b);index++
   }
  }
  rest(Math.floor(net/240),10)
  // A full rest alone does not establish the no-more-than-three-hours rule.
  if(timed){const pauses=valid.filter((b:any)=>current?(b.kind==='meal'?duration(b)>=30:duration(b)>=10):b.kind==='meal'||duration(b)>=10).sort((a:any,b:any)=>a.start.localeCompare(b.start));let end=row.start
   for(const b of [...pauses,{start:row.end,end:row.end}]){if((Date.parse(b.start)-Date.parse(end))/60000>180){issue('rest','More than three consecutive hours without a recorded rest or meal');break}end=b.end}
  }
 }else if(rule.preset==='NY'){
  const start=wall(row.start,tz),end=wall(row.end,tz),minute=(v:string)=>Number(v.slice(0,2))*60+Number(v.slice(3))
  const first=minute(start.time),last=minute(end.time)+(end.date>start.date?1440:0)
  // Selected nonfactory treatment only. Obligations do not depend on how
  // many meals were recorded; an evening meal cannot satisfy the noon meal.
  const required:{length:number;earliest:number;latest:number}[]=[],used=new Set<any>()
  if(span>360&&first<660&&last>840)required.push({length:30,earliest:660-first,latest:810-first})
  else if(span>360&&(first>=780||first<360))required.push({length:45,earliest:span/2-45,latest:span/2})
  if(first<660&&last>1140)required.push({length:20,earliest:1020-first,latest:1120-first})
  const inWindow=(b:any,r:typeof required[number])=>offset(b)>=r.earliest&&offset(b)<=r.latest
  required.forEach((r,i)=>{
   const available=meals.filter((b:any)=>!used.has(b)),matching=available.filter((b:any)=>inWindow(b,r))
   const b=matching.find((b:any)=>duration(b)>=r.length)??matching[0]??available.find((b:any)=>!required.some(other=>inWindow(b,other)))
   if(b)used.add(b)
   checkMeal(i,r.length,r.earliest,r.latest,b)
  })
 }else if(rule.preset==='IL'){
  const count=span>=450?1+Math.floor((span-450)/270):0
  for(let i=0;i<count;i++){
   if(current&&i>0){if(!timed)issue('meal',`Meal ${i+1}: twenty-minute meal required; timing not recorded`,true);else if(!meals[i]||duration(meals[i])<20)issue('meal',`Meal ${i+1}: missed or short twenty-minute meal`);else issue('meal',`Meal ${i+1}: placement requires review against continuous work`,true)}
   else meal(i,20,0,300+i*270)
  }
 }
 return {timeId:row.id,site:row.site,date:wall(row.start,tz).date,preset:rule.preset,policyId:rule.id,policyRevision:rule.revision,version:rule.breakVersion,sources:breakSources[rule.preset],issues,
  mealPremiumMinutes:rule.preset==='CA'&&issues.some(i=>i.kind==='meal'&&i.state==='exception')?60:0,
  restPremiumMinutes:rule.preset==='CA'&&issues.some(i=>i.kind==='rest'&&i.state==='exception')?60:0,
  label:(rule.preset==='NY'?'Selected nonfactory meal treatment; factory coverage not classified. ':'')+'Review estimate; unknown timing requires review; exemptions and alternate workdays not classified; no automatic payroll change'}
}
