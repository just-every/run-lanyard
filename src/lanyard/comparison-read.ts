// TRADEOFF-001: comparison.read is an explicit, read-only owner grant.
// Construct a separate allowlisted projection; never redact by guessing secret names.
import {type Actor,need} from './domain/model'
import {load} from './domain/storage'
import {compareFairness} from './domain/fairness-optimizer'

import {comparisonGrant,recordComparisonRead} from './comparison-scope'

type Money={status:'known'|'unknown'|'small-cell';cents:number|null;reasons:string[]}
function money(cents:number|null,contributors:number,reasons:string[]=[]):Money {
 if(cents===null)return {status:'unknown',cents:null,reasons:reasons.length?reasons:['Missing effective rate or cost basis']}
 if(contributors<3)return {status:'small-cell',cents:null,reasons:[]}
 return {status:'known',cents,reasons:[]}
}
function fairness(r:any,person:(id:string)=>string) {
 return {
  first:r.first,last:r.last,week:r.week,weeks:r.weeks,
  totals:{spread:r.totals.spread,meanGapMinutes:r.totals.meanGapMinutes,maxGapMinutes:r.totals.maxGapMinutes,violations:r.totals.violations,gapSamples:r.totals.gapSamples,gapExcluded:r.totals.gapExcluded,reasons:r.totals.reasons},
  groups:r.groups.map((x:any)=>({position:x.position,samples:x.samples,excluded:x.excluded,meanGapMinutes:x.meanGapMinutes,maxGapMinutes:x.maxGapMinutes})),
  people:r.rows.map((x:any)=>({staffId:person(x.staffId),position:x.position,week:x.week,cohortId:x.cohortId,membership:x.membership,scheduledMinutes:x.scheduledMinutes,gapMinutes:x.gapMinutes,preferredShifts:x.preferredShifts,preferNotShifts:x.preferNotShifts,unknownBlockShifts:x.unknownBlockShifts,reasons:x.reasons})),
  cohorts:r.cohorts.records.map((x:any)=>({id:x.id,revision:x.revision,site:x.site,position:x.position,dates:x.dates})),
  undesirable:{reasons:r.undesirable.reasons,groups:r.undesirable.groups.map((x:any)=>({cohortId:x.cohortId,cohortIds:x.cohortIds,position:x.position,dates:x.dates,spread:x.spread,standardDeviation:x.standardDeviation,reasons:x.reasons,counts:x.counts.map((p:any)=>({staffId:person(p.staffId),count:p.count,tags:p.tags,eligibleDays:p.eligibleDays}))}))},
  violations:{count:r.violations.count,unknown:r.violations.unknown,reasons:r.violations.reasons,groups:r.violations.groups.map((x:any)=>({cohortId:x.cohortId,position:x.position,count:x.count,unknown:x.unknown}))},
  // The ruling permits extra-hours evidence only as cohort totals, never person shares or minutes.
  equity:{reasons:r.equity.reasons,groups:r.equity.groups.map((x:any)=>({cohortId:x.cohortId,cohortIds:x.cohortIds,position:x.position,site:x.site,totalOfferedMinutes:x.totalOfferedMinutes,totalRequestedMinutes:x.totalRequestedMinutes,reasons:x.reasons}))}
 }
}
function projection(c:Awaited<ReturnType<typeof compareFairness>>,person:(id:string)=>string) {
 const changed=c.explanation.changedAssignments
 const changedPeople=new Set(changed.flatMap(x=>[x.fromStaffId,x.toStaffId])).size
 const nonzeroCost=(a:typeof c.low)=>new Set(a.cost.inputs.filter(x=>(x.basis.costCents??0)+(x.holiday.costCents??0)!==0).map(x=>x.staffId)).size
 const nonzeroPremium=(a:typeof c.low)=>new Set(a.scheduledOvertime.groups.filter(x=>x.premiumCents!==null&&x.premiumCents!==0).map(x=>x.staffId)).size
 const alt=(a:typeof c.low)=>({priority:a.priority,assignments:a.assignments.map(x=>({slotId:x.slotId,staffId:person(x.staffId)})),measures:fairness(a.measures,person),coverage:{shifts:a.coverage.shifts,minutes:a.coverage.minutes,slots:a.coverage.slots.map(x=>({id:x.id,start:x.start,end:x.end,site:x.site,job:x.job,breakMinutes:x.breakMinutes,minutes:x.minutes}))},
  cost:{currency:'USD',total:money(a.cost.costCents,nonzeroCost(a)),label:a.cost.label},
  scheduledOvertime:{label:a.scheduledOvertime.label,definition:a.scheduledOvertime.definition,overtimeMinutes:a.scheduledOvertime.overtimeMinutes,
   premium:money(a.scheduledOvertime.premiumCents,nonzeroPremium(a),a.scheduledOvertime.groups.flatMap(x=>x.reasons)),
   groups:a.scheduledOvertime.groups.map(x=>({staffId:person(x.staffId),week:x.week,end:x.end,knownMinutes:x.knownMinutes,minutes:x.minutes,overtimeMinutes:x.overtimeMinutes,missingWeeks:x.missingWeeks,reasons:x.reasons}))}})
 const premiumDifference=c.explanation.weeklyScheduledOvertime.premiumDifferenceCents
 return {status:'known',week:c.week,site:c.site,weeks:c.weeks,sourceWindow:c.sourceWindow,method:c.method,
  low:alt(c.low),high:alt(c.high),uncovered:c.uncovered.map(x=>({id:x.id,start:x.start,end:x.end,minutes:x.minutes})),
  difference:{cost:money(c.difference.costCents,changedPeople),premium:money(premiumDifference,changedPeople,c.low.scheduledOvertime.groups.concat(c.high.scheduledOvertime.groups).flatMap(x=>x.reasons)),coveredMinutes:c.difference.coveredMinutes,coveredShifts:c.difference.coveredShifts},
  explanation:{fairness:c.explanation.fairness.map(x=>({measure:x.measure,low:x.low,high:x.high,difference:x.difference})),changedAssignments:changed.map(x=>({slotId:x.slotId,fromStaffId:person(x.fromStaffId),toStaffId:person(x.toStaffId)})),coverage:{lowSlots:c.explanation.coverage.lowSlots,highSlots:c.explanation.coverage.highSlots,lowMinutes:c.explanation.coverage.lowMinutes,highMinutes:c.explanation.coverage.highMinutes,uncoveredShifts:c.explanation.coverage.uncoveredShifts,uncoveredMinutes:c.explanation.coverage.uncoveredMinutes},serviceRisk:null,uncertainty:c.explanation.uncertainty}}
}

export async function comparisonRead(db:D1Database,a:Actor,week:string,site:string,weeks:number) {
 need(a.role==='agent'&&a.agentKeyId,'Preparation key required',403)
 need(await db.prepare(comparisonGrant).bind(a.agentKeyId,a.id,Date.now(),site).first(),'Not found',404)
 const s=await load(db),person=(id:string)=>s.staff.some(p=>p.id===id&&!p.erased_at)?id:'Former employee'
 let result:unknown
 try {
  // Only this guarded internal calculation uses owner report authority. No command or raw report escapes.
  result=projection(await compareFairness(s,{...a,role:'owner'},week,site,weeks),person)
 } catch(error) {
  if((error as {status?:number}).status!==400)throw error
  result={status:'unknown',week,site,weeks,reasons:[(error as Error).message],low:null,high:null}
 }
 // Recheck the live grant in the same statement that records the read. A revoked,
 // expired or version-changed grant cannot return a previously calculated response.
 await recordComparisonRead(db,a,site,{week})
 return result
}
