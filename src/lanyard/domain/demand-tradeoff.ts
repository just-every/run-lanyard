// TRADEOFF-001: compare reviewed inputs to the existing bounded generator.
// This native human read grants no agent scope or new generation constraints.
import {type State,type Actor,canonical} from './model'
import {generationInput,generateDemand,preservedGeneration} from './demand-generator'
import {projectedPreferenceReport} from './fairness'

const controls=['minShiftMinutes','maxShiftMinutes','breakAfterMinutes','breakMinutes'] as const
export function demandComparisonInputs(p:Record<string,any>){
 const candidate=(prefix:string)=>generationInput({...p,...Object.fromEntries(controls.map(k=>[k,p[prefix+k[0].toUpperCase()+k.slice(1)]]))})
 return {a:candidate('a'),b:candidate('b')}
}
export async function compareDemand(s:State,a:Actor,p:Record<string,any>){
 const inputs=demandComparisonInputs(p)
 const candidate=async(input:ReturnType<typeof generationInput>)=>{
  const generation=await generateDemand(s,a,input)
  // Retained cover offers resolve through native shift identities. Only new
  // generated assignments receive hypothetical identities for this projection.
  const rows=[...preservedGeneration(s,input).rows.filter(x=>x.site===input.site),...generation.generated.map((x,i)=>({...x,id:`candidate-${i}`,revision:1}))].map(x=>({...x,minutes:(Date.parse(x.end)-Date.parse(x.start))/60000-x.breakMinutes}))
  return {...generation,measures:projectedPreferenceReport(s,a,input.week,input.site,rows)}
 }
 const first=await candidate(inputs.a),second=await candidate(inputs.b)
 const identity=(x:any)=>canonical(x),left=new Set(first.generated.map(identity)),right=new Set(second.generated.map(identity))
 const delta=(x:number|null,y:number|null)=>x===null||y===null?null:y-x
 return {week:first.week,site:first.site,dates:first.dates,a:first,b:second,
  method:'Two explicit shift and unpaid-break configurations over the same saved manual forecasts and weekly budget; neither is an optimized fairness objective',
  changes:{removed:first.generated.filter(x=>!right.has(identity(x))),added:second.generated.filter(x=>!left.has(identity(x))),unchanged:first.generated.filter(x=>right.has(identity(x)))},
  difference:{costCents:delta(first.cost.costCents,second.cost.costCents),requiredMinutes:delta(first.service.requiredMinutes,second.service.requiredMinutes),scheduledMinutes:delta(first.service.scheduledMinutes,second.service.scheduledMinutes),uncoveredMinutes:delta(first.service.uncoveredMinutes,second.service.uncoveredMinutes),excessMinutes:delta(first.service.excessMinutes,second.service.excessMinutes),fairness:Object.fromEntries(['spread','meanGapMinutes','maxGapMinutes','violations'].map(k=>[k,delta((first.measures.totals as any)[k],(second.measures.totals as any)[k])]))},
  uncertainty:['Manual saved demand does not establish connected POS demand or observed service outcomes.','Coverage apportions unpaid breaks evenly; it does not establish practical or statutory break placement.','Scheduled wage and holiday USD excludes actual and statutory overtime, regular-rate inclusions, burden, other premiums and unapproved exceptions.','Missing cohort, preference and extra-hours evidence remains unknown. Fairness measures describe hypothetical candidate assignments, not a published week.','Cross-site comparison and agent access to generated alternatives are unavailable.'],
  selection:'Choose a feasible candidate using its current generation digest through demand.generate.prepare. Review and publish its exact draft revision separately.'}
}
