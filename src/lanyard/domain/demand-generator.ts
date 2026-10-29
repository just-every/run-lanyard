// OPT-001: bounded native generation from explicitly selected saved service dates.
// No provider claim, preference objective or automatic publication is made here.
import {type State,type Actor,type Row,type Context,manager,need,keys,text,integer,sha,canonical,put} from './model'
import {datePlus,savedVersions,demandScope} from './demand'
import {localDate,instantAt} from './settings'
import {conflicts,draftWeek} from './roster'
import {policyOn,policyWarnings} from './policy'
import {scheduledComparisonCost} from './fairness-optimizer'
import {differentialBasis} from './differentials'
import {premiumRule} from './premiums'
import {planningBudget,planningDemand} from './planning-inputs'
import {restricted} from './access'

export const generationInput=(p:Record<string,any>)=>{
 const week=text(p.week,'week',10),monday=new Date(week+'T00:00:00Z')
 need(/^\d{4}-\d{2}-\d{2}$/.test(week)&&Number.isFinite(monday.getTime())&&monday.toISOString().slice(0,10)===week&&monday.getUTCDay()===1,'Choose a Monday week')
 const dates=typeof p.dates==='string'?p.dates.split(',').map(x=>x.trim()):p.dates
 need(Array.isArray(dates)&&dates.length>0&&dates.length<=7,'Select one to seven service dates')
 need(dates.every(d=>Array.from({length:7},(_,i)=>datePlus(week,i)).includes(d))&&new Set(dates).size===dates.length,'Select distinct dates within the week')
 const number=(key:string,min:number,max:number)=>integer(Number(p[key]),key,min,max)
 const minShiftMinutes=number('minShiftMinutes',15,720),maxShiftMinutes=number('maxShiftMinutes',minShiftMinutes,720),breakAfterMinutes=number('breakAfterMinutes',15,720),breakMinutes=number('breakMinutes',0,120)
 need([minShiftMinutes,maxShiftMinutes,breakAfterMinutes,breakMinutes].every(x=>x%15===0),'Use whole quarter-hour shift and break inputs')
 need(breakMinutes<minShiftMinutes,'Break must be shorter than the minimum shift')
 return {week,site:text(p.site,'site',80,true),dates:[...dates].sort() as string[],minShiftMinutes,maxShiftMinutes,breakAfterMinutes,breakMinutes}
}
type Input=ReturnType<typeof generationInput>
const shiftInput=(x:Row)=>({staffId:x.staffId,start:x.start,end:x.end,breakMinutes:x.breakMinutes,label:x.label??'',site:x.site??'',job:x.job??''})
const rowDigest=(rows:Row[])=>sha(canonical(rows.map(x=>canonical(shiftInput(x))).sort()))
function authority(s:State,a:Actor,site:string){manager(a);need(!restricted(s,a),'Demand generation is unavailable to custom access levels',403);need(demandScope(s,a,site),'Not found',404)}
// Bind to source and eligibility facts without feedback, worked-time or clock inputs.
// The generated draft itself is excluded; its exact rows are separately bound below.
async function facts(s:State,week:string,ignoreDraft?:string){
 const collections=['availability','leave','patterns','workforce','jobs','orgmemberships','locations','policies','minors','paygroups','fairworkpolicies','mealrules','forecasts','sales','demandrules','demandforecasts','holidays','holidayrules','differentials','premiumrules','accessgrants','accesslevels'] as const
 return sha(canonical({timezone:s.timezone,staff:s.staff,inputs:Object.fromEntries(collections.map(k=>[k,s[k]])),
  rosters:s.rosters.filter(r=>r.id!==ignoreDraft&&['draft','published'].includes(r.status)),
  shifts:s.shifts.filter(x=>x.rosterId!==ignoreDraft&&['draft','published'].includes(x.status)),openshifts:s.openshifts.filter(x=>x.rosterId!==ignoreDraft),week}))
}
function preserved(s:State,p:Input){
 const draft=s.rosters.find(r=>r.week===p.week&&r.status==='draft'),published=s.rosters.find(r=>r.week===p.week&&r.status==='published')
 const candidates=s.shifts.filter(x=>[draft?.id,published?.id].includes(x.rosterId)&&['draft','published'].includes(x.status)).sort((a,b)=>Number(b.status==='draft')-Number(a.status==='draft'))
 const seen=new Set<string>(),rows=candidates.filter(x=>{const key=canonical(shiftInput(x));if(seen.has(key))return false;seen.add(key);return true})
 return {draft,rows:rows.filter(x=>x.site!==p.site||!p.dates.includes(localDate(x.start,s.timezone)))}
}
export function generationCost(s:State,rows:Row[]){
 const base=scheduledComparisonCost(s,rows)
 const inputs=base.inputs.map((x,i)=>{
  const row=rows[i],differential=differentialBasis(s,{...row,rateBasis:x.basis,
   differentialContext:{tag:row.label??'',role:s.staff.find(p=>p.id===row.staffId)?.position??''}},s.differentials)
  return {...x,differential}
 })
 const additions=inputs.flatMap(x=>x.differential)
 return {...base,inputs,costCents:base.costCents===null||additions.some(x=>x.costCents===null)?null:base.costCents+additions.reduce((n,x)=>n+x.costCents,0),
  label:'Scheduled wage, employer holiday and shift differential estimate; excludes unconfigured burden and unapproved premiums'}
}
export async function generateDemand(s:State,a:Actor,input:Record<string,any>){
 const p=generationInput(input);authority(s,a,p.site)
 const source=preserved(s,p),generated:Row[]=[],issues:string[]=[],rejections=new Set<string>(),versions:Row[]=[]
 const budgetSource=s.forecasts.find(f=>f.week===p.week&&f.site===p.site)
 if(!budgetSource||budgetSource.budgetPercent===null)issues.push('Review a saved weekly labor budget before generation')
 if(budgetSource&&(budgetSource.burdenPercent||budgetSource.burdenPerHourCents||budgetSource.jobBudgets?.length))issues.push('Configured burden or job caps require cost treatment beyond this generator; generation refused')
 const costDates=[...p.dates,...source.rows.filter(x=>x.site===p.site).map(x=>localDate(x.start,s.timezone))]
 if(costDates.some(date=>premiumRule(s,p.site,date)))issues.push('Configured reporting, split-shift or spread-of-hours premiums require unsupported cost treatment; generation refused')
 if(s.fairworkpolicies.some(r=>r.site===p.site))issues.push('Fair-workweek consequences require separate supported policy enforcement; generation refused')
 if(s.mealrules.some(r=>r.site===p.site&&r.enabled))issues.push('Automatic meal deductions are unsupported for generated shifts')
 for(const date of p.dates){
  const v=savedVersions(s,p.site,date)[0]
  if(!v||v.status!=='complete'||!v.assumptions.roles.length||v.hours.length!==24||v.hours.some((h:any)=>h.salesCents===null||h.roles===null)){issues.push(`${date}: complete saved hourly forecast and role requirements required, including explicit zero-demand hours`);continue}
  versions.push(v)
  const rule=policyOn(s,p.site,date)
  if(!rule||rule.preset==='custom'||rule.breakVersion||rule.alternate){issues.push(`${date}: required policy is missing, unmaintained or requires unsupported break placement or alternate-workday enforcement`);continue}
 }
 const all=()=>[...source.rows,...generated]
 const service=()=>planningDemand(s,p.week,p.site,all(),p.dates)
 if(!issues.length){
  // Greedy coverage improvement on a quarter-hour grid. A bounded local method,
  // not a certificate that every feasible assignment has been searched.
  for(let step=0;step<250-source.rows.length;step++){
   const before=service(),target=before.intervals.find(x=>x.uncoveredMinutes>0.01)
   if(!target)break
   const job=s.jobs.find(j=>j.name===target.position)
   if(!job){issues.push(`${target.date} ${target.position}: no matching qualified job is configured`);break}
   let best:{row:Row;gain:number;excess:number;cost:number}|undefined
   for(const person of s.staff.filter(x=>x.active&&!x.erased_at).sort((a,b)=>a.id.localeCompare(b.id))){
    // Avoid dividing one person's day into adjacent shifts to evade a reviewed break.
    if(all().some(x=>x.staffId===person.id&&localDate(x.start,s.timezone)===target.date))continue
    for(let duration=p.minShiftMinutes;duration<=p.maxShiftMinutes;duration+=15){
     const start=instantAt(target.date,`${String(target.hour).padStart(2,'0')}:00`,s.timezone),end=new Date(Date.parse(start)+duration*60000).toISOString()
     if(localDate(new Date(Date.parse(end)-1).toISOString(),s.timezone)!==target.date)continue
     const breakMinutes=duration>=p.breakAfterMinutes?p.breakMinutes:0
     const row:Row={id:`generated-${step}`,revision:1,staffId:person.id,start,end,breakMinutes,minutes:duration-breakMinutes,site:p.site,job:job.id,label:'Demand-generated service',status:'draft'}
     const rows=[...all(),row],bad=conflicts({s} as Context,rows,p.week)
     if(bad.length){for(const e of bad)rejections.add(e.reason);continue}
     const warnings=policyWarnings(s,rows,p.week)
     if(warnings.length){for(const e of warnings)rejections.add(e.site===p.site?e.message:'Preserved work has unresolved required policy checks');continue}
     const cost=generationCost(s,rows.filter(x=>x.site===p.site)).costCents,budget=planningBudget(s,p.week,p.site,cost)
     if(cost===null||budget.withinBudget!==true){rejections.add(cost===null?'Unpriced assignment':'Reviewed labor budget exceeded');continue}
     const after=planningDemand(s,p.week,p.site,rows,p.dates),gain=before.uncoveredMinutes!-after.uncoveredMinutes!,excess=after.excessMinutes!
     if(gain<=.01)continue
     if(!best||gain>best.gain+.01||Math.abs(gain-best.gain)<.01&&(excess<best.excess-.01||Math.abs(excess-best.excess)<.01&&cost<best.cost))best={row,gain,excess,cost}
    }
   }
   if(!best){issues.push(`${target.date} ${target.position} at hour ${target.hour}: coverage infeasible with the reviewed inputs and bounded search`);break}
   generated.push(best.row)
  }
 }
 if(!generated.length&&!source.rows.length&&!s.openshifts.some(x=>x.week===p.week&&x.status==='draft'))issues.push('No assigned service to prepare; use the separate schedule cancellation review')
 const coverage=service(),cost=generationCost(s,all().filter(x=>x.site===p.site)),budget=planningBudget(s,p.week,p.site,cost.costCents)
 if(coverage.uncoveredMinutes!==null&&coverage.uncoveredMinutes>.01&&!issues.length)issues.push('Coverage exceeds the supported 250-shift draft bound')
 if(!issues.length&&(cost.costCents===null||budget.withinBudget!==true))issues.push('Known costs within the reviewed weekly budget are required')
 const basis=await facts(s,p.week),result={...p,method:'Bounded greedy demand coverage on quarter-hour boundaries; one generated shift per person per service date',versions:versions.map(v=>({id:v.id,revision:v.revision,version:v.version,digest:v.digest,date:v.date})),generated:generated.map(shiftInput),preserved:source.rows.filter(x=>x.site===p.site).map(shiftInput),preservedOtherSites:null,service:coverage,cost,budget,infeasible:issues,rejections:[...rejections].sort(),feasible:issues.length===0,basis}
 return {...result,digest:await sha(canonical(result))}
}
export async function demandGenerationCommand(c:Context,name:string,p:Record<string,any>){
 if(name!=='demand.generate.prepare')return undefined
 keys(p,['week','site','dates','minShiftMinutes','maxShiftMinutes','breakAfterMinutes','breakMinutes','digest'])
 const preview=await generateDemand(c.s,c.a,p)
 need(preview.digest===text(p.digest,'generation review',64),'Generation facts changed; preview and review again',409)
 need(preview.feasible,preview.infeasible.join('; '),409)
 const result=draftWeek(c,preview.week,[...preserved(c.s,generationInput(p)).rows.map(shiftInput),...preview.generated])
 const review={input:generationInput(p),facts:await facts(c.s,preview.week,result.id),rows:await rowDigest(result.shifts),previewDigest:preview.digest}
 put(c,'rosters',{...c.s.rosters.find(r=>r.id===result.id)!,generationReview:review},c.s.rosters.find(r=>r.id===result.id))
 const roster=c.s.rosters.find(r=>r.id===result.id)!
 return {...result,shifts:c.a.role==='owner'?result.shifts:result.shifts.filter((x:Row)=>x.site===preview.site),revision:roster.revision,approval:{id:roster.id,revision:roster.revision},generationReview:review}
}
export async function generationPublication(c:Context,name:string,p:Record<string,any>){
 if(name!=='roster.publish')return
 const r=c.s.rosters.find(r=>r.id===p.id),review=r?.generationReview
 if(!review)return
 authority(c.s,c.a,review.input.site)
 need(await facts(c.s,r!.week,r!.id)===review.facts,'Generation facts changed; preview and prepare again before publication',409)
 const rows=c.s.shifts.filter(x=>x.rosterId===r!.id&&x.status==='draft')
 need(await rowDigest(rows)===review.rows,'Generated draft changed; preview and prepare again',409)
 need(!policyWarnings(c.s,rows,r!.week).length,'Required policy checks refuse this generated draft',409)
}
