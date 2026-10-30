// LEARN-001: a measured, human-controlled change to a cafe's DEMAND-001 growth assumption. Comparable service
// days are completed days with a complete forecast version saved before the day started and at least one hour
// of entered sales; the model's own (pre-override) hourly forecast is compared with those sales. The earlier
// two thirds of the days fit one bias, the latest third is held out, and a proposal exists only when applying
// the bias strictly lowers the holdout error. Unknown outcomes (no sales entered, no or incomplete forecast)
// are counted and never read as success; unresolved no-show signals stay unobserved causes. Nothing is applied
// until a manager approves it; a revert restores the earlier assumption and never edits history.
import {type Actor,type Context,type State,keys,text,integer,need,manager,put,canonical,sha} from './model'
import {localDate} from './settings'
import {salesSite} from './sales'
import {weekOf} from './openshifts'
import {demandOutcome} from './demand-compare'
import {datePlus,DEMAND_DEFAULTS} from './demand'
import {learningReport} from './learning'
import {requireComparison} from '../comparison-scope'

export const MIN_PERIODS=3
const usd=(c:number)=>'$'+(c/100).toFixed(2)
const clamp=(v:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,v))
const mean=(v:number[])=>v.reduce((n,x)=>n+x,0)/v.length
const ruleOf=(s:State,site:string)=>s.demandrules.find(r=>r.site===site)

