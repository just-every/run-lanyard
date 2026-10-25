import {type State,type Row} from './model'
import {localDate} from './settings'
import {workweek} from './payschedules'
import {BREAK_VERSION,policyBreaks} from './policy-breaks'

type Entry={row:Row;rule:Row|undefined}
/** An adjacent job or cafe transfer does not restart the same maintained
 * break obligation. Nevada and Oregon preserve their statutory short-gap
 * continuity. No unexplained gap becomes a recorded meal or paid time. */
export function breakReviewsFor(s:State,rows:Row[],week:string,planned:boolean,ruleOn:(site:string,on:string)=>Row|undefined){
 const entries:Entry[]=rows.map(t=>{
  const site=t.site??s.staff.find(x=>x.id===t.staffId)?.site??''
  const timed=Array.isArray(t.breaks)||s.clocks.some(k=>k.id===t.clockId)
  const row:Row={...t,site,...(timed?{breaks:t.breaks??[]}: {})}
  return {row,rule:ruleOn(site,localDate(t.start,s.timezone))}
 }).sort((a,b)=>a.row.start.localeCompare(b.row.start)||a.row.id.localeCompare(b.row.id))
 const groups:Entry[][]=[]
 for(const entry of entries){
  const prior=groups.at(-1),last=prior?.at(-1)
  if(last&&joins(last,entry))prior!.push(entry)
  else groups.push([entry])
 }
 return groups.flatMap(group=>{
  const first=group[0],last=group.at(-1)!,staffId=first.row.staffId
  if(workweek(s,staffId,localDate(first.row.start,s.timezone))!==week)return []
  const gaps=group.slice(1).flatMap((e,i)=>e.row.start>group[i].row.end?[{start:group[i].row.end,end:e.row.start}]:[]),gapMinutes=gaps.reduce((n,g)=>n+(Date.parse(g.end)-Date.parse(g.start))/60000,0)
  const timed=group.every(e=>Array.isArray(e.row.breaks)),row:Row={...first.row,end:last.row.end,breakMinutes:group.reduce((n,e)=>n+(e.row.breakMinutes??0),0)+(first.rule?.preset==='NV'?gapMinutes:0)}
  if(timed)row.breaks=group.flatMap(e=>e.row.breaks)
  else delete row.breaks
  const review=policyBreaks(first.rule,row,s.timezone,planned)
  if(review&&gaps.length)review.issues.push({kind:'meal',state:'unknown',message:'Short intervals between source records do not reset this work period; off-duty and meal status require review'})
  return review?[{...review,unrecordedIntervals:gaps,timeIds:group.map(e=>e.row.id),records:group.map(e=>({id:e.row.id,revision:e.row.revision,site:e.row.site,start:e.row.start,end:e.row.end,policyId:e.rule?.id,policyRevision:e.rule?.revision})),periodStart:first.row.start,periodEnd:last.row.end}]:[]
 })
}

function joins(a:Entry,b:Entry){
 if(a.rule?.breakVersion!==BREAK_VERSION||b.rule?.breakVersion!==BREAK_VERSION||a.rule.preset!==b.rule.preset||a.rule.industry!==b.rule.industry)return false
 const gap=(Date.parse(b.row.start)-Date.parse(a.row.end))/60000
 return gap===0||a.rule.preset==='NV'&&gap>0&&gap<30||a.rule.preset==='OR'&&gap>0&&gap<=60
}
