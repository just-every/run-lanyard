import {type State,type Row} from './model'
import {localDate} from './settings'
import {workweek} from './payschedules'
import {BREAK_VERSION,policyBreaks} from './policy-breaks'

type Entry={row:Row;rule:Row|undefined}
/** An adjacent job or cafe transfer does not restart the same maintained
 * break obligation. A positive gap is retained as a separate work period;
 * it never becomes an invented meal or a declaration of off-duty time. */
export function breakReviewsFor(s:State,rows:Row[],week:string,planned:boolean,ruleOn:(site:string,on:string)=>Row|undefined){
 const entries:Entry[]=rows.map(t=>{
  const site=t.site??s.staff.find(x=>x.id===t.staffId)?.site??''
  const timed=Array.isArray(t.breaks)||s.clocks.some(k=>k.id===t.clockId)
  const row={...t,site,...(timed?{breaks:t.breaks??[]}: {})}
  return {row,rule:ruleOn(site,localDate(t.start,s.timezone))}
 }).sort((a,b)=>a.row.start.localeCompare(b.row.start)||a.row.id.localeCompare(b.row.id))
 const groups:Entry[][]=[]
 for(const entry of entries){
  const prior=groups.at(-1),last=prior?.at(-1)
  if(last&&last.row.end===entry.row.start&&entry.rule?.breakVersion===BREAK_VERSION&&last.rule?.breakVersion===BREAK_VERSION&&last.rule.preset===entry.rule.preset)prior!.push(entry)
  else groups.push([entry])
 }
 return groups.flatMap(group=>{
  const first=group[0],last=group.at(-1)!,staffId=first.row.staffId
  if(workweek(s,staffId,localDate(first.row.start,s.timezone))!==week)return []
  const timed=group.every(e=>Array.isArray(e.row.breaks)),row={...first.row,end:last.row.end,breakMinutes:group.reduce((n,e)=>n+(e.row.breakMinutes??0),0)}
  if(timed)row.breaks=group.flatMap(e=>e.row.breaks)
  else delete row.breaks
  const review=policyBreaks(first.rule,row,s.timezone,planned)
  return review?[{...review,timeIds:group.map(e=>e.row.id),records:group.map(e=>({id:e.row.id,revision:e.row.revision,site:e.row.site,start:e.row.start,end:e.row.end,policyId:e.rule?.id,policyRevision:e.rule?.revision})),periodStart:first.row.start,periodEnd:last.row.end}]:[]
 })
}