export function learnEvaluate(s:State,a:Actor,site:string,weeks:number,asOf:string) {
 need(salesSite(s,a,site),'Not found',404);integer(weeks,'weeks',1,26)
 const today=localDate(asOf,s.timezone),report=learningReport(s,a,weekOf(s,asOf),site,weeks+1,asOf)
 const days:any[]=[],excluded:Record<string,number>={},hoursOf:Record<string,{computed:number;actual:number}[]>={}
 const skip=(reason:string)=>{excluded[reason]=(excluded[reason]??0)+1}
 for(let i=weeks*7;i>=1;i--) {
  const date=datePlus(today,-i),o:any=demandOutcome(s,site,date,asOf)
  if(!o.hours){skip('no forecast saved before the service day');continue}
  if(o.forecastStatus!=='complete'){skip('forecast incomplete (stale or thin inputs)');continue}
  const seen=o.hours.filter((x:any)=>x.errorCents!==null&&x.computedCents!==null&&x.computedCents>0)
  if(!seen.length){skip('no sales entered for the forecast hours');continue}
  const attendance=report.days.find((d:any)=>d.date===date)?.attendance,noShows=attendance?.unresolvedNoShows?.length??0
  const version=s.demandforecasts.find(v=>v.id===o.versionId)!
  const computed=seen.reduce((n:number,x:any)=>n+x.computedCents,0),actual=seen.reduce((n:number,x:any)=>n+x.actualCents,0)
  const sources=[...(version.assumptions.seasonality?['employer-reviewed monthly seasonality']:[]),...(version.assumptions.event?[`event day: ${version.assumptions.event.name}`]:[]),...(o.hours.some((x:any)=>x.overridden)?['manager override (not used to fit the model)']:[]),...(o.summary.unknownHours?[`${o.summary.unknownHours} hours without entered sales (unknown, not counted)`]:[]),...(noShows?[`${noShows} unresolved no-show signal${noShows===1?'':'s'} (unobserved; absence not assumed)`]:[])]
  hoursOf[date]=seen.map((x:any)=>({computed:x.computedCents,actual:x.actualCents}))
  days.push({date,version:o.version,observedHours:seen.length,computedCents:computed,actualCents:actual,errorCents:actual-computed,biasPercent:Math.round((actual/computed-1)*1000)/10,sources:sources.length?sources:['unattributed']})
 }
 const base={site,weeks,asOf,basis:'Pre-override forecast versions saved before each service day against entered hourly sales',errorSign:'actual minus forecast',comparableDays:days.length,excluded,days,providerHistory:{status:'unknown',reason:'no-connected-POS-history'},ruleRevision:ruleOf(s,site)?.revision??0}
 if(days.length<MIN_PERIODS)return {...base,status:'insufficient',reason:`${days.length} comparable service days; ${MIN_PERIODS} are needed`,proposal:null}
 const holdoutDays=Math.max(1,Math.floor(days.length/3)),train=days.slice(0,days.length-holdoutDays),holdout=days.slice(days.length-holdoutDays)
 const all=(list:any[])=>list.flatMap(d=>hoursOf[d.date])
 const t=all(train),bias=clamp(Math.round((t.reduce((n,x)=>n+x.actual,0)/t.reduce((n,x)=>n+x.computed,0)-1)*100),-50,100)
 const h=all(holdout),current=Math.round(mean(h.map(x=>Math.abs(x.actual-x.computed)))),candidate=Math.round(mean(h.map(x=>Math.abs(x.actual-Math.round(x.computed*(1+bias/100))))))
 const evaluation={trainDates:train.map(d=>d.date),holdoutDates:holdout.map(d=>d.date),biasPercent:bias,holdoutHours:h.length,currentMeanAbsoluteErrorCents:current,candidateMeanAbsoluteErrorCents:candidate}
 if(Math.abs(bias)<2)return {...base,status:'no-change',reason:'the measured bias is under 2%',evaluation,proposal:null}
 if(candidate>=current)return {...base,status:'no-improvement',reason:'the change does not lower the held-out error',evaluation,proposal:null}
 const from=ruleOf(s,site)?.growthPercent??DEMAND_DEFAULTS.growthPercent,to=clamp(Math.round(((1+from/100)*(1+bias/100)-1)*100),-50,200)
 if(to===from)return {...base,status:'no-change',reason:'the proposed growth equals the current growth',evaluation,proposal:null}
 return {...base,status:'proposal',evaluation,proposal:{field:'growthPercent',from,to,explanation:`Actual hourly sales ran ${bias>0?'+':''}${bias}% against the model on ${train.length} earlier service days; applying that to ${holdout.length} held-out days lowers the mean hourly error from ${usd(current)} to ${usd(candidate)}. Growth would move from ${from}% to ${to}%.`}}
}
export type Learn=ReturnType<typeof learnEvaluate>
export const learnDigest=(e:Learn)=>sha(canonical({site:e.site,weeks:e.weeks,days:e.days.map((d:any)=>[d.date,d.version,d.computedCents,d.actualCents]),proposal:e.proposal,ruleRevision:e.ruleRevision}))
const versions=(s:State,site:string)=>s.learnproposals.filter(r=>r.site===site)
function setGrowth(c:Context,site:string,growthPercent:number) {
 const old=ruleOf(c.s,site),{historyWeeks,minSamples,staleDays}={...DEMAND_DEFAULTS,...old}
 return put(c,'demandrules',{site,historyWeeks,minSamples,staleDays,events:old?.events??[],roles:old?.roles??[],seasonality:old?.seasonality??null,growthPercent,savedBy:c.a.id,savedAt:c.now},old)
}
export async function learnCommand(c:Context,name:string,p:Record<string,any>) {
 if(name==='learn.propose') {
  if(c.a.role!=='agent')manager(c.a);keys(p,['site','weeks','digest'])
  const site=text(p.site,'site',80,true),weeks=integer(typeof p.weeks==='string'?Number(p.weeks):p.weeks??8,'weeks',1,26)
  if(c.a.role==='agent')await requireComparison(c.db,c.a,site)
  else need(salesSite(c.s,c.a,site),'Not found',404)
  const e=learnEvaluate(c.s,c.a.role==='agent'?{...c.a,role:'owner'}:c.a,site,weeks,c.now),digest=await learnDigest(e)
  need(digest===text(p.digest,'digest',64),'The evidence or assumptions changed since this proposal was reviewed; review it again',409)
  need(e.status==='proposal'&&e.proposal,`No change to propose: ${(e as any).reason}`,409)
  need(!versions(c.s,site).some(r=>r.status==='proposed'),'Decide the open proposal first',409)
  if(c.a.role==='agent')c.storedActor=c.a.agentKeyId
  return put(c,'learnproposals',{site,version:versions(c.s,site).length+1,status:'proposed',weeks,change:e.proposal,evaluation:e.evaluation,days:e.days,excluded:e.excluded,ruleRevision:e.ruleRevision,digest,proposedBy:c.storedActor??c.a.id,proposedRole:c.a.role,proposalReason:e.proposal.explanation,proposedAt:c.now,decision:null})
 }
 if(name==='learn.decide'||name==='learn.revert') {
  manager(c.a);keys(p,['id','revision','decision','reason'])
  const r=c.s.learnproposals.find(x=>x.id===p.id);need(r,'Proposal not found',404);need(salesSite(c.s,c.a,r.site),'Not found',404)
  need(Number(p.revision)===r.revision,'This proposal changed; reload before deciding',409);const reason=text(p.reason,'reason',280)
  const rule=ruleOf(c.s,r.site)
  if(name==='learn.revert') {
   need(r.status==='approved','Only an approved proposal can be reverted',409)
   need((rule?.revision??0)===r.appliedRuleRevision,'The assumptions changed after this proposal; revert by editing them directly',409)
   const restored=setGrowth(c,r.site,r.change.from)
   return put(c,'learnproposals',{...r,status:'reverted',decision:{...r.decision,revertedBy:c.a.id,revertedAt:c.now,revertReason:reason,restoredRuleRevision:restored.revision}},r)
  }
  need(r.status==='proposed','This proposal is already decided',409)
  const decision=text(p.decision,'decision',20);need(['approved','declined'].includes(decision),'Choose approved or declined')
  if(decision==='declined')return put(c,'learnproposals',{...r,status:'declined',decision:{decision,reason,by:c.a.id,at:c.now}},r)
  need((rule?.revision??0)===r.ruleRevision,'The assumptions changed since this proposal; decline it and propose again',409)
  const applied=setGrowth(c,r.site,r.change.to)
  return put(c,'learnproposals',{...r,status:'approved',appliedRuleRevision:applied.revision,decision:{decision,reason,by:c.a.id,at:c.now}},r)
 }
 return undefined
}
