// TRADEOFF-001: explain the facts the fixed-slot alternatives actually compute.
// Demand-derived service risk and statutory overtime remain unknown here.
type Measure = {spread:number|null;meanGapMinutes:number|null;maxGapMinutes:number|null;violations:number|null}
type Alternative = {assignments:{slotId:string;staffId:string}[];measures:{totals:Measure};coverage:{shifts:number;minutes:number};cost:{costCents:number|null};scheduledOvertime:{overtimeMinutes:number|null;premiumCents:number|null}}
type Comparison = {low:Alternative;high:Alternative;uncovered:{minutes:number}[]}
export function explainAlternatives(c:Comparison) {
 const {low,high}=c
 const difference=(a:number|null,b:number|null)=>a===null||b===null?null:b-a
 const fairness=(['spread','meanGapMinutes','maxGapMinutes','violations'] as const).map(measure=>({measure,low:low.measures.totals[measure],high:high.measures.totals[measure],difference:difference(low.measures.totals[measure],high.measures.totals[measure])}))
 const changedAssignments=low.assignments.flatMap(x=>{const after=high.assignments.find(v=>v.slotId===x.slotId)!;return after.staffId===x.staffId?[]:[{slotId:x.slotId,fromStaffId:x.staffId,toStaffId:after.staffId}]})
 const uncertainty=[
  {code:'pos-demand',reason:'No connected POS demand is used in this comparison.'},
  {code:'service-requirements',reason:'Service slots are held fixed. Required staffing and demand-derived service risk are unknown; equal scheduled coverage does not establish adequate service.'},
  {code:'overtime-policy',reason:'The separate scheduled weekly half-rate estimate is not statutory overtime cost. Actual punches, daily overtime, regular-rate inclusions, jurisdiction premiums and policy exceptions are not calculated in these alternatives.'},
  {code:'cost-scope',reason:'Costs estimate effective scheduled wages and configured employer holiday rules. Burden and other premiums are excluded.'},
  ...(low.cost.costCents===null||high.cost.costCents===null?[{code:'missing-rates',reason:'At least one assignment lacks a usable rate or holiday cost basis; the cost difference is unknown.'}]:[])
 ]
 return {costDifferenceCents:difference(low.cost.costCents,high.cost.costCents),changedAssignments,fairness,weeklyScheduledOvertime:{low:low.scheduledOvertime,high:high.scheduledOvertime,minutesDifference:difference(low.scheduledOvertime.overtimeMinutes,high.scheduledOvertime.overtimeMinutes),premiumDifferenceCents:difference(low.scheduledOvertime.premiumCents,high.scheduledOvertime.premiumCents)},coverage:{lowSlots:low.coverage.shifts,highSlots:high.coverage.shifts,lowMinutes:low.coverage.minutes,highMinutes:high.coverage.minutes,uncoveredShifts:c.uncovered.length,uncoveredMinutes:c.uncovered.reduce((n,x)=>n+x.minutes,0)},serviceRisk:null,overtimeMinutes:null,uncertainty}
}
