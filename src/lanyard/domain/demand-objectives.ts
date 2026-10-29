// OPT-001: review assignment objectives on newly generated service slots.
// Historical FAIR-001 inputs stay authoritative; a proposed week is labelled as a projection.
import {type State,type Actor,type Row,type Context} from './model'
import {preferenceReport} from './fairness'
import {eligibleMembers} from './fairness-policy'
import {conflicts} from './roster'
import {policyWarnings} from './policy'
import {planningBudget} from './planning-inputs'
import {localDate} from './settings'

type Input={week:string;site:string;weeks:number}
type Cost={costCents:number|null}
type Totals={spread:number|null;meanGapMinutes:number|null;maxGapMinutes:number|null;violations:number|null}
const dimensions=['spread','meanGapMinutes','maxGapMinutes','violations'] as const
const known=(x:Totals)=>dimensions.every(k=>x[k]!==null)
const improves=(x:Totals,b:Totals)=>known(x)&&known(b)&&dimensions.every(k=>x[k]!<=b[k]!)&&dimensions.some(k=>x[k]!<b[k]!)
export function generationMeasures(s:State,a:Actor,p:Input,rows:Row[],asOf:string){
 const rosterId='generation-projection-'+p.week
 const old=new Set(s.rosters.filter(r=>r.week===p.week&&r.status==='published').map(r=>r.id))
 const projected:State={...s,rosters:[...s.rosters.filter(r=>!old.has(r.id)),{id:rosterId,revision:1,week:p.week,status:'published'}],
  // Retain old shift facts for actual historical offer references, without counting old assignments.
  shifts:[...s.shifts.map(x=>old.has(x.rosterId)?{...x,status:'superseded'}:x),...rows.map(x=>({...x,rosterId,status:'published'}))]}
 return {...preferenceReport(projected,a,p.week,p.site,p.weeks,{asOf}),basis:'Projected generated week with retained published history; not an actual publication or service outcome'}
}
export const generationOfferBasis=(s:State,a:Actor,p:Input)=>{
 const equity=preferenceReport(s,a,p.week,p.site,p.weeks).equity
 return {inputs:equity.inputs,missingLogs:equity.missingLogs}
}
export function generationObjectives(s:State,a:Actor,p:Input,preserved:Row[],generated:Row[],cost:(rows:Row[])=>Cost){
 const asOf=new Date().toISOString(),active=s.staff.filter(x=>x.active&&!x.erased_at).map(x=>x.id).sort()
 const report=(rows:Row[])=>generationMeasures(s,a,p,[...preserved,...rows],asOf)
 const price=(rows:Row[])=>cost([...preserved,...rows].filter(x=>x.site===p.site))
 const pools=generated.map(x=>eligibleMembers(s,p.site,s.jobs.find(j=>j.id===x.job)?.name??'',localDate(x.start,s.timezone)))
 const valid=(rows:Row[],confirmed:boolean)=>{
  if(confirmed&&!rows.every((x,i)=>pools[i]?.includes(x.staffId)))return false
  const all=[...preserved,...rows]
  if(rows.some(x=>all.some(y=>y.id!==x.id&&y.staffId===x.staffId&&localDate(y.start,s.timezone)===localDate(x.start,s.timezone))))return false
  if(conflicts({s} as Context,all,p.week).length||policyWarnings(s,all,p.week).length)return false
  return planningBudget(s,p.week,p.site,price(rows).costCents).withinBudget===true
 }
 // Single moves and pair exchanges preserve every generated boundary and break.
 // Bound work for interactive previews; reaching the bound never claims a global optimum.
 const search=(initial:Row[],priority:'low'|'high')=>{
  let rows=initial.map(x=>({...x})),moves=0,evaluations=0,limited=false
  let cents=price(rows).costCents,measures=priority==='high'?report(rows):null
  for(;;){
   let next:Row[]|null=null,bestCost=cents,bestMeasures=measures
   const consider=(candidate:Row[])=>{
    if(evaluations>=1000){limited=true;return}evaluations++
    if(!valid(candidate,priority==='high'))return
    const nextCost=price(candidate).costCents
    if(priority==='low'){
     if(nextCost!==null&&bestCost!==null&&nextCost<bestCost){next=candidate;bestCost=nextCost}
    }else{
     const nextMeasures=report(candidate)
     if(improves(nextMeasures.totals,bestMeasures!.totals)){next=candidate;bestCost=nextCost;bestMeasures=nextMeasures}
    }
   }
   for(let i=0;i<rows.length&&!limited;i++)for(const id of priority==='high'?pools[i]??[]:active){if(limited)break;if(id!==rows[i].staffId)consider(rows.map((x,j)=>j===i?{...x,staffId:id}:x))}
   for(let i=0;i<rows.length&&!limited;i++)for(let j=i+1;j<rows.length&&!limited;j++)if(rows[i].staffId!==rows[j].staffId)consider(rows.map((x,k)=>k===i?{...x,staffId:rows[j].staffId}:k===j?{...x,staffId:rows[i].staffId}:x))
   if(!next)break
   rows=next;cents=bestCost;measures=bestMeasures;moves++
   if(limited)break
  }
  return {rows,moves,evaluations,limited,cost:price(rows),measures:measures??report(rows)}
 }
 const low=search(generated,'low'),reasons:string[]=[]
 if(!known(low.measures.totals)||low.measures.totals.gapExcluded||low.measures.totals.reasons.length)reasons.push('Complete confirmed FAIR-001 cohorts, published history, stable weekly preferences and selected undesirable tags are required for high fairness')
 if(pools.some(x=>x===null)||!low.rows.every((x,i)=>pools[i]?.includes(x.staffId)))reasons.push('Every generated assignment needs confirmed role eligibility for high fairness')
 const high=reasons.length?null:search(low.rows,'high')
 return {low,high,reasons,difference:{costCents:high&&low.cost.costCents!==null&&high.cost.costCents!==null?high.cost.costCents-low.cost.costCents:null,
  coveredMinutes:high?0:null},method:'Bounded single-assignment moves and pair exchanges on generated service slots. High fairness reduces at least one known FAIR-001 objective without worsening the others; offer equity is reported and never inferred from assignments.'}
}
