// FAIR-001 partial: inspect preferences against published schedules, without optimization.
import {type State,type Actor,manager,need,integer,text} from './model'
import {date,dayAfter} from './aca'
import {patternOn,patternFit} from './patterns'
import {localDate} from './settings'
import {salesSite} from './sales'

/** Whole Mon–Sun weeks ending with `week`, inclusive; missing evidence stays unknown. */
export function preferenceReport(s:State,a:Actor,week:string,site:string,weeks=8) {
 manager(a);date(week,'ending week');need(new Date(week+'T00:00:00Z').getUTCDay()===1,'Choose an ending week by its Monday')
 integer(weeks,'trailing weeks',1,52);text(site,'site',80,true)
 need(salesSite(s,a,site),'Not found',404)
 const first=dayAfter(week,-7*(weeks-1)),last=dayAfter(week,6)
 const people=s.staff.filter(p=>!p.erased_at&&(p.site??'')===site&&(p.active||s.shifts.some(x=>x.staffId===p.id&&x.status==='published'&&localDate(x.start,s.timezone)>=first&&localDate(x.start,s.timezone)<=last)))
 const rows=people.flatMap(person=>Array.from({length:weeks},(_,i)=>{
  const on=dayAfter(first,i*7),end=dayAfter(on,6),published=s.rosters.find(r=>r.week===on&&r.status==='published')
  const shifts=s.shifts.filter(x=>x.staffId===person.id&&x.status==='published'&&(x.site||person.site||'')===site&&localDate(x.start,s.timezone)>=on&&localDate(x.start,s.timezone)<=end)
  const patterns=Array.from({length:7},(_,d)=>{const date=dayAfter(on,d),p=patternOn(s,person.id,date);return {date,id:p?.id??null,revision:p?.revision??null,preferredHours:p?.preferredHours??null,blocks:p?.blocks??null,exceptions:p?.exceptions??null}})
  const values=patterns.map(p=>p.preferredHours),known=values.every(v=>typeof v==='number'),stable=known&&new Set(values).size===1
  const preferredMinutes=stable?values[0]*60:null,scheduledMinutes=published?shifts.reduce((n,x)=>n+x.minutes,0):null
  const reasons=[...(!published?['No published week']:[]),...(!known?['Preferred hours missing on one or more days']:known&&!stable?['Preferred hours change within this week']:[])]
  const inputs=shifts.map(x=>{const fit=patternFit(s,person.id,x);return {id:x.id,revision:x.revision,start:x.start,end:x.end,minutes:x.minutes,preferred:fit?.preferred??null}})
  return {staffId:person.id,name:person.name,position:person.position??'',week:on,roster:published?{id:published.id,revision:published.revision}:null,scheduledMinutes,preferredMinutes,gapMinutes:scheduledMinutes!==null&&preferredMinutes!==null?Math.abs(scheduledMinutes-preferredMinutes):null,preferredShifts:inputs.filter(x=>x.preferred===true).length,unknownBlockShifts:inputs.filter(x=>x.preferred===null).length,patterns,shifts:inputs,reasons}
 }))
 const positions=[...new Set(rows.map(r=>r.position))].sort()
 const groups=positions.map(position=>{const own=rows.filter(r=>r.position===position),gaps=own.map(r=>r.gapMinutes).filter((v):v is number=>v!==null);return {position,samples:gaps.length,excluded:own.length-gaps.length,meanGapMinutes:gaps.length?gaps.reduce((n,v)=>n+v,0)/gaps.length:null,maxGapMinutes:gaps.length?Math.max(...gaps):null}})
 return {site,timezone:s.timezone,first,last,week,weeks,cohort:'Current home cafe and position; historical eligibility is not reconstructed',groups,rows}
}
