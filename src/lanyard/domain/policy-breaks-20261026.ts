// Source-backed break review estimates. Missing timing is unknown, never proof
// that a meal or paid rest was taken. No result mutates payroll or captured time.
import {type Row} from './model'
import {wall} from './settings'

export const BREAK_VERSION='2026-10-26'
export const breakSources:Record<string,string[]>={
 NV:['https://www.leg.state.nv.us/NRS/NRS-608.html#NRS608Sec019'],
 CO:['https://cdle.colorado.gov/dlss-home-page/wage-and-hour-law/breaks-rest-meal-periods'],
 CA:['https://www.dir.ca.gov/dlse/FAQ_MealPeriods.htm','https://www.dir.ca.gov/dlse/FAQ_RestPeriods.htm'],
 OR:['https://www.oregon.gov/boli/employers/pages/meals-and-breaks.aspx'],
 WA:['https://www.lni.wa.gov/workers-rights/workplace-policies/rest-breaks-meal-periods-and-schedules'],
 NY:['https://dol.ny.gov/day-rest-and-meal-periods'],
 IL:['https://labor.illinois.gov/laws-rules/fls/odrisa.html'],
}
type Issue={kind:'meal'|'rest'|'weekly rest';message:string;state:'exception'|'unknown'}
export function policyBreaks(rule:Row|undefined,row:Row,tz:string,planned=false){
 if(!rule?.breakVersion||!breakSources[rule.preset])return null
 const span=Math.floor((Date.parse(row.end)-Date.parse(row.start))/60000),net=span-(row.breakMinutes??0)
 const timed=Array.isArray(row.breaks),valid=(row.breaks??[]).filter((b:any)=>b.end&&b.start>=row.start&&b.end<=row.end&&b.end>b.start)
 const duration=(b:any)=>(Date.parse(b.end)-Date.parse(b.start))/60000,offset=(b:any)=>(Date.parse(b.start)-Date.parse(row.start))/60000
 const meals=valid.filter((b:any)=>b.kind==='meal'),rests=valid.filter((b:any)=>b.kind==='rest'),issues:Issue[]=[]
 const issue=(kind:Issue['kind'],message:string,unknown=false)=>issues.push({kind,message,state:unknown?'unknown':'exception'})
 const meal=(index:number,length:number,earliest:number,latest:number)=>{
  if(!timed){issue('meal',`Meal ${index+1}: ${length} minutes required between elapsed minutes ${earliest} and ${latest}; timing not recorded`,planned||(row.breakMinutes??0)>=length);return}
  const b=meals[index]
  if(!b)issue('meal',`Meal ${index+1}: missed ${length}-minute meal`)
  else if(duration(b)<length)issue('meal',`Meal ${index+1}: short meal`)
  else if(offset(b)<earliest||offset(b)>latest)issue('meal',`Meal ${index+1}: late or out-of-window meal`)
 }
 const rest=(owed:number,length:number)=>{
  if(!owed)return
  if(!timed){issue('rest',`${owed} paid ${length}-minute rest periods required; timing not recorded`,true);return}
  if(rests.filter((b:any)=>duration(b)>=length).length<owed)issue('rest',`Missed or short paid rest: ${owed} periods of ${length} minutes required`)
 }
 if(rule.preset==='CA'){
  if(span>300)meal(0,30,0,300)
  if(span>600)meal(1,30,0,600)
  rest(net<210?0:Math.floor(net/240)+(net%240>120?1:0),10)
 }else if(rule.preset==='NV'){
  if(span>=480)meal(0,30,0,480)
  rest(net<210?0:Math.floor(net/240)+(net%240>120?1:0),10)
 }else if(rule.preset==='CO'){
  if(span>300)meal(0,30,60,span-90)
  rest(net<=120?0:Math.ceil((net-120)/240),10)
 }else if(rule.preset==='OR'){
  const count=span>=1320?3:span>=840?2:span>=360?1:0
  for(let i=0;i<count;i++)meal(i,30,i*480+(span<=420?120:180),i*480+300)
  rest(span<=120?0:Math.ceil((span-120)/240),10)
 }else if(rule.preset==='WA'){
  for(let i=0;i<Math.max(0,Math.ceil(span/300)-1);i++)meal(i,30,i*300+120,i*300+300)
  rest(Math.floor(net/240),10)
  // A full rest alone does not establish the no-more-than-three-hours rule.
  if(timed){const pauses=valid.filter((b:any)=>b.kind==='meal'||duration(b)>=10).sort((a:any,b:any)=>a.start.localeCompare(b.start));let end=row.start
   for(const b of [...pauses,{start:row.end,end:row.end}]){if((Date.parse(b.start)-Date.parse(end))/60000>180){issue('rest','More than three consecutive hours without a recorded rest or meal');break}end=b.end}
  }
 }else if(rule.preset==='NY'){
  const start=wall(row.start,tz),end=wall(row.end,tz),minute=(v:string)=>Number(v.slice(0,2))*60+Number(v.slice(3))
  const first=minute(start.time),last=minute(end.time)+(end.date>start.date?1440:0)
  if(span>360&&first<660&&last>840)meal(0,30,720-first,840-first-30)
  else if(span>360&&(first>=780||first<360))meal(0,45,span/2-45,span/2)
  if(first<660&&last>1140)meal(meals.length?1:0,20,1020-first,1140-first-20)
 }else if(rule.preset==='IL'){
  const count=span>=450?1+Math.floor((span-450)/270):0
  for(let i=0;i<count;i++)meal(i,20,0,300+i*270)
 }
 return {timeId:row.id,site:row.site,date:wall(row.start,tz).date,preset:rule.preset,policyId:rule.id,policyRevision:rule.revision,version:rule.breakVersion,sources:breakSources[rule.preset],issues,
  mealPremiumMinutes:rule.preset==='CA'&&issues.some(i=>i.kind==='meal'&&i.state==='exception')?60:0,
  restPremiumMinutes:rule.preset==='CA'&&issues.some(i=>i.kind==='rest'&&i.state==='exception')?60:0,
  label:'Review estimate; unknown timing requires review; exemptions and alternate workdays not classified; no automatic payroll change'}
}
