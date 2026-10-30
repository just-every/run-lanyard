// Native response calibration only: observed response times cannot establish service improvement.
import {type Actor,type Context,type State,type Row,keys,text,integer,need,manager,put,canonical,sha} from './model'
import {salesSite} from './sales'
import {restricted} from './access'
import {offerRuleSnapshot,offerRules} from './offerorder'

const VERSION='native-response-percentile-v1'
const ruleAt=(s:State,site:string)=>s.offerrules.find(r=>r.site===site)
const numeric=(v:unknown)=>typeof v==='string'&&v!==''?Number(v):v
const valid=(v:unknown):v is string=>typeof v==='string'&&Number.isFinite(Date.parse(v))
function scope(s:State,a:Actor,site:string) {
 manager(a);need(!restricted(s,a),'This review is unavailable to custom levels',403)
 need(salesSite(s,a,site),'Not found',404)
}
/** Existing coverage reviews are employer assertions, never a new legal determination. */
export function timingPrerequisite(s:State,site:string):string|null {
 const policy=s.fairworkpolicies.find(r=>r.site===site),rule=ruleAt(s,site)
 if(!policy?.rule||policy.covered||rule?.accessToHours||rule?.fairworkPolicyId)return 'Statutory timing, consent or exception prerequisites are unavailable: an existing maintained coverage review outside coverage and access to hours off are required'
 return null
}
export function offerTimingEvaluate(s:State,a:Actor,site:string,percentile:unknown,asOf:string) {
 scope(s,a,site)
 const target=percentile===undefined||percentile===null||percentile===''?null:integer(numeric(percentile),'response percentile',1,100)
 const rule=ruleAt(s,site),snapshot=offerRuleSnapshot(rule),policy=s.fairworkpolicies.find(r=>r.site===site)
 // Never infer historical cafe scope from a person's current home cafe. Legacy rows whose
 // assignment retains this cafe are counted unknown, not admitted as observed responses.
 const sources=s.offers.filter(o=>o.site===site||o.site===undefined&&s.shifts.some(r=>r.id===o.shiftId&&r.site===site)).sort((a,b)=>a.id.localeCompare(b.id))
 const groups=new Map<string,Row[]>()
 for(const o of sources){const id=o.roundId??'legacy:'+o.id;groups.set(id,[...(groups.get(id)??[]),o])}
 const rounds=[...groups].map(([id,offers])=>{
  const responses=offers.map(o=>{
   const decision=o.response??(['accepted','declined'].includes(o.status)?o.status:o.status==='approved'?'accepted':null)
   const reason=o.site!==site||!o.roundId||!o.offerRule?'missing historical scope or rule':!valid(o.opensAt)||!valid(o.createdAt)||!valid(o.expiresAt)?'missing historical timing':!valid(o.respondedAt)?o.closedAt?'closed before an actual response':'unanswered':!decision?'response decision unknown':Date.parse(o.respondedAt)<Date.parse(o.opensAt)||Date.parse(o.respondedAt)>=Date.parse(o.expiresAt)||Date.parse(o.respondedAt)>Date.parse(asOf)||valid(o.closedAt)&&Date.parse(o.closedAt)<Date.parse(o.respondedAt)?'response outside the offered interval':null
   return {offerId:o.id,revision:o.revision,opensAt:o.opensAt??null,respondedAt:o.respondedAt??null,expiresAt:o.expiresAt??null,closedAt:o.closedAt??null,decision,latencyMinutes:reason?null:(Date.parse(o.respondedAt)-Date.parse(o.opensAt))/60000,unknownReason:reason}
  })
  const openedAt=offers.map(o=>o.createdAt??'').sort()[0],endsAt=offers.map(o=>o.expiresAt??'').sort().at(-1)??''
  const unknown=responses.find(r=>r.unknownReason)?.unknownReason
  const reason=unknown??(!valid(endsAt)||Date.parse(endsAt)>Date.parse(asOf)?'round not completed':offers.some(o=>canonical(o.offerRule)!==canonical(snapshot))?'different offer rule':null)
  return {id,openedAt,endsAt,status:reason?'unknown':'comparable',reason:reason??null,responses}
 }).sort((a,b)=>a.openedAt.localeCompare(b.openedAt)||a.id.localeCompare(b.id))
 const comparable=rounds.filter(r=>r.status==='comparable'),unknownRounds=rounds.length-comparable.length
 const base={site,asOf,explanationVersion:VERSION,targetPercentile:target,ruleRevision:rule?.revision??0,rule:snapshot,policyRevision:policy?.revision??0,prerequisite:timingPrerequisite(s,site),comparableRounds:comparable.length,unknownRounds,unknownResponses:rounds.flatMap(r=>r.responses).filter(r=>r.latencyMinutes===null).length,rounds,
  // The complete source facts, including unknown rows, bind every later decision.
  evidence:sources.map(o=>({id:o.id,revision:o.revision,site:o.site??null,roundId:o.roundId??null,shiftId:o.shiftId,shiftRevision:o.shiftRevision??null,createdAt:o.createdAt??null,opensAt:o.opensAt??null,expiresAt:o.expiresAt??null,respondedAt:o.respondedAt??null,closedAt:o.closedAt??null,status:o.status,response:o.response??null,offerRule:o.offerRule??null})),policy:policy??null,
  boundary:'Calibration of observed native responses only; unknown responses are excluded, never zero latency or successful coverage. No counterfactual service improvement, delivery or legal compliance is established.'}
 const stop=(status:string,reason:string)=>({...base,status,reason,evaluation:null,proposal:null})
 if(target===null)return stop('needs-target','Explicitly review a response-percentile target')
 if(rule?.order!=='tiers')return stop('unavailable','Save a timed-tier call-out rule first')
 if(comparable.length<6)return stop('insufficient',`${comparable.length} complete comparable rounds; at least 6 are needed`)
 const holdoutCount=Math.max(1,Math.floor(comparable.length/3)),train=comparable.slice(0,-holdoutCount),held=comparable.slice(-holdoutCount)
 const values=(rows:typeof rounds)=>rows.flatMap(r=>r.responses.map(v=>v.latencyMinutes!))
 const training=values(train).sort((a,b)=>a-b),holdout=values(held)
 if(training.length<6||holdout.length<3)return stop('insufficient','At least 6 earlier responses and 3 later held-out responses are needed')
 const quantile=training[Math.ceil(training.length*target/100)-1],minutes=Math.max(1,Math.ceil(quantile))
 const by=(n:number)=>holdout.filter(v=>v<=n).length,current=by(rule.minutes),candidate=by(minutes)
 const loss=(n:number)=>Math.abs(n/holdout.length*100-target)
 const evaluation={trainRounds:train.map(r=>r.id),holdoutRounds:held.map(r=>r.id),trainingResponses:training.length,holdoutResponses:holdout.length,trainingPercentileMinutes:quantile,currentWithinMinutes:current,candidateWithinMinutes:candidate,currentResponsePercent:current/holdout.length*100,candidateResponsePercent:candidate/holdout.length*100,currentCalibrationErrorPoints:loss(current),candidateCalibrationErrorPoints:loss(candidate)}
 const evaluated={...base,evaluation}
 if(minutes>1440||minutes===rule.minutes||loss(candidate)>=loss(current))return {...evaluated,status:'no-improvement',reason:'No validated interval strictly improves calibration on later held-out rounds',proposal:null}
 return {...evaluated,status:'proposal',reason:null,proposal:{field:'minutes',from:rule.minutes,to:minutes,explanation:`The reviewed ${target}th percentile on ${train.length} earlier rounds is ${quantile} minutes; rounded up to ${minutes} minutes. On ${held.length} later held-out rounds (${holdout.length} observed responses), calibration error falls from ${loss(current).toFixed(2)} to ${loss(candidate).toFixed(2)} percentage points. Only future call-out tier intervals would change from ${rule.minutes} to ${minutes} minutes.`}}
}
export type OfferTiming=ReturnType<typeof offerTimingEvaluate>
export const offerTimingDigest=(e:OfferTiming)=>sha(canonical({version:e.explanationVersion,site:e.site,target:e.targetPercentile,rule:e.rule,ruleRevision:e.ruleRevision,policy:e.policy,evidence:e.evidence,proposal:e.proposal,evaluation:e.evaluation}))
export async function offerTimingRead(s:State,a:Actor,site:string,percentile:unknown,now:string) {
 const e=offerTimingEvaluate(s,a,site,percentile,now)
 const {evidence,policy,...shown}=e
 return {...shown,digest:await offerTimingDigest(e),ruleDigest:await sha(canonical({rule:e.rule,revision:e.ruleRevision,policy})),proposals:s.learnoffers.filter(r=>r.site===site).sort((a,b)=>b.version-a.version)}
}
function setMinutes(c:Context,site:string,minutes:number) {
 const rule=ruleAt(c.s,site);need(rule?.order==='tiers','The timed-tier rule is unavailable',409)
 const prerequisite=timingPrerequisite(c.s,site);need(!prerequisite,prerequisite??'',409)
 return offerRules(c,'offerrule.save',{site,revision:rule.revision,order:rule.order,rule:rule.rule,size:rule.size,ranking:rule.ranking,minutes})!
}
export async function offerTimingCommand(c:Context,name:string,p:Record<string,any>) {
 if(!name.startsWith('learn.offer.'))return undefined
 manager(c.a)
 if(name==='learn.offer.propose'){
  keys(p,['site','percentile','targetReviewed','reason','digest'])
  const site=text(p.site,'site',80,true);scope(c.s,c.a,site)
  need(p.targetReviewed===true||p.targetReviewed==='on','Explicitly confirm the response-percentile target')
  const reason=text(p.reason,'target review reason',280),e=offerTimingEvaluate(c.s,c.a,site,p.percentile,c.now),digest=await offerTimingDigest(e)
  need(digest===text(p.digest,'digest',64),'The evidence or offer rule changed; review it again',409)
  need(e.status==='proposal'&&e.proposal,`No change to propose: ${e.reason}`,409)
  const prior=c.s.learnoffers.filter(r=>r.site===site)
  need(!prior.some(r=>r.status==='proposed'),'Decide the open timing proposal first',409)
  return put(c,'learnoffers',{site,version:prior.length+1,status:'proposed',explanationVersion:VERSION,targetPercentile:e.targetPercentile,targetReview:{by:c.a.id,role:c.a.role,at:c.now,reason},change:e.proposal,evaluation:e.evaluation,rounds:e.rounds,evidence:e.evidence,digest,ruleDigest:await sha(canonical({rule:e.rule,revision:e.ruleRevision,policy:e.policy})),rule:e.rule,ruleRevision:e.ruleRevision,policyId:e.policy?.id??null,policyRevision:e.policyRevision,proposedBy:c.a.id,proposedRole:c.a.role,proposedAt:c.now,decision:null})
 }
 keys(p,['id','revision','decision','reason'])
 const r=c.s.learnoffers.find(r=>r.id===p.id);need(r,'Timing proposal not found',404);scope(c.s,c.a,r.site)
 need(integer(numeric(p.revision),'revision',1,Number.MAX_SAFE_INTEGER)===r.revision,'This proposal changed; reload before deciding',409)
 const reason=text(p.reason,'reason',280),rule=ruleAt(c.s,r.site)
 if(name==='learn.offer.revert'){
  need(r.status==='approved','Only an approved timing proposal can be reverted',409)
  need(rule?.revision===r.appliedRuleRevision,'The offer rule changed after approval; review it directly',409)
  const restored=setMinutes(c,r.site,r.change.from)
  return put(c,'learnoffers',{...r,status:'reverted',decision:{...r.decision,revertedBy:c.a.id,revertedRole:c.a.role,revertedAt:c.now,revertReason:reason,restoredRuleRevision:restored.revision}},r)
 }
 need(name==='learn.offer.decide','Unknown timing command',404)
 need(r.status==='proposed','This timing proposal is already decided',409)
 need(['approved','declined'].includes(p.decision),'Choose approved or declined')
 if(p.decision==='declined')return put(c,'learnoffers',{...r,status:'declined',decision:{decision:p.decision,reason,by:c.a.id,role:c.a.role,at:c.now}},r)
 const e=offerTimingEvaluate(c.s,c.a,r.site,r.targetPercentile,c.now)
 need(await offerTimingDigest(e)===r.digest,'The evidence, coverage review or offer rule changed; decline and review again',409)
 const applied=setMinutes(c,r.site,r.change.to)
 return put(c,'learnoffers',{...r,status:'approved',appliedRuleRevision:applied.revision,decision:{decision:p.decision,reason,by:c.a.id,role:c.a.role,at:c.now}},r)
}
